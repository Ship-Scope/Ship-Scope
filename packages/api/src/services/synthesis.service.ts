import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { synthesisQueue } from '../lib/queue';
import { logger } from '../lib/logger';
import { embedFeedbackItems, getEmbeddedItems } from './embedding.service';
import { scoreFeedbackItems } from './scoring.service';
import { agglomerativeCluster } from './clustering.service';
import { extractThemes } from './theme.service';
import { activityService } from './activity.service';

const SYNTHESIS_STATUS_KEY = 'synthesis:status';

export interface SynthesisJobStatus {
  jobId: string;
  status: 'idle' | 'embedding' | 'scoring' | 'clustering' | 'naming' | 'completed' | 'failed';
  progress: number;
  stage: string;
  totalItems: number;
  processedItems: number;
  themesFound: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

const STAGE_WEIGHTS = {
  embedding: 0.3,
  scoring: 0.2,
  clustering: 0.2,
  naming: 0.25,
  finalize: 0.05,
};

/** Update the synthesis status in Redis. */
export async function updateStatus(status: Partial<SynthesisJobStatus>) {
  const current = await getStatus();
  const updated = { ...current, ...status };
  await redis.set(SYNTHESIS_STATUS_KEY, JSON.stringify(updated), 'EX', 86400);
  return updated;
}

/** Get current synthesis status from Redis. */
export async function getStatus(): Promise<SynthesisJobStatus> {
  const raw = await redis.get(SYNTHESIS_STATUS_KEY);
  if (!raw) {
    return {
      jobId: '',
      status: 'idle',
      progress: 0,
      stage: 'Idle',
      totalItems: 0,
      processedItems: 0,
      themesFound: 0,
      startedAt: null,
      completedAt: null,
      error: null,
    };
  }
  return JSON.parse(raw) as SynthesisJobStatus;
}

/** Enqueue a synthesis job. Prevents concurrent runs with 409. */
export async function triggerSynthesis(): Promise<{ jobId: string }> {
  const current = await getStatus();
  const activeStatuses = ['embedding', 'scoring', 'clustering', 'naming'];
  if (activeStatuses.includes(current.status)) {
    throw Object.assign(new Error('Synthesis already in progress'), { statusCode: 409 });
  }

  // Count unprocessed items
  const totalItems = await prisma.feedbackItem.count();

  const job = await synthesisQueue.add('run-synthesis', {
    triggeredAt: new Date().toISOString(),
  });

  await updateStatus({
    jobId: job.id!,
    status: 'embedding',
    progress: 0,
    stage: 'Generating embeddings',
    totalItems,
    processedItems: 0,
    themesFound: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  });

  return { jobId: job.id! };
}

/**
 * Run the full synthesis pipeline. Called by the BullMQ worker.
 * Stages: embed → score → cluster → name → finalize
 */
export async function runSynthesisPipeline(jobId: string): Promise<void> {
  try {
    // Stage 1: Embedding
    await updateStatus({ status: 'embedding', stage: 'Generating embeddings', progress: 0 });
    const embedResult = await embedFeedbackItems((p) => {
      const progress = Math.round(p.percentage * STAGE_WEIGHTS.embedding);
      updateStatus({ progress, processedItems: p.processed });
    });
    logger.info('Synthesis: embedding done', embedResult);

    const baseProgress = STAGE_WEIGHTS.embedding * 100;

    // Stage 2: Scoring
    await updateStatus({
      status: 'scoring',
      stage: 'Analyzing sentiment & urgency',
      progress: Math.round(baseProgress),
    });
    const scoreResult = await scoreFeedbackItems((p) => {
      const progress = Math.round(baseProgress + p.percentage * STAGE_WEIGHTS.scoring);
      updateStatus({ progress });
    });
    logger.info('Synthesis: scoring done', scoreResult);

    const postScoreProgress = (STAGE_WEIGHTS.embedding + STAGE_WEIGHTS.scoring) * 100;

    // Stage 3: Clustering
    await updateStatus({
      status: 'clustering',
      stage: 'Clustering similar feedback',
      progress: Math.round(postScoreProgress),
    });
    const embeddedItems = await getEmbeddedItems();
    const clusters = agglomerativeCluster(
      embeddedItems.map((item) => ({ id: item.id, embedding: item.embedding })),
      0.65, // Lowered from 0.82 — seed data similarity peaks at ~0.74
    );
    logger.info('Synthesis: clustering done', { clusters: clusters.length });

    const postClusterProgress =
      (STAGE_WEIGHTS.embedding + STAGE_WEIGHTS.scoring + STAGE_WEIGHTS.clustering) * 100;

    // Stage 4: Theme extraction (naming)
    await updateStatus({
      status: 'naming',
      stage: 'Extracting themes',
      progress: Math.round(postClusterProgress),
      themesFound: clusters.length,
    });
    const themeResult = await extractThemes(clusters, (processed, total) => {
      const progress = Math.round(
        postClusterProgress + (processed / total) * STAGE_WEIGHTS.naming * 100,
      );
      updateStatus({ progress });
    });
    logger.info('Synthesis: theme extraction done', themeResult);

    // Stage 5: Finalize
    await updateStatus({
      status: 'completed',
      stage: 'Complete',
      progress: 100,
      themesFound: themeResult.created,
      completedAt: new Date().toISOString(),
    });

    logger.info('Synthesis pipeline completed', {
      jobId,
      embedded: embedResult.embedded,
      scored: scoreResult.scored,
      clusters: clusters.length,
      themes: themeResult.created,
    });

    await activityService.log({
      type: 'synthesis',
      description: `Synthesis complete: ${themeResult.created} themes discovered from ${embedResult.embedded} items`,
      metadata: { themeCount: themeResult.created, feedbackCount: embedResult.embedded },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Synthesis pipeline failed', { jobId, error: errorMessage });
    await updateStatus({
      status: 'failed',
      stage: 'Failed',
      error: errorMessage,
    });
    throw error;
  }
}
