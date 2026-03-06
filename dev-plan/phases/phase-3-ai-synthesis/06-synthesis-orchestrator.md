# 06 — Synthesis Orchestrator

## Objective

Build the master pipeline that coordinates all 4 synthesis stages (embed → score → cluster → name themes) as a single BullMQ job with real-time status updates, configurable parameters, and a clean API for triggering, monitoring, and cancelling synthesis runs.

## Dependencies

- 02-embedding-worker (Stage 1: embeddings)
- 03-sentiment-urgency (Stage 2: scoring)
- 04-clustering-engine (Stage 3: clustering)
- 05-theme-extraction (Stage 4: theme naming)

## Files to Create

| File                                             | Purpose                             |
| ------------------------------------------------ | ----------------------------------- |
| `packages/api/src/services/synthesis.service.ts` | Pipeline orchestration logic        |
| `packages/api/src/workers/synthesis.worker.ts`   | BullMQ worker for the full pipeline |
| `packages/api/src/schemas/synthesis.schema.ts`   | Zod schemas for synthesis endpoints |

## Files to Modify

| File                                   | Changes                               |
| -------------------------------------- | ------------------------------------- |
| `packages/api/src/routes/synthesis.ts` | Replace stub with full route handlers |
| `packages/api/src/index.ts`            | Import and start synthesis worker     |

## Detailed Sub-Tasks

### 1. Define synthesis pipeline stages

```typescript
type SynthesisStage = 'embedding' | 'scoring' | 'clustering' | 'naming' | 'finalizing';

interface SynthesisConfig {
  similarityThreshold: number; // Default: 0.82 (range 0.7-0.95)
  minClusterSize: number; // Default: 1
  topThemesCount: number; // Default: 20 (for proposal generation later)
  skipEmbedding: boolean; // Skip if all items already embedded
  skipScoring: boolean; // Skip if all items already scored
}

interface SynthesisProgress {
  stage: SynthesisStage;
  stageProgress: number; // 0-100 within current stage
  overallProgress: number; // 0-100 across all stages
  message: string; // Human-readable status
  stats: {
    totalItems: number;
    embeddedItems: number;
    scoredItems: number;
    clustersFound: number;
    themesCreated: number;
  };
}
```

### 2. Build synthesis service (`packages/api/src/services/synthesis.service.ts`)

**Function: `triggerSynthesis(config?: Partial<SynthesisConfig>)`**

1. Check if a synthesis job is already running (prevent concurrent runs)
2. Merge config with defaults
3. Add job to synthesisQueue
4. Return jobId

**Function: `getSynthesisStatus()`**

1. Get active job from synthesisQueue
2. Get last completed job
3. Return: current status (idle/running/completed/failed), progress, last run timestamp

**Function: `cancelSynthesis()`**

1. Find active synthesis job
2. Remove from queue or signal worker to stop
3. Return success/failure

### 3. Build synthesis worker (`packages/api/src/workers/synthesis.worker.ts`)

```typescript
const synthesisWorker = new Worker(
  'synthesis',
  async (job: Job) => {
    const config: SynthesisConfig = {
      similarityThreshold: 0.82,
      minClusterSize: 1,
      topThemesCount: 20,
      skipEmbedding: false,
      skipScoring: false,
      ...job.data,
    };

    const updateProgress = async (
      stage: SynthesisStage,
      stageProgress: number,
      message: string,
    ) => {
      const stageWeights = {
        embedding: 30,
        scoring: 20,
        clustering: 20,
        naming: 25,
        finalizing: 5,
      };
      const stageStarts = { embedding: 0, scoring: 30, clustering: 50, naming: 70, finalizing: 95 };
      const overallProgress = stageStarts[stage] + (stageProgress / 100) * stageWeights[stage];
      await job.updateProgress(Math.round(overallProgress));
      await job.log(`[${stage}] ${message}`);
    };

    // ═══════════════════════════════════════════
    // STAGE 1: EMBEDDING
    // ═══════════════════════════════════════════
    await updateProgress('embedding', 0, 'Starting embedding generation...');

    if (!config.skipEmbedding) {
      const unembedded = await embeddingService.getUnembeddedItems();
      if (unembedded.length > 0) {
        const batches = embeddingService.createBatches(unembedded, 100);
        for (let i = 0; i < batches.length; i++) {
          const texts = batches[i].map((item) => item.content);
          const embeddings = await aiService.generateEmbeddings(texts);
          await embeddingService.storeBatchEmbeddings(
            batches[i].map((item, idx) => ({ id: item.id, embedding: embeddings[idx] })),
          );
          await updateProgress(
            'embedding',
            ((i + 1) / batches.length) * 100,
            `Embedded batch ${i + 1}/${batches.length}`,
          );
        }
      }
    }
    await updateProgress('embedding', 100, 'Embedding complete');

    // ═══════════════════════════════════════════
    // STAGE 2: SCORING
    // ═══════════════════════════════════════════
    await updateProgress('scoring', 0, 'Starting sentiment & urgency scoring...');

    if (!config.skipScoring) {
      await scoringService.scoreAllUnscored(async (pct) => {
        await updateProgress('scoring', pct, `Scoring feedback items... ${pct}%`);
      });
    }
    await updateProgress('scoring', 100, 'Scoring complete');

    // ═══════════════════════════════════════════
    // STAGE 3: CLUSTERING
    // ═══════════════════════════════════════════
    await updateProgress('clustering', 0, 'Clustering feedback by similarity...');

    const { ids, vectors } = await clusteringService.fetchEmbeddingsForClustering();
    const clusterResult = agglomerativeClustering(
      vectors,
      config.similarityThreshold,
      config.minClusterSize,
    );

    await updateProgress(
      'clustering',
      100,
      `Found ${clusterResult.stats.totalClusters} clusters (${clusterResult.stats.unclusteredCount} unclustered)`,
    );

    // ═══════════════════════════════════════════
    // STAGE 4: THEME NAMING
    // ═══════════════════════════════════════════
    await updateProgress('naming', 0, 'Extracting themes from clusters...');

    // Clear existing themes for fresh extraction
    await themeService.clearExistingThemes();

    const allFeedbackItems = await prisma.feedbackItem.findMany({
      where: { id: { in: ids } },
    });

    for (let i = 0; i < clusterResult.clusters.length; i++) {
      const cluster = clusterResult.clusters[i];
      const representativeIndices = findRepresentativeItems(vectors, cluster, 10);
      const representativeItems = representativeIndices.map((idx) => allFeedbackItems[idx]);
      const clusterItems = cluster.map((idx) => allFeedbackItems[idx]);

      const themeData = await themeService.extractThemeForCluster(
        clusterItems,
        representativeItems,
      );

      const scores = themeService.calculateThemeScores(clusterItems);

      const theme = await prisma.theme.create({
        data: {
          ...themeData,
          ...scores,
        },
      });

      await themeService.linkFeedbackToTheme(
        theme.id,
        ids,
        vectors,
        cluster,
        clusterResult.clusterCentroids[i],
      );

      await updateProgress(
        'naming',
        ((i + 1) / clusterResult.clusters.length) * 100,
        `Named theme ${i + 1}/${clusterResult.clusters.length}: "${themeData.name}"`,
      );
    }

    // Handle unclustered items
    if (clusterResult.unclustered.length > 0) {
      await themeService.createUncategorizedTheme(clusterResult.unclustered.map((idx) => ids[idx]));
    }

    // ═══════════════════════════════════════════
    // STAGE 5: FINALIZE
    // ═══════════════════════════════════════════
    await updateProgress('finalizing', 0, 'Finalizing synthesis...');

    // Mark all processed items
    await prisma.feedbackItem.updateMany({
      where: { id: { in: ids } },
      data: { processedAt: new Date() },
    });

    const usage = aiService.getUsage();

    await updateProgress('finalizing', 100, 'Synthesis complete');

    return {
      themesCreated: clusterResult.stats.totalClusters,
      itemsProcessed: ids.length,
      unclustered: clusterResult.stats.unclusteredCount,
      tokenUsage: usage,
    };
  },
  {
    connection: redis,
    concurrency: 1, // Only one synthesis at a time
  },
);
```

