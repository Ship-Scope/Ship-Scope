import { describe, it, expect } from 'vitest';
import { exportToJiraSchema, jiraConfigSchema } from '../../src/schemas/jira.schema';

describe('Jira Schemas', () => {
  describe('exportToJiraSchema', () => {
    it('accepts valid proposal ID', () => {
      const result = exportToJiraSchema.safeParse({ proposalId: 'abc-123' });
      expect(result.success).toBe(true);
    });

    it('rejects empty proposal ID', () => {
      const result = exportToJiraSchema.safeParse({ proposalId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing proposal ID', () => {
      const result = exportToJiraSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('jiraConfigSchema', () => {
    it('accepts valid full config', () => {
      const result = jiraConfigSchema.safeParse({
        jira_host: 'https://mycompany.atlassian.net',
        jira_email: 'user@example.com',
        jira_api_token: 'abc123token',
        jira_project_key: 'PROJ',
        jira_issue_type: 'Story',
      });
      expect(result.success).toBe(true);
    });

    it('accepts partial config (all fields optional)', () => {
      const result = jiraConfigSchema.safeParse({
        jira_host: 'https://mycompany.atlassian.net',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = jiraConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects non-HTTPS host', () => {
      const result = jiraConfigSchema.safeParse({
        jira_host: 'http://mycompany.atlassian.net',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('HTTPS');
      }
    });

    it('rejects invalid URL for host', () => {
      const result = jiraConfigSchema.safeParse({
        jira_host: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = jiraConfigSchema.safeParse({
        jira_email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty API token', () => {
      const result = jiraConfigSchema.safeParse({
        jira_api_token: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects project key longer than 20 chars', () => {
      const result = jiraConfigSchema.safeParse({
        jira_project_key: 'A'.repeat(21),
      });
      expect(result.success).toBe(false);
    });

    it('rejects issue type longer than 50 chars', () => {
      const result = jiraConfigSchema.safeParse({
        jira_issue_type: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
    });
  });
});
