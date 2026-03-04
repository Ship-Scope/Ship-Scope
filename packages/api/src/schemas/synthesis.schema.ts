import { z } from 'zod';

export const themesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  sortBy: z
    .enum(['opportunityScore', 'feedbackCount', 'avgSentiment', 'avgUrgency', 'createdAt'])
    .default('opportunityScore'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ThemesQueryParams = z.infer<typeof themesQuerySchema>;
