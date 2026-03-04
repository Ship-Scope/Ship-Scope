import { buildThemeExtractionPrompt } from '@shipscope/core/prompts/synthesis';
import { type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { chatCompletion } from './ai.service';
import { type Cluster } from './clustering.service';

interface ThemeExtractionResult {
  name: string;
  description: string;
  category: string;
  painPoints: string[];
  suggestedUrgency: number;
}

/**
 * Extract themes from clusters by sending each cluster's feedback items to the LLM.
 * Creates Theme records and links feedback items to them.
 */
export async function extractThemes(
  clusters: Cluster[],
  onProgress?: (processed: number, total: number) => void,
): Promise<{ created: number; failed: number }> {
  // Delete existing themes and links before creating new ones (idempotent re-runs)
  await prisma.feedbackThemeLink.deleteMany();
  await prisma.theme.deleteMany();

  let created = 0;
  let failed = 0;

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];

    try {
      // Fetch feedback content for this cluster's items
      const feedbackItems = await prisma.feedbackItem.findMany({
        where: { id: { in: cluster.itemIds } },
        select: { id: true, content: true, sentiment: true, urgency: true },
      });

      const contents = feedbackItems.map((f) => f.content);
      const prompt = buildThemeExtractionPrompt(contents);

      const result = await chatCompletion<ThemeExtractionResult>(
        'You are a product feedback analyst. Respond with JSON only.',
        prompt,
      );

      // Compute aggregate stats
      const sentiments = feedbackItems
        .map((f) => f.sentiment)
        .filter((s): s is number => s !== null);
      const urgencies = feedbackItems.map((f) => f.urgency).filter((u): u is number => u !== null);
      const avgSentiment =
        sentiments.length > 0 ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;
      const avgUrgency =
        urgencies.length > 0 ? urgencies.reduce((a, b) => a + b, 0) / urgencies.length : 0;

      // Opportunity score: count * avgUrgency * (1 - avgSentiment)
      // Higher count + higher urgency + more negative sentiment = bigger opportunity
      const opportunityScore = feedbackItems.length * avgUrgency * (1 - avgSentiment);

      // Validate category
      const validCategories = [
        'bug',
        'feature_request',
        'ux_issue',
        'performance',
        'documentation',
        'pricing',
        'other',
      ];
      const category = validCategories.includes(result.category) ? result.category : 'other';

      // Create theme
      const theme = await prisma.theme.create({
        data: {
          name: result.name,
          description: result.description,
          category,
          painPoints: result.painPoints,
          feedbackCount: feedbackItems.length,
          avgSentiment,
          avgUrgency,
          opportunityScore,
        },
      });

      // Link feedback items to theme
      await prisma.feedbackThemeLink.createMany({
        data: feedbackItems.map((f) => ({
          feedbackItemId: f.id,
          themeId: theme.id,
          similarityScore: 1.0,
        })),
      });

      // Mark items as processed
      await prisma.feedbackItem.updateMany({
        where: { id: { in: cluster.itemIds } },
        data: { processedAt: new Date() },
      });

      created++;
    } catch (error) {
      logger.error('Theme extraction failed for cluster', {
        clusterId: cluster.id,
        itemCount: cluster.itemIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, clusters.length);
    }
  }

  logger.info('Theme extraction complete', { created, failed, total: clusters.length });
  return { created, failed };
}

/** Get all themes with pagination and optional filters. */
export async function getThemes(params: {
  page?: number;
  pageSize?: number;
  category?: string;
  sortBy?: 'opportunityScore' | 'feedbackCount' | 'avgSentiment' | 'avgUrgency' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ThemeWhereInput = {};
  if (params.category) {
    where.category = params.category;
  }

  const [themes, total] = await Promise.all([
    prisma.theme.findMany({
      where,
      include: {
        feedbackItems: {
          include: {
            feedbackItem: {
              select: { id: true, content: true, author: true, sentiment: true, urgency: true },
            },
          },
          take: 5,
          orderBy: { similarityScore: 'desc' },
        },
      },
      orderBy: { [params.sortBy || 'opportunityScore']: params.sortOrder || 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.theme.count({ where }),
  ]);

  return {
    data: themes,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/** Get a single theme with all linked feedback. */
export async function getThemeById(id: string) {
  return prisma.theme.findUnique({
    where: { id },
    include: {
      feedbackItems: {
        include: {
          feedbackItem: {
            select: {
              id: true,
              content: true,
              author: true,
              email: true,
              channel: true,
              sentiment: true,
              urgency: true,
              createdAt: true,
            },
          },
        },
        orderBy: { similarityScore: 'desc' },
      },
    },
  });
}
