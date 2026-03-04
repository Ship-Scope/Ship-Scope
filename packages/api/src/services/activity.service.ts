import { type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type ActivityType = 'import' | 'synthesis' | 'proposal_generation' | 'spec_generation';

interface LogActivityInput {
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}

export const activityService = {
  /**
   * Record an activity event. Fire-and-forget — errors are logged
   * but never propagated to the caller.
   */
  async log(input: LogActivityInput): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          type: input.type,
          description: input.description,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      console.error('[ActivityService] Failed to log activity:', err);
    }
  },

  /**
   * Fetch the most recent N activity entries.
   */
  async getRecent(limit: number = 10) {
    return prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    });
  },
};
