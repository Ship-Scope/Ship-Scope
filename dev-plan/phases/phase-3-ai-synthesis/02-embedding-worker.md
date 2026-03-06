# 02 — Embedding Generation Worker

## Objective

Build the BullMQ worker that generates vector embeddings for all unprocessed feedback items in batches of 100, stores them in pgvector columns, tracks progress, handles failures gracefully with retry logic, and skips already-embedded items for idempotent re-runs.

## Dependencies

- 01-openai-client (aiService.generateEmbeddings())
- Phase 1: BullMQ queue definitions, Prisma with pgvector

## Files to Create

| File                                             | Purpose                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| `packages/api/src/workers/embedding.worker.ts`   | BullMQ worker for embedding generation             |
| `packages/api/src/services/embedding.service.ts` | Embedding business logic (batch creation, storage) |

## Files to Modify

| File                        | Changes                           |
| --------------------------- | --------------------------------- |
| `packages/api/src/index.ts` | Import and start embedding worker |

## Detailed Sub-Tasks

### 1. Build embedding service (`packages/api/src/services/embedding.service.ts`)

**Function: `getUnembeddedItems(limit?: number)`**

- Query FeedbackItems where `embeddedAt IS NULL`
- Order by `createdAt ASC` (process oldest first)
- Return items with id and content
- Optional limit parameter (default: all)

**Function: `getEmbeddingStats()`**

- Total items count
- Embedded items count (embeddedAt is not null)
- Unembedded items count
- Return as `{ total, embedded, unembedded, progress: embedded/total }`

**Function: `storeBatchEmbeddings(items: { id: string; embedding: number[] }[])`**

