import { prisma } from '../lib/prisma';

interface EntityStat {
  total: number;
  currentWeek: number;
  previousWeek: number;
  trendPercent: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export interface DashboardStats {
  feedback: EntityStat;
  themes: EntityStat;
  proposals: EntityStat;
  specs: EntityStat;
}

function buildEntityStat(total: number, current: number, previous: number): EntityStat {
  let trendPercent = 0;
  if (previous === 0 && current > 0) {
    trendPercent = 100;
  } else if (previous === 0 && current === 0) {
    trendPercent = 0;
  } else if (previous > 0) {
    trendPercent = Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  const trendDirection: EntityStat['trendDirection'] =
    trendPercent > 0 ? 'up' : trendPercent < 0 ? 'down' : 'flat';

  return { total, currentWeek: current, previousWeek: previous, trendPercent, trendDirection };
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      feedbackTotal,
      feedbackCurrent,
      feedbackPrevious,
      themesTotal,
      themesCurrent,
      themesPrevious,
      proposalsTotal,
      proposalsCurrent,
      proposalsPrevious,
      specsTotal,
      specsCurrent,
      specsPrevious,
    ] = await Promise.all([
      prisma.feedbackItem.count(),
      prisma.feedbackItem.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.feedbackItem.count({
        where: { createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
      }),
      prisma.theme.count(),
      prisma.theme.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.theme.count({ where: { createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
      prisma.proposal.count(),
      prisma.proposal.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.proposal.count({
        where: { createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
      }),
      prisma.spec.count(),
      prisma.spec.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.spec.count({ where: { createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
    ]);

    return {
      feedback: buildEntityStat(feedbackTotal, feedbackCurrent, feedbackPrevious),
      themes: buildEntityStat(themesTotal, themesCurrent, themesPrevious),
      proposals: buildEntityStat(proposalsTotal, proposalsCurrent, proposalsPrevious),
      specs: buildEntityStat(specsTotal, specsCurrent, specsPrevious),
    };
  },

  async getTopThemes(limit: number = 5) {
    return prisma.theme.findMany({
      orderBy: { feedbackCount: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        feedbackCount: true,
        category: true,
      },
    });
  },

  async getSentimentDistribution() {
    const [stats] = await prisma.$queryRaw<
      { avg_sentiment: number; negative: bigint; neutral: bigint; positive: bigint }[]
    >`
      SELECT
        COALESCE(AVG(sentiment), 0) as avg_sentiment,
        COUNT(*) FILTER (WHERE sentiment IS NOT NULL AND sentiment < -0.3) as negative,
        COUNT(*) FILTER (WHERE sentiment IS NOT NULL AND sentiment >= -0.3 AND sentiment <= 0.3) as neutral,
        COUNT(*) FILTER (WHERE sentiment IS NOT NULL AND sentiment > 0.3) as positive
      FROM "FeedbackItem"
      WHERE sentiment IS NOT NULL
    `;

    return {
      average: Number(stats.avg_sentiment),
      negative: Number(stats.negative),
      neutral: Number(stats.neutral),
      positive: Number(stats.positive),
      total: Number(stats.negative) + Number(stats.neutral) + Number(stats.positive),
    };
  },
};
