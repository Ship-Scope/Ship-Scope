import { z } from 'zod';

export const exportToJiraSchema = z.object({
  proposalId: z.string().min(1, 'Proposal ID is required'),
});

export const jiraConfigSchema = z.object({
  jira_host: z
    .string()
    .url('Must be a valid URL')
    .refine((url) => url.startsWith('https://'), 'Jira host must use HTTPS')
    .optional(),
  jira_email: z.string().email('Must be a valid email').optional(),
  jira_api_token: z.string().min(1).optional(),
  jira_project_key: z.string().min(1).max(20).optional(),
  jira_issue_type: z.string().min(1).max(50).optional(),
});
