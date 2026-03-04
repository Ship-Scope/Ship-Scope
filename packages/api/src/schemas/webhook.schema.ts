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

export const webhookItemSchema = z.object({
  content: z
    .string()
    .min(10, 'Content must be at least 10 characters')
    .max(10000, 'Content must not exceed 10000 characters'),
  author: z.string().max(200, 'Author must not exceed 200 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  channel: channelEnum.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type WebhookItemInput = z.infer<typeof webhookItemSchema>;

export const webhookPayloadSchema = z.union([
  webhookItemSchema,
  z
    .array(webhookItemSchema)
    .min(1, 'At least one item is required')
    .max(100, 'Cannot exceed 100 items per request'),
]);

export type WebhookPayloadInput = z.infer<typeof webhookPayloadSchema>;

export const createApiKeySchema = z.object({
  name: z.string().max(100, 'Name must not exceed 100 characters').optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
