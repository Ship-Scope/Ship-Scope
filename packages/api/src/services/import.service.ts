import { type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { importQueue } from '../lib/queue';
import { BadRequest, NotFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { parseCSV } from '../lib/csv-parser';
import { detectColumns } from '../lib/column-detector';
import type { ColumnMapping } from '../schemas/import.schema';

const SYNC_THRESHOLD = 100;
const REDIS_TTL = 3600; // 1 hour

interface PreviewResult {
  headers: string[];
  preview: Record<string, string>[];
  suggestedMapping: ColumnMapping;
  totalRows: number;
}

interface SyncImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface AsyncImportResult {
  jobId: string;
}

interface JobStatus {
  status: string;
  progress: number;
  imported?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
}

// ---------- Preview ----------

export async function previewImport(
  buffer: Buffer,
  format: 'csv' | 'json',
): Promise<PreviewResult> {
  if (format === 'csv') {
    const result = await parseCSV(buffer, { maxRows: 5 });

    if (result.headers.length === 0) {
      throw BadRequest('CSV file is empty or has no headers');
    }

    const detection = detectColumns(result.headers, result.rows);

    return {
      headers: result.headers,
      preview: result.rows,
      suggestedMapping: detection.suggestedMappings as ColumnMapping,
      totalRows: result.totalRows,
    };
  }

  // JSON format
  const text = buffer.toString('utf-8');
  let items: Record<string, unknown>[];
  try {
    items = JSON.parse(text);
  } catch {
    throw BadRequest('Invalid JSON format');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw BadRequest('JSON must be a non-empty array');
  }

  const headers = Object.keys(items[0]);
  const preview = items.slice(0, 5).map((item) => {
    const row: Record<string, string> = {};
    for (const key of headers) {
      row[key] = item[key] != null ? String(item[key]) : '';
    }
    return row;
  });

  const detection = detectColumns(headers, preview);

  return {
    headers,
    preview,
    suggestedMapping: detection.suggestedMappings as ColumnMapping,
    totalRows: items.length,
  };
}

// ---------- CSV Import ----------

export async function importCSV(
  buffer: Buffer,
  filename: string,
  columnMapping?: ColumnMapping,
): Promise<SyncImportResult | AsyncImportResult> {
  const parsed = await parseCSV(buffer);

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    throw BadRequest('CSV file is empty or contains no data rows');
  }

  // Auto-detect columns if no mapping provided
  const mapping =
    columnMapping ??
    (detectColumns(parsed.headers, parsed.rows.slice(0, 10)).suggestedMappings as ColumnMapping);

  // Validate the content column exists in headers
  if (!parsed.headers.includes(mapping.content)) {
    throw BadRequest(`Content column "${mapping.content}" not found in CSV headers`, {
      headers: parsed.headers,
    });
  }

  // Create the FeedbackSource record
  const source = await prisma.feedbackSource.create({
    data: {
      name: filename,
      type: 'csv',
      filename,
      metadata: { columnMapping: mapping },
    },
  });

  // Sync processing for small datasets
  if (parsed.rows.length <= SYNC_THRESHOLD) {
    const result = await processBatchSync(parsed.rows, source.id, mapping);

    await prisma.feedbackSource.update({
      where: { id: source.id },
      data: { rowCount: result.imported },
    });

    return result;
  }

  // Async processing for large datasets
  const redisKey = `import:data:${source.id}`;
  await redis.set(redisKey, JSON.stringify({ rows: parsed.rows, mapping }), 'EX', REDIS_TTL);

  const job = await importQueue.add('import-csv', {
    sourceId: source.id,
    redisKey,
    format: 'csv',
    totalRows: parsed.rows.length,
  });

  return { jobId: job.id! };
}

// ---------- JSON Import ----------

export async function importJSON(
  data: {
    content: string;
    author?: string;
    email?: string;
    channel?: string;
    metadata?: Record<string, unknown>;
  }[],
  filename: string,
): Promise<SyncImportResult | AsyncImportResult> {
  // Create the FeedbackSource record
  const source = await prisma.feedbackSource.create({
    data: {
      name: filename,
      type: 'json',
      filename,
      metadata: {},
    },
  });

  // Build rows in a uniform shape for batch processing
  const rows = data.map((item) => ({
    content: item.content,
    author: item.author ?? '',
    email: item.email ?? '',
    channel: item.channel ?? '',
    metadata: item.metadata ?? {},
  }));

  // Sync processing for small datasets
  if (rows.length <= SYNC_THRESHOLD) {
    const result = await processJSONBatchSync(rows, source.id);

    await prisma.feedbackSource.update({
      where: { id: source.id },
      data: { rowCount: result.imported },
    });

    return result;
  }

  // Async processing for large datasets
  const redisKey = `import:data:${source.id}`;
  await redis.set(redisKey, JSON.stringify({ rows }), 'EX', REDIS_TTL);

  const job = await importQueue.add('import-json', {
    sourceId: source.id,
    redisKey,
    format: 'json',
    totalRows: rows.length,
  });

  return { jobId: job.id! };
}

// ---------- Job Status ----------

export async function getImportJobStatus(jobId: string): Promise<JobStatus> {
  const job = await importQueue.getJob(jobId);

  if (!job) {
    throw NotFound('Import job');
  }

  const state = await job.getState();
  const progress = typeof job.progress === 'number' ? job.progress : 0;

  const result: JobStatus = {
    status: state,
    progress,
  };

  if (state === 'completed' && job.returnvalue) {
    result.imported = job.returnvalue.imported;
    result.skipped = job.returnvalue.skipped;
    result.errors = job.returnvalue.errors;
  }

  if (state === 'failed') {
    result.errors = [{ row: 0, message: job.failedReason ?? 'Unknown error' }];
  }

  return result;
}

// ---------- Internal Helpers ----------

async function processBatchSync(
  rows: Record<string, string>[],
  sourceId: string,
  mapping: ColumnMapping,
): Promise<SyncImportResult> {
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const content = (row[mapping.content] ?? '').trim();

    if (!content || content.length < 10) {
      skipped++;
      continue;
    }

    try {
      // Check for duplicates (same content + sourceId)
      const existing = await prisma.feedbackItem.findFirst({
        where: { content, sourceId },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.feedbackItem.create({
        data: {
          content,
          sourceId,
          author: mapping.author ? (row[mapping.author] ?? '').trim() || null : null,
          email: mapping.email ? (row[mapping.email] ?? '').trim() || null : null,
          channel: mapping.channel ? (row[mapping.channel] ?? '').trim() || null : null,
          metadata: {},
        },
      });

      imported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ row: i + 1, message });
      logger.error('Import row error', { row: i + 1, error: message });
    }
  }

  return { imported, skipped, errors };
}

async function processJSONBatchSync(
  rows: {
    content: string;
    author: string;
    email: string;
    channel: string;
    metadata: Record<string, unknown>;
  }[],
  sourceId: string,
): Promise<SyncImportResult> {
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const content = row.content.trim();

    if (!content || content.length < 10) {
      skipped++;
      continue;
    }

    try {
      // Check for duplicates (same content + sourceId)
      const existing = await prisma.feedbackItem.findFirst({
        where: { content, sourceId },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.feedbackItem.create({
        data: {
          content,
          sourceId,
          author: row.author || null,
          email: row.email || null,
          channel: row.channel || null,
          metadata: (row.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      imported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ row: i + 1, message });
      logger.error('Import row error', { row: i + 1, error: message });
    }
  }

  return { imported, skipped, errors };
}
