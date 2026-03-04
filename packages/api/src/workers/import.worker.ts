import { Worker, type Job } from 'bullmq';
import { type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(REDIS_URL);

const connection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  password: url.password || undefined,
  db: url.pathname ? parseInt(url.pathname.slice(1)) || 0 : 0,
};

interface ImportJobData {
  sourceId: string;
  redisKey: string;
  format: 'csv' | 'json';
  totalRows: number;
}

interface ImportJobResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface CSVPayload {
  rows: Record<string, string>[];
  mapping: {
    content: string;
    author?: string;
    email?: string;
    channel?: string;
    date?: string;
  };
}

interface JSONPayload {
  rows: {
    content: string;
    author?: string;
    email?: string;
    channel?: string;
    metadata?: Record<string, unknown>;
  }[];
}

async function processImportJob(job: Job<ImportJobData>): Promise<ImportJobResult> {
  const { sourceId, redisKey, format, totalRows } = job.data;

  logger.info('Starting import job', { jobId: job.id, sourceId, format, totalRows });

  // Fetch parsed data from Redis
  const raw = await redis.get(redisKey);
  if (!raw) {
    throw new Error(`Import data not found in Redis for key: ${redisKey}`);
  }

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  if (format === 'csv') {
    const payload: CSVPayload = JSON.parse(raw);
    const { rows, mapping } = payload;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const content = (row[mapping.content] ?? '').trim();

      if (!content || content.length < 10) {
        skipped++;
        if ((i + 1) % 10 === 0 || i === rows.length - 1) {
          await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
        }
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
        } else {
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
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ row: i + 1, message });
        logger.error('Import worker row error', { jobId: job.id, row: i + 1, error: message });
      }

      // Update progress every 10 rows
      if ((i + 1) % 10 === 0 || i === rows.length - 1) {
        await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
      }
    }
  } else {
    // JSON format
    const payload: JSONPayload = JSON.parse(raw);
    const { rows } = payload;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const content = (row.content ?? '').trim();

      if (!content || content.length < 10) {
        skipped++;
        if ((i + 1) % 10 === 0 || i === rows.length - 1) {
          await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
        }
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
        } else {
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
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ row: i + 1, message });
        logger.error('Import worker row error', { jobId: job.id, row: i + 1, error: message });
      }

      // Update progress every 10 rows
      if ((i + 1) % 10 === 0 || i === rows.length - 1) {
        await job.updateProgress(Math.round(((i + 1) / rows.length) * 100));
      }
    }
  }

  // Clean up Redis key
  await redis.del(redisKey);

  // Update FeedbackSource rowCount
  await prisma.feedbackSource.update({
    where: { id: sourceId },
    data: { rowCount: imported },
  });

  logger.info('Import job completed', {
    jobId: job.id,
    sourceId,
    imported,
    skipped,
    errorCount: errors.length,
  });

  return { imported, skipped, errors };
}

export const importWorker = new Worker<ImportJobData, ImportJobResult>('import', processImportJob, {
  connection,
  concurrency: 2,
});

importWorker.on('completed', (job) => {
  logger.info('Import job finished', { jobId: job.id });
});

importWorker.on('failed', (job, err) => {
  logger.error('Import job failed', {
    jobId: job?.id,
    error: err.message,
  });
});
