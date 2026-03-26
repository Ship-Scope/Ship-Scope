import { z } from 'zod';

export const linearConfigSchema = z.object({
  linear_api_key: z.string().min(1, 'Linear API key is required').optional(),
  linear_team_id: z.string().min(1).optional(),
  linear_project_id: z.string().min(1).optional(),
  linear_done_states: z.string().max(500).optional(),
  linear_default_label_id: z.string().min(1).optional(),
  linear_cycle_id: z.string().min(1).optional(),
  linear_webhook_secret: z.string().optional(),
});

export const linearImportSchema = z.object({
  projectId: z.string().min(1).optional(),
  stateType: z.enum(['backlog', 'unstarted', 'started', 'completed', 'cancelled']).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
});
