import { z } from 'zod';

export const columnMappingSchema = z.object({
  content: z.string(),
  author: z.string().optional(),
  email: z.string().optional(),
  channel: z.string().optional(),
  date: z.string().optional(),
});

export type ColumnMapping = z.infer<typeof columnMappingSchema>;

export const importCSVSchema = z.object({
  columnMapping: columnMappingSchema.optional(),
});

export type ImportCSVInput = z.infer<typeof importCSVSchema>;

export const importJSONSchema = z.object({
  items: z
    .array(
      z.object({
        content: z.string().min(10, 'Content must be at least 10 characters'),
        author: z.string().optional(),
        email: z.string().email('Invalid email address').optional(),
        channel: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .min(1, 'At least one item is required')
    .max(10000, 'Cannot import more than 10000 items at once'),
});

export type ImportJSONInput = z.infer<typeof importJSONSchema>;
