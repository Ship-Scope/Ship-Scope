import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { generateEmbeddings } from './ai.service';

const BATCH_SIZE = 100;

export interface EmbeddingProgress {
  total: number;
  processed: number;
  percentage: number;
}

/**
 * Generate and store embeddings for unembedded feedback items.
 * Processes in batches of 100 to respect OpenAI rate limits.
 * Stores embeddings directly in pgvector column via raw SQL.
 */
export async function embedFeedbackItems(
  onProgress?: (progress: EmbeddingProgress) => void,
): Promise<{ embedded: number; skipped: number }> {
  // Fetch items without embeddings
  const items = await prisma.feedbackItem.findMany({
    where: { embeddedAt: null },
    select: { id: true, content: true },
    orderBy: { createdAt: 'asc' },
  });

  if (items.length === 0) {
    return { embedded: 0, skipped: 0 };
  }

  let embedded = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const texts = batch.map((item) => item.content);

    try {
      const embeddings = await generateEmbeddings(texts);

      // Store embeddings via raw SQL (pgvector)
      for (let j = 0; j < batch.length; j++) {
        const vectorStr = `[${embeddings[j].join(',')}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "FeedbackItem" SET embedding = $1::vector, "embeddedAt" = NOW() WHERE id = $2`,
          vectorStr,
          batch[j].id,
        );
      }

      embedded += batch.length;
    } catch (error) {
      logger.error('Embedding batch failed', {
        batchStart: i,
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
      skipped += batch.length;
    }

    if (onProgress) {
      onProgress({
        total: items.length,
        processed: embedded + skipped,
        percentage: Math.round(((embedded + skipped) / items.length) * 100),
      });
    }
  }

  logger.info('Embedding complete', { embedded, skipped, total: items.length });
  return { embedded, skipped };
}

/**
 * Fetch embeddings for items that have been embedded.
 * Returns items with their embedding vectors parsed from pgvector.
 */
export async function getEmbeddedItems(): Promise<{ id: string; embedding: number[] }[]> {
  const rows = await prisma.$queryRaw<{ id: string; embedding: string }[]>`
    SELECT id, embedding::text
    FROM "FeedbackItem"
    WHERE embedding IS NOT NULL
    ORDER BY "createdAt" ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    embedding: JSON.parse(row.embedding) as number[],
  }));
}
