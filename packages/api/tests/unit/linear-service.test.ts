import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../setup';
import { createTheme, createProposal, createLinearIssue } from '../helpers/factories';
import { linearService, LINEAR_SETTING_KEYS } from '../../src/services/linear.service';

// Helper to seed Linear config settings in the database
async function seedLinearConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    [LINEAR_SETTING_KEYS.LINEAR_API_KEY]: 'lin_api_test_key_123',
    [LINEAR_SETTING_KEYS.LINEAR_TEAM_ID]: 'team-001',
    [LINEAR_SETTING_KEYS.LINEAR_PROJECT_ID]: 'project-001',
    [LINEAR_SETTING_KEYS.LINEAR_DONE_STATES]: 'Done,Cancelled',
    [LINEAR_SETTING_KEYS.LINEAR_DEFAULT_LABEL_ID]: 'label-001',
    [LINEAR_SETTING_KEYS.LINEAR_CYCLE_ID]: 'cycle-001',
    ...overrides,
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

// Mock global fetch for Linear GraphQL API calls
function mockFetch(response: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

describe('Linear Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── testConnection ─────────────────────────────────────

  describe('testConnection', () => {
    it('returns success when Linear API responds', async () => {
      await seedLinearConfig();
      mockFetch({
        data: { viewer: { id: 'u1', name: 'Test User', email: 'test@example.com' } },
      });

      const result = await linearService.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test User');
      expect(result.userName).toBe('Test User');
    });

    it('returns failure when Linear is not configured', async () => {
      const result = await linearService.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('returns failure when Linear API rejects credentials', async () => {
      await seedLinearConfig();
      mockFetch({ errors: [{ message: 'Authentication required' }] });

      const result = await linearService.testConnection();
      expect(result.success).toBe(false);
    });
  });

  // ─── listTeams ──────────────────────────────────────────

  describe('listTeams', () => {
    it('returns mapped team list', async () => {
      await seedLinearConfig();
      mockFetch({
        data: {
          teams: {
            nodes: [
              { id: 't1', name: 'Engineering', key: 'ENG' },
              { id: 't2', name: 'Product', key: 'PRD' },
            ],
          },
        },
      });

      const teams = await linearService.listTeams();
      expect(teams).toHaveLength(2);
      expect(teams[0]).toEqual({ id: 't1', name: 'Engineering', key: 'ENG' });
    });

    it('throws when not configured', async () => {
      await expect(linearService.listTeams()).rejects.toThrow();
    });
  });

  // ─── listProjects ───────────────────────────────────────

  describe('listProjects', () => {
    it('returns project list', async () => {
      await seedLinearConfig();
      mockFetch({
        data: {
          team: {
            projects: {
              nodes: [
                {
                  id: 'p1',
                  name: 'Project Alpha',
                  url: 'https://linear.app/team/project/p1',
                  state: 'started',
                },
              ],
            },
          },
        },
      });

      const projects = await linearService.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Project Alpha');
    });

    it('throws when no team configured', async () => {
      await seedLinearConfig({ [LINEAR_SETTING_KEYS.LINEAR_TEAM_ID]: '' });
      await expect(linearService.listProjects()).rejects.toThrow();
    });
  });

  // ─── exportProposal ─────────────────────────────────────

  describe('exportProposal', () => {
    it('exports a proposal as a Linear issue', async () => {
      await seedLinearConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });

      mockFetch({
        data: {
          issueCreate: {
            success: true,
            issue: {
              id: 'lin-issue-001',
              identifier: 'ENG-42',
              url: 'https://linear.app/team/issue/ENG-42',
              title: proposal.title,
              state: { name: 'Backlog' },
              priority: 3,
            },
          },
        },
      });

      const result = await linearService.exportProposal(proposal.id);
      expect(result.identifier).toBe('ENG-42');
      expect(result.linearUrl).toContain('ENG-42');

      // Verify DB record created
      const dbRecord = await prisma.linearIssue.findUnique({
        where: { proposalId: proposal.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.identifier).toBe('ENG-42');
      expect(dbRecord!.linearId).toBe('lin-issue-001');
    });

    it('throws when proposal already exported', async () => {
      await seedLinearConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createLinearIssue(proposal.id);

      await expect(linearService.exportProposal(proposal.id)).rejects.toThrow('already exported');
    });

    it('throws when proposal not found', async () => {
      await seedLinearConfig();
      await expect(linearService.exportProposal('nonexistent-id')).rejects.toThrow();
    });
  });

  // ─── syncStatus ─────────────────────────────────────────

  describe('syncStatus', () => {
    it('syncs status from Linear API', async () => {
      await seedLinearConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createLinearIssue(proposal.id);

      mockFetch({
        data: {
          issue: {
            state: { name: 'In Progress' },
            priority: 2,
          },
        },
      });

      const result = await linearService.syncStatus(proposal.id);
      expect(result.status).toBe('In Progress');

      const dbRecord = await prisma.linearIssue.findUnique({
        where: { proposalId: proposal.id },
      });
      expect(dbRecord!.status).toBe('In Progress');
    });

    it('throws when no linked issue', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await expect(linearService.syncStatus(proposal.id)).rejects.toThrow();
    });
  });

  // ─── getByProposal ─────────────────────────────────────

  describe('getByProposal', () => {
    it('returns linked linear issue', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createLinearIssue(proposal.id, { identifier: 'ENG-99' });

      const issue = await linearService.getByProposal(proposal.id);
      expect(issue).not.toBeNull();
      expect(issue!.identifier).toBe('ENG-99');
    });

    it('returns null when no linked issue', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      const issue = await linearService.getByProposal(proposal.id);
      expect(issue).toBeNull();
    });
  });

  // ─── unlink ─────────────────────────────────────────────

  describe('unlink', () => {
    it('removes the linear issue link', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createLinearIssue(proposal.id);

      await linearService.unlink(proposal.id);

      const issue = await prisma.linearIssue.findUnique({
        where: { proposalId: proposal.id },
      });
      expect(issue).toBeNull();
    });

    it('throws when no linked issue', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await expect(linearService.unlink(proposal.id)).rejects.toThrow();
    });
  });

  // ─── listExported ───────────────────────────────────────

  describe('listExported', () => {
    it('returns all exported issues with proposal data', async () => {
      const theme = await createTheme();
      const p1 = await createProposal(theme.id, { title: 'Proposal 1' });
      const p2 = await createProposal(theme.id, { title: 'Proposal 2' });
      await createLinearIssue(p1.id, { identifier: 'ENG-1', linearId: 'lin-1' });
      await createLinearIssue(p2.id, { identifier: 'ENG-2', linearId: 'lin-2' });

      const issues = await linearService.listExported();
      expect(issues).toHaveLength(2);
    });

    it('returns empty array when no exported issues', async () => {
      const issues = await linearService.listExported();
      expect(issues).toEqual([]);
    });
  });

  // ─── getDashboardSummary ────────────────────────────────

  describe('getDashboardSummary', () => {
    it('returns summary with counts', async () => {
      const theme = await createTheme();
      const p1 = await createProposal(theme.id);
      const p2 = await createProposal(theme.id);
      await createLinearIssue(p1.id, {
        identifier: 'ENG-10',
        linearId: 'lin-10',
        status: 'In Progress',
        priority: 2,
      });
      await createLinearIssue(p2.id, {
        identifier: 'ENG-11',
        linearId: 'lin-11',
        status: 'Done',
        priority: 1,
      });

      const summary = await linearService.getDashboardSummary();
      expect(summary.totalExported).toBe(2);
      expect(Object.keys(summary.byStatus)).toHaveLength(2);
    });

    it('returns empty summary when no issues', async () => {
      const summary = await linearService.getDashboardSummary();
      expect(summary.totalExported).toBe(0);
      expect(Object.keys(summary.byStatus)).toEqual([]);
    });
  });
});