- Use raw SQL to store vectors in pgvector column (Prisma doesn't natively support vector operations)
- Batch SQL:
  ```sql
  UPDATE "FeedbackItem"
  SET embedding = $1::vector, "embeddedAt" = NOW()
  WHERE id = $2
  ```
- Execute in a transaction for atomicity
- Return count of updated items

**Function: `createBatches(items: any[], batchSize: number)`**

- Split items array into batches of `batchSize`
- Return array of batches
- Handle remainder batch (last batch may be smaller)

### 2. Build embedding worker (`packages/api/src/workers/embedding.worker.ts`)

```typescript
import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { aiService } from '../services/ai.service';
import { embeddingService } from '../services/embedding.service';
import { logger } from '../lib/logger';

const BATCH_SIZE = 100;

const embeddingWorker = new Worker(
  'embedding',
  async (job: Job) => {
    logger.info('Embedding worker started', { jobId: job.id });

    // 1. Fetch unembedded items
    const items = await embeddingService.getUnembeddedItems();

    if (items.length === 0) {
      logger.info('No unembedded items found');
      return { processed: 0, total: 0 };
    }

    // 2. Split into batches
    const batches = embeddingService.createBatches(items, BATCH_SIZE);
    let totalProcessed = 0;

    // 3. Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        // Generate embeddings via OpenAI
        const texts = batch.map((item) => item.content);
        const embeddings = await aiService.generateEmbeddings(texts);

        // Store embeddings in database
        const itemsWithEmbeddings = batch.map((item, idx) => ({
          id: item.id,
          embedding: embeddings[idx],
        }));
        await embeddingService.storeBatchEmbeddings(itemsWithEmbeddings);

        totalProcessed += batch.length;

        // Update job progress
        const progress = Math.round((totalProcessed / items.length) * 100);
        await job.updateProgress(progress);
        await job.log(`Batch ${i + 1}/${batches.length}: embedded ${batch.length} items`);
      } catch (err) {
        logger.error('Embedding batch failed', {
          batch: i + 1,
          error: err.message,
          itemIds: batch.map((b) => b.id),
        });
        // Continue with next batch — don't fail entire job for one batch
        await job.log(`Batch ${i + 1} FAILED: ${err.message}`);
      }
    }

    logger.info('Embedding worker completed', { totalProcessed, total: items.length });
    return { processed: totalProcessed, total: items.length };
  },
  {
    connection: redis,
    concurrency: 1, // Only one embedding job at a time
    limiter: { max: 1, duration: 1000 }, // Rate limit: 1 job per second
  },
);

embeddingWorker.on('completed', (job, result) => {
  logger.info('Embedding job completed', { jobId: job.id, result });
});

embeddingWorker.on('failed', (job, err) => {
  logger.error('Embedding job failed', { jobId: job?.id, error: err.message });
});

export { embeddingWorker };
```

### 3. Handle pgvector storage with raw SQL

Prisma does not natively support pgvector's `vector` type, so we need raw SQL:

```typescript
async function storeEmbedding(id: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`;
  await prisma.$executeRaw`
    UPDATE "FeedbackItem"
    SET embedding = ${vectorStr}::vector,
        "embeddedAt" = NOW()
    WHERE id = ${id}
  `;
}
```

For batch storage, use a transaction:

```typescript
async function storeBatchEmbeddings(items: { id: string; embedding: number[] }[]): Promise<void> {
  await prisma.$transaction(
    items.map((item) => {
      const vectorStr = `[${item.embedding.join(',')}]`;
      return prisma.$executeRaw`
        UPDATE "FeedbackItem"
        SET embedding = ${vectorStr}::vector,
            "embeddedAt" = NOW()
        WHERE id = ${item.id}
      `;
    }),
  );
}
```

### 4. Add embedding status to synthesis status endpoint

The orchestrator (Task 06) will call the embedding worker. But the embedding status should be queryable independently:

```typescript
// In synthesis routes or a dedicated endpoint
router.get('/status/embeddings', async (_req, res) => {
  const stats = await embeddingService.getEmbeddingStats();
  res.json({ data: stats });
});
```

### 5. Handle edge cases

- **Empty content**: Skip items with empty or whitespace-only content
- **Very long content**: Truncate to 8191 tokens (OpenAI embedding limit) — approximately 32K characters
- **Already embedded items**: Query only `WHERE embeddedAt IS NULL`
- **Partial failure**: Log failed items, continue with next batch, report partial success
- **API key not set**: Fail job immediately with clear error message

## Acceptance Criteria

- [ ] Worker processes all unembedded feedback items in batches of 100
- [ ] Embeddings stored as 1536-dimensional vectors in pgvector column
- [ ] `embeddedAt` timestamp set on successful embedding
- [ ] Already-embedded items are skipped (idempotent)
- [ ] Progress updates reported to BullMQ job (0-100%)
- [ ] Partial batch failure doesn't crash the entire job
- [ ] Failed items logged with IDs for debugging
- [ ] Worker runs with concurrency 1 (no parallel embedding jobs)
- [ ] `getEmbeddingStats()` returns correct embedded/total counts
- [ ] Token usage tracked for every API call
- [ ] Empty content items are skipped
- [ ] Very long content is truncated before embedding

## Complexity Estimate

**XL (Extra Large)** — Involves BullMQ worker lifecycle, pgvector raw SQL, batch processing, progress tracking, error handling, and OpenAI API integration. Most technically challenging backend task.

## Risk Factors & Mitigations

| Risk                                        | Impact                            | Mitigation                                                                                   |
| ------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| pgvector SQL injection via embedding values | Critical — security vulnerability | Use parameterized queries via `$executeRaw` template literals (Prisma escapes automatically) |
| OpenAI embedding API rate limit             | High — batch processing stalls    | Exponential backoff in aiService; 1 batch/second limiter on worker                           |
| Large dataset (10K items) takes too long    | Medium — user waits               | Show progress bar; process in background; allow cancellation                                 |
| Embedding dimensions mismatch               | High — queries fail later         | Assert response dimensions match AI_CONFIG.embeddingDimensions                               |
| Worker crashes and leaves orphaned job      | Medium — job stuck in active      | BullMQ stalledInterval + maxStalledCount handles recovery                                    |
| Transaction timeout on large batch          | Medium — embeddings lost          | Reduce transaction batch size to 50 if 100 causes timeouts                                   |