### 4. Create synthesis routes

```typescript
// POST /api/synthesis/run
// Body: { similarityThreshold?: number, minClusterSize?: number }
// Returns: { jobId: string }

// GET /api/synthesis/status
// Returns: SynthesisProgress | { status: 'idle', lastRun: string | null }

// GET /api/synthesis/themes
// Query: sortBy, sortOrder
// Returns: PaginatedResponse<Theme>

// GET /api/synthesis/themes/:id
// Returns: ThemeWithFeedback

// POST /api/synthesis/cancel
// Returns: { cancelled: boolean }
```

### 5. Create synthesis Zod schemas

```typescript
export const synthesisConfigSchema = z.object({
  similarityThreshold: z.number().min(0.7).max(0.95).default(0.82),
  minClusterSize: z.number().int().min(1).max(50).default(1),
});
```

### 6. Prevent concurrent synthesis runs

```typescript
async function isRunning(): Promise<boolean> {
  const active = await synthesisQueue.getActive();
  const waiting = await synthesisQueue.getWaiting();
  return active.length > 0 || waiting.length > 0;
}
```

Return 409 Conflict if synthesis is already running.

## Acceptance Criteria

- [ ] POST /api/synthesis/run triggers the full pipeline → returns jobId
- [ ] POST /api/synthesis/run returns 409 if synthesis already running
- [ ] GET /api/synthesis/status returns stage, progress (0-100), and stats during run
- [ ] GET /api/synthesis/status returns idle with lastRun timestamp when not running
- [ ] Pipeline executes all 4 stages in order: embed → score → cluster → name
- [ ] Each stage updates progress independently (weighted overall progress)
- [ ] Skips embedding for already-embedded items
- [ ] Skips scoring for already-scored items
- [ ] Clustering uses configurable similarity threshold
- [ ] Themes created with names, descriptions, categories, and scores
- [ ] Feedback items linked to themes with similarity scores
- [ ] Unclustered items placed in "Uncategorized" theme
- [ ] All processed items marked with processedAt timestamp
- [ ] Token usage tracked across entire pipeline
- [ ] POST /api/synthesis/cancel stops the running pipeline
- [ ] Concurrent synthesis prevented (409 response)
- [ ] Full pipeline for 200 seed items completes in <60 seconds

## Complexity Estimate

**XL (Extra Large)** — Coordinates 4 independent services, manages complex state, handles progress tracking across stages, and must be resilient to failures at any stage.

## Risk Factors & Mitigations

| Risk                                                      | Impact                        | Mitigation                                                               |
| --------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| Pipeline fails mid-way (e.g., clustering after embedding) | High — partial state          | Each stage is idempotent; re-running picks up where it left off          |
| Concurrent synthesis corrupts data                        | High — duplicate themes       | Check for active/waiting jobs before starting; return 409                |
| Memory spike during clustering (loading all embeddings)   | High — OOM crash              | Monitor memory; for V1 limit to 10K items; stream in batches later       |
| Cancel doesn't stop immediately (worker in API call)      | Medium — user confusion       | Signal cancellation via job data flag; check between batches             |
| Theme extraction LLM calls are slow (one per cluster)     | Medium — synthesis takes long | Process clusters in parallel (3-5 concurrent); show per-cluster progress |
