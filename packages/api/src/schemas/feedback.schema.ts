import { z } from 'zod';

const channelEnum = z.enum([
  'support_ticket',
  'interview',
  'survey',
  'slack',
  'app_review',
  'manual',
  'other',
]);

export const createFeedbackSchema = z.object({
  content: z
    .string()
    .min(10, 'Content must be at least 10 characters')
    .max(10000, 'Content must not exceed 10000 characters'),
  author: z.string().max(200, 'Author must not exceed 200 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  channel: channelEnum.default('manual'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export const feedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  channel: channelEnum.optional(),
  sourceId: z.string().optional(),
  processed: z.enum(['true', 'false']).optional(),
  sentimentMin: z.coerce.number().optional(),
  sentimentMax: z.coerce.number().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['createdAt', 'sentiment', 'urgency']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type FeedbackQueryInput = z.infer<typeof feedbackQuerySchema>;

export const bulkDeleteSchema = z.object({
  ids: z
    .array(z.string())
    .min(1, 'At least one ID is required')
    .max(500, 'Cannot delete more than 500 items at once'),
});

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
