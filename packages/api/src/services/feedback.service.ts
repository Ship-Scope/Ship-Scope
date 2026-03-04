import { type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFound } from '../lib/errors';
import { type CreateFeedbackInput, type FeedbackQueryInput } from '../schemas/feedback.schema';

export const feedbackService = {
  async create(input: CreateFeedbackInput) {
    const content = input.content.trim();

    const source = await prisma.feedbackSource.upsert({
      where: { id: 'manual-entry' },
      update: {},
      create: {
        id: 'manual-entry',
        name: 'Manual Entry',
        type: 'manual',
      },
    });

    const item = await prisma.feedbackItem.create({
      data: {
        content,
        sourceId: source.id,
        author: input.author,
        email: input.email,
        channel: input.channel,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return item;
  },

  async findById(id: string) {
    const item = await prisma.feedbackItem.findUnique({
      where: { id },
      include: {
        source: true,
        themes: {
          include: {
            theme: true,
          },
        },
      },
    });

    if (!item) {
      throw NotFound('Feedback item');
    }

    return item;
  },

  async list(params: FeedbackQueryInput) {
    const {
      page,
      pageSize,
      search,
      channel,
      sourceId,
      processed,
      sentimentMin,
      sentimentMax,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    } = params;

    const where: Prisma.FeedbackItemWhereInput = {};

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    if (channel) {
      where.channel = channel;
    }

    if (sourceId) {
      where.sourceId = sourceId;
    }

    if (processed === 'true') {
      where.processedAt = { not: null };
    } else if (processed === 'false') {
      where.processedAt = null;
    }

    if (sentimentMin !== undefined || sentimentMax !== undefined) {
      where.sentiment = {};
      if (sentimentMin !== undefined) {
        where.sentiment.gte = sentimentMin;
      }
      if (sentimentMax !== undefined) {
        where.sentiment.lte = sentimentMax;
      }
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    const orderBy: Prisma.FeedbackItemOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      prisma.feedbackItem.findMany({
        where,
        include: {
          source: { select: { name: true, type: true } },
          themes: {
            include: {
              theme: { select: { id: true, name: true, category: true } },
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.feedbackItem.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async delete(id: string) {
    const item = await prisma.feedbackItem.findUnique({ where: { id } });

    if (!item) {
      throw NotFound('Feedback item');
    }

    await prisma.feedbackThemeLink.deleteMany({
      where: { feedbackItemId: id },
    });

    await prisma.proposalEvidence.deleteMany({
      where: { feedbackItemId: id },
    });

    const deleted = await prisma.feedbackItem.delete({
      where: { id },
    });

    return deleted;
  },

  async bulkDelete(ids: string[]) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.feedbackThemeLink.deleteMany({
        where: { feedbackItemId: { in: ids } },
      });

      await tx.proposalEvidence.deleteMany({
        where: { feedbackItemId: { in: ids } },
      });

      const deleted = await tx.feedbackItem.deleteMany({
        where: { id: { in: ids } },
      });

      return deleted;
    });

    return { count: result.count };
  },

  async getStats() {
    const [total, processed, unprocessed, byChannel, aggregates] = await Promise.all([
      prisma.feedbackItem.count(),
      prisma.feedbackItem.count({ where: { processedAt: { not: null } } }),
      prisma.feedbackItem.count({ where: { processedAt: null } }),
      prisma.feedbackItem.groupBy({
        by: ['channel'],
        _count: { id: true },
      }),
      prisma.feedbackItem.aggregate({
        _avg: {
          sentiment: true,
          urgency: true,
        },
      }),
    ]);

    return {
      total,
      processed,
      unprocessed,
      byChannel: byChannel.map((entry) => ({
        channel: entry.channel,
        count: entry._count.id,
      })),
      averages: {
        sentiment: aggregates._avg.sentiment,
        urgency: aggregates._avg.urgency,
      },
    };
  },

  async checkDuplicate(content: string, author?: string, sourceId?: string): Promise<boolean> {
    const where: Prisma.FeedbackItemWhereInput = { content };

    if (author) {
      where.author = author;
    }

    if (sourceId) {
      where.sourceId = sourceId;
    }

    const existing = await prisma.feedbackItem.findFirst({ where });

    return existing !== null;
  },

  async markAsProcessed(ids: string[]) {
    const result = await prisma.feedbackItem.updateMany({
      where: { id: { in: ids } },
      data: { processedAt: new Date() },
    });

    return { count: result.count };
  },
};
