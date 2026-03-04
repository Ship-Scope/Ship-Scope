import { z } from 'zod';

export const generateProposalsSchema = z.object({
  topN: z.coerce.number().int().min(1).max(100).default(20),
});

export const proposalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['proposed', 'approved', 'rejected', 'shipped']).optional(),
  themeId: z.string().optional(),
  sortBy: z
    .enum(['riceScore', 'createdAt', 'updatedAt', 'impactScore', 'effortScore'])
    .default('riceScore'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(200).optional(),
});

export const updateProposalSchema = z
  .object({
    title: z.string().min(3).max(150).optional(),
    problem: z.string().min(10).max(5000).optional(),
    solution: z.string().min(10).max(5000).optional(),
    status: z.enum(['proposed', 'approved', 'rejected', 'shipped']).optional(),
    reachScore: z.coerce.number().int().min(1).max(10).optional(),
    impactScore: z.coerce.number().int().min(1).max(10).optional(),
    confidenceScore: z.coerce.number().int().min(1).max(10).optional(),
    effortScore: z.coerce.number().int().min(1).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type GenerateProposalsInput = z.infer<typeof generateProposalsSchema>;
export type ProposalQueryInput = z.infer<typeof proposalQuerySchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
