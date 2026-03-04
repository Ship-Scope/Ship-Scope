import { z } from 'zod';

export const agentPromptQuerySchema = z.object({
  format: z.enum(['cursor', 'claude_code']).default('cursor'),
});

export type AgentPromptQueryInput = z.infer<typeof agentPromptQuerySchema>;
