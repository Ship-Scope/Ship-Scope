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
  jira_story_points_field: z.string().max(100).optional(),
  jira_done_statuses: z.string().max(500).optional(),
  jira_epic_name_field: z.string().max(100).optional(),
});
