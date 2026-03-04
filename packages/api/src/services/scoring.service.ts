import { buildScoringPrompt } from '@shipscope/core/prompts/synthesis';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { chatCompletion } from './ai.service';

const SCORING_BATCH_SIZE = 20;

interface ScoringResult {
  scores: { index: number; sentiment: number; urgency: number }[];
}

export interface ScoringProgress {
  total: number;
  processed: number;
  percentage: number;
}

/**
 * Score unscored feedback items for sentiment and urgency using LLM.
 * Processes in batches of 20 items per API call.
 */
export async function scoreFeedbackItems(
  onProgress?: (progress: ScoringProgress) => void,
): Promise<{ scored: number; failed: number }> {
  const items = await prisma.feedbackItem.findMany({
    where: { sentiment: null },
    select: { id: true, content: true },
    orderBy: { createdAt: 'asc' },
  });

  if (items.length === 0) {
    return { scored: 0, failed: 0 };
  }

  let scored = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += SCORING_BATCH_SIZE) {
    const batch = items.slice(i, i + SCORING_BATCH_SIZE);

    try {
      const prompt = buildScoringPrompt(batch);
      const result = await chatCompletion<ScoringResult>(
        'You are a product feedback analyst. Respond with JSON only.',
        prompt,
      );

      // Update each item with scores
      for (const score of result.scores) {
        const item = batch[score.index];
        if (!item) continue;

        // Clamp values to valid ranges
        const sentiment = Math.max(-1, Math.min(1, score.sentiment));
        const urgency = Math.max(0, Math.min(1, score.urgency));

        await prisma.feedbackItem.update({
          where: { id: item.id },
          data: { sentiment, urgency },
        });
        scored++;
      }
    } catch (error) {
      logger.error('Scoring batch failed', {
        batchStart: i,
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
      failed += batch.length;
    }

    if (onProgress) {
      onProgress({
        total: items.length,
        processed: scored + failed,
        percentage: Math.round(((scored + failed) / items.length) * 100),
      });
    }
  }

  logger.info('Scoring complete', { scored, failed, total: items.length });
  return { scored, failed };
}
