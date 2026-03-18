import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../setup';
import {
  createTheme,
  createProposal,
  createSpec,
  createFeedbackSource,
  createFeedbackItem,
  createJiraIssue,
} from '../helpers/factories';
import { jiraService, JIRA_SETTING_KEYS } from '../../src/services/jira.service';

// Helper to seed Jira config settings in the database
async function seedJiraConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    [JIRA_SETTING_KEYS.JIRA_HOST]: 'https://test.atlassian.net',
    [JIRA_SETTING_KEYS.JIRA_EMAIL]: 'user@example.com',
    [JIRA_SETTING_KEYS.JIRA_API_TOKEN]: 'test-api-token',
    [JIRA_SETTING_KEYS.JIRA_PROJECT_KEY]: 'PROJ',
    [JIRA_SETTING_KEYS.JIRA_ISSUE_TYPE]: 'Story',
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

// Mock global fetch for Jira API calls
function mockFetch(response: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

describe('Jira Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── testConnection ─────────────────────────────────────

  describe('testConnection', () => {
    it('returns success when Jira API responds', async () => {
      await seedJiraConfig();
      mockFetch({ serverTitle: 'My Jira', baseUrl: 'https://test.atlassian.net' });

      const result = await jiraService.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('My Jira');
      expect(result.serverTitle).toBe('My Jira');
    });

    it('returns failure when Jira is not configured', async () => {
      // No config saved - getJiraConfig should throw
      const result = await jiraService.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('returns failure when Jira API rejects credentials', async () => {
      await seedJiraConfig();
      mockFetch({ message: 'Unauthorized' }, 401);

      const result = await jiraService.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('401');
    });
  });

  // ─── listProjects ──────────────────────────────────────

  describe('listProjects', () => {
    it('returns mapped project list', async () => {
      await seedJiraConfig();
      mockFetch([
        { id: '1', key: 'PROJ', name: 'Project One', extra: 'ignored' },
        { id: '2', key: 'DEV', name: 'Dev Project' },
      ]);

      const projects = await jiraService.listProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({ id: '1', key: 'PROJ', name: 'Project One' });
      expect(projects[1]).toEqual({ id: '2', key: 'DEV', name: 'Dev Project' });
    });

    it('throws when not configured', async () => {
      await expect(jiraService.listProjects()).rejects.toThrow('not configured');
    });
  });

  // ─── listIssueTypes ────────────────────────────────────

  describe('listIssueTypes', () => {
    it('returns non-subtask issue types', async () => {
      await seedJiraConfig();
      mockFetch({
        issueTypes: [
          { id: '1', name: 'Story', subtask: false },
          { id: '2', name: 'Sub-task', subtask: true },
          { id: '3', name: 'Bug', subtask: false },
        ],
      });

      const types = await jiraService.listIssueTypes();
      expect(types).toHaveLength(2);
      expect(types.map((t) => t.name)).toEqual(['Story', 'Bug']);
    });

    it('throws when no project key configured', async () => {
      await seedJiraConfig({ [JIRA_SETTING_KEYS.JIRA_PROJECT_KEY]: '' });
      await expect(jiraService.listIssueTypes()).rejects.toThrow('project key');
    });
  });

  // ─── listPriorities ────────────────────────────────────

  describe('listPriorities', () => {
    it('returns priorities from Jira', async () => {
      await seedJiraConfig();
      mockFetch([
        { id: '1', name: 'Highest', iconUrl: 'url' },
        { id: '2', name: 'High', iconUrl: 'url' },
        { id: '3', name: 'Medium', iconUrl: 'url' },
      ]);

      const priorities = await jiraService.listPriorities();
      expect(priorities).toHaveLength(3);
      expect(priorities[0].name).toBe('Highest');
    });
  });

  // ─── listFields ────────────────────────────────────────

  describe('listFields', () => {
    it('returns custom fields and story point fields', async () => {
      await seedJiraConfig();
      mockFetch([
        { id: 'summary', name: 'Summary', custom: false },
        { id: 'customfield_10016', name: 'Story Points', custom: true },
        { id: 'customfield_10020', name: 'Sprint', custom: true },
        { id: 'story_points', name: 'Story point estimate', custom: false },
      ]);

      const fields = await jiraService.listFields();
      // Should return custom fields + any field matching "story point"
      expect(fields.length).toBeGreaterThanOrEqual(3);
      expect(fields.find((f) => f.id === 'customfield_10016')).toBeTruthy();
      expect(fields.find((f) => f.id === 'story_points')).toBeTruthy();
    });
  });

  // ─── exportProposal ────────────────────────────────────

  describe('exportProposal', () => {
    it('creates a Jira issue and stores the link', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      // 1. Create issue
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: '10001',
            key: 'PROJ-42',
            self: 'https://test.atlassian.net/rest/api/3/issue/10001',
          }),
        text: () => Promise.resolve(''),
      } as Response);
      // 2. Remote link (backlink)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 1 }),
        text: () => Promise.resolve(''),
      } as Response);

      const result = await jiraService.exportProposal(proposal.id);
      expect(result.jiraKey).toBe('PROJ-42');
      expect(result.jiraUrl).toBe('https://test.atlassian.net/browse/PROJ-42');

      // Verify persisted in DB
      const stored = await prisma.jiraIssue.findUnique({ where: { proposalId: proposal.id } });
      expect(stored).not.toBeNull();
      expect(stored!.jiraKey).toBe('PROJ-42');
      expect(stored!.status).toBe('To Do');
    });

    it('throws when proposal is already exported', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id);

      await expect(jiraService.exportProposal(proposal.id)).rejects.toThrow('already exported');
    });

    it('throws when proposal not found', async () => {
      await seedJiraConfig();
      await expect(jiraService.exportProposal('nonexistent-id')).rejects.toThrow('not found');
    });

    it('throws when no project key configured', async () => {
      await seedJiraConfig({ [JIRA_SETTING_KEYS.JIRA_PROJECT_KEY]: '' });
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await expect(jiraService.exportProposal(proposal.id)).rejects.toThrow('project key');
    });

    it('sends correct request with RICE labels, priority, and story points', async () => {
      await seedJiraConfig();
      const theme = await createTheme({ name: 'Performance Issues', category: 'performance' });
      const proposal = await createProposal(theme.id, {
        title: 'Optimize Database Queries',
        problem: 'Slow queries',
        solution: 'Add indexes',
        riceScore: 9.0,
        reachScore: 8,
        impactScore: 9,
        confidenceScore: 8,
        effortScore: 3,
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      // 1. Create issue
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: '10001', key: 'PROJ-1', self: '' }),
        text: () => Promise.resolve(''),
      } as Response);
      // 2. Create remote link (backlink)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 1 }),
        text: () => Promise.resolve(''),
      } as Response);

      await jiraService.exportProposal(proposal.id);

      // Verify issue creation payload
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://test.atlassian.net/rest/api/3/issue');
      expect(options?.method).toBe('POST');

      const body = JSON.parse(options?.body as string);
      expect(body.fields.project.key).toBe('PROJ');
      expect(body.fields.summary).toBe('Optimize Database Queries');
      expect(body.fields.issuetype.name).toBe('Story');
      expect(body.fields.labels).toContain('shipscope');
      expect(body.fields.labels).toContain('rice-high');
      expect(body.fields.labels).toContain('theme-performance-issues');
      expect(body.fields.labels).toContain('category-performance');
      expect(body.fields.story_points).toBe(3); // effort 3 → 3 story points

      // Verify remote link was created
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [linkUrl] = fetchSpy.mock.calls[1];
      expect(linkUrl).toContain('/remotelink');
    });

    it('uses custom story points field when configured', async () => {
      await seedJiraConfig({ [JIRA_SETTING_KEYS.JIRA_STORY_POINTS_FIELD]: 'customfield_10016' });
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { effortScore: 5 });

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: '10002', key: 'PROJ-2', self: '' }),
        text: () => Promise.resolve(''),
      } as Response);
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 2 }),
        text: () => Promise.resolve(''),
      } as Response);

      await jiraService.exportProposal(proposal.id);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body.fields.customfield_10016).toBe(8); // effort 5 → 8 story points
      expect(body.fields.story_points).toBeUndefined();
    });
  });

  // ─── syncStatus ────────────────────────────────────────

  describe('syncStatus', () => {
    it('updates local issue status from Jira', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id, { status: 'To Do' });

      mockFetch({
        id: '10001',
        key: 'PROJ-1',
        fields: {
          status: { name: 'In Progress' },
          summary: 'Updated Summary',
          issuetype: { name: 'Story' },
        },
      });

      const result = await jiraService.syncStatus(proposal.id);
      expect(result.status).toBe('In Progress');

      const updated = await prisma.jiraIssue.findUnique({ where: { proposalId: proposal.id } });
      expect(updated!.status).toBe('In Progress');
      expect(updated!.summary).toBe('Updated Summary');
      expect(updated!.syncedAt).not.toBeNull();
    });

    it('throws when no Jira issue is linked', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await expect(jiraService.syncStatus(proposal.id)).rejects.toThrow('not found');
    });
  });

  // ─── getByProposal ────────────────────────────────────

  describe('getByProposal', () => {
    it('returns Jira issue when linked', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-99' });

      const issue = await jiraService.getByProposal(proposal.id);
      expect(issue).not.toBeNull();
      expect(issue!.jiraKey).toBe('PROJ-99');
    });

    it('returns null when no link exists', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      const issue = await jiraService.getByProposal(proposal.id);
      expect(issue).toBeNull();
    });
  });

  // ─── listExported ──────────────────────────────────────

  describe('listExported', () => {
    it('returns empty array when nothing exported', async () => {
      const issues = await jiraService.listExported();
      expect(issues).toEqual([]);
    });

    it('returns exported issues with proposal data', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { title: 'My Proposal' });
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-5' });

      const issues = await jiraService.listExported();
      expect(issues).toHaveLength(1);
      expect(issues[0].jiraKey).toBe('PROJ-5');
      expect(issues[0].proposal.title).toBe('My Proposal');
    });

    it('returns issues ordered by creation date descending', async () => {
      const theme = await createTheme();
      const p1 = await createProposal(theme.id, { title: 'First' });
      const p2 = await createProposal(theme.id, { title: 'Second' });
      const older = new Date('2024-01-01');
      const newer = new Date('2024-06-01');
      await createJiraIssue(p1.id, { jiraKey: 'PROJ-1', createdAt: older });
      await createJiraIssue(p2.id, { jiraKey: 'PROJ-2', createdAt: newer });

      const issues = await jiraService.listExported();
      expect(issues).toHaveLength(2);
      // Most recent first
      expect(issues[0].jiraKey).toBe('PROJ-2');
    });
  });

  // ─── unlink ────────────────────────────────────────────

  describe('unlink', () => {
    it('deletes the Jira issue link', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id);

      await jiraService.unlink(proposal.id);

      const issue = await prisma.jiraIssue.findUnique({ where: { proposalId: proposal.id } });
      expect(issue).toBeNull();
    });

    it('throws when no link exists', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await expect(jiraService.unlink(proposal.id)).rejects.toThrow('not found');
    });
  });

  // ─── exportThemeAsEpic ─────────────────────────────────

  describe('exportThemeAsEpic', () => {
    it('creates an epic and stories for proposals', async () => {
      await seedJiraConfig();
      const theme = await createTheme({ name: 'Dashboard Redesign' });
      await createProposal(theme.id, { title: 'Widget A' });
      await createProposal(theme.id, { title: 'Widget B' });

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        const key = callCount === 1 ? 'PROJ-EPIC-1' : `PROJ-${callCount}`;
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: `1000${callCount}`, key, self: '' }),
          text: () => Promise.resolve(''),
        } as Response;
      });

      const result = await jiraService.exportThemeAsEpic(theme.id);
      expect(result.epicKey).toBe('PROJ-EPIC-1');
      expect(result.epicUrl).toBe('https://test.atlassian.net/browse/PROJ-EPIC-1');
      expect(result.storiesCreated).toBe(2);
      expect(result.storiesSkipped).toBe(0);

      // Verify theme updated
      const updatedTheme = await prisma.theme.findUnique({ where: { id: theme.id } });
      expect(updatedTheme!.jiraEpicKey).toBe('PROJ-EPIC-1');
      expect(updatedTheme!.jiraEpicUrl).toBe('https://test.atlassian.net/browse/PROJ-EPIC-1');

      // Verify stories created in DB
      const issues = await prisma.jiraIssue.findMany();
      expect(issues).toHaveLength(2);
      expect(issues.every((i) => i.epicKey === 'PROJ-EPIC-1')).toBe(true);
    });

    it('skips proposals already exported', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const alreadyExported = await createProposal(theme.id, { title: 'Already Exported' });
      await createProposal(theme.id, { title: 'New One' });
      await createJiraIssue(alreadyExported.id, { jiraKey: 'PROJ-OLD' });

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        const key = callCount === 1 ? 'PROJ-EPIC' : `PROJ-NEW-${callCount}`;
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: `2000${callCount}`, key, self: '' }),
          text: () => Promise.resolve(''),
        } as Response;
      });

      const result = await jiraService.exportThemeAsEpic(theme.id);
      expect(result.storiesCreated).toBe(1);
      expect(result.storiesSkipped).toBe(1);
    });

    it('throws when theme already has an epic', async () => {
      await seedJiraConfig();
      const theme = await createTheme({ jiraEpicKey: 'PROJ-EPIC-EXISTING' });

      await expect(jiraService.exportThemeAsEpic(theme.id)).rejects.toThrow('already exported');
    });

    it('throws when theme not found', async () => {
      await seedJiraConfig();
      await expect(jiraService.exportThemeAsEpic('nonexistent')).rejects.toThrow('not found');
    });
  });

  // ─── attachSpec ────────────────────────────────────────

  describe('attachSpec', () => {
    it('posts spec as comment to Jira issue', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-10' });
      await createSpec(proposal.id, { prdMarkdown: '# Test PRD\n\nContent here', version: 2 });

      const fetchSpy = mockFetch({});

      const result = await jiraService.attachSpec(proposal.id);
      expect(result.jiraKey).toBe('PROJ-10');
      expect(result.commented).toBe(true);

      // Verify API call
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toContain('/issue/PROJ-10/comment');
      expect(options?.method).toBe('POST');
      const body = JSON.parse(options?.body as string);
      expect(body.body.type).toBe('doc');
    });

    it('throws when no Jira issue is linked', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await expect(jiraService.attachSpec(proposal.id)).rejects.toThrow('No Jira issue');
    });

    it('throws when no spec exists', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id);

      await expect(jiraService.attachSpec(proposal.id)).rejects.toThrow('No spec');
    });
  });

  // ─── importFeedbackFromJira ────────────────────────────

  describe('importFeedbackFromJira', () => {
    it('imports issues as feedback items', async () => {
      await seedJiraConfig();
      mockFetch({
        issues: [
          {
            key: 'PROJ-100',
            fields: {
              summary: 'Bug in login',
              description: null,
              issuetype: { name: 'Bug' },
              reporter: { displayName: 'Jane Doe', emailAddress: 'jane@test.com' },
              created: '2024-01-01T00:00:00.000Z',
              labels: ['customer'],
              status: { name: 'Open' },
            },
          },
          {
            key: 'PROJ-101',
            fields: {
              summary: 'Feature request for dashboard',
              description: {
                type: 'doc',
                version: 1,
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'We need charts.' }] },
                ],
              },
              issuetype: { name: 'Story' },
              reporter: { displayName: 'John', emailAddress: 'john@test.com' },
              created: '2024-01-02T00:00:00.000Z',
              labels: [],
              status: { name: 'Backlog' },
            },
          },
        ],
        total: 2,
      });

      const result = await jiraService.importFeedbackFromJira();
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.sourceId).toBeDefined();

      // Verify feedback items created
      const items = await prisma.feedbackItem.findMany({ orderBy: { createdAt: 'asc' } });
      expect(items).toHaveLength(2);
      expect(items[0].content).toContain('PROJ-100');
      expect(items[0].content).toContain('Bug in login');
      expect(items[0].author).toBe('Jane Doe');
      expect(items[0].channel).toBe('jira_bug');

      expect(items[1].content).toContain('We need charts.');
      expect(items[1].channel).toBe('jira_story');

      // Verify source created
      const source = await prisma.feedbackSource.findUnique({ where: { id: result.sourceId } });
      expect(source).not.toBeNull();
      expect(source!.type).toBe('jira');
      expect(source!.rowCount).toBe(2);
    });

    it('skips already imported issues', async () => {
      await seedJiraConfig();

      // Create an already-imported feedback item
      const source = await createFeedbackSource({ type: 'jira' });
      await createFeedbackItem(source.id, {
        content: '[PROJ-100] Bug in login',
        metadata: { jira_key: 'PROJ-100' },
      });

      mockFetch({
        issues: [
          {
            key: 'PROJ-100',
            fields: {
              summary: 'Bug in login',
              description: null,
              issuetype: { name: 'Bug' },
              reporter: null,
              created: '2024-01-01T00:00:00.000Z',
              labels: [],
              status: { name: 'Open' },
            },
          },
        ],
        total: 1,
      });

      const result = await jiraService.importFeedbackFromJira();
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('uses custom JQL when provided', async () => {
      await seedJiraConfig();
      const fetchSpy = mockFetch({ issues: [], total: 0 });

      await jiraService.importFeedbackFromJira({ jql: 'labels = "customer-request"' });

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body.jql).toBe('labels = "customer-request"');
    });

    it('caps maxResults at 100', async () => {
      await seedJiraConfig();
      const fetchSpy = mockFetch({ issues: [], total: 0 });

      await jiraService.importFeedbackFromJira({ maxResults: 500 });

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body.maxResults).toBe(100);
    });

    it('throws when no project key configured', async () => {
      await seedJiraConfig({ [JIRA_SETTING_KEYS.JIRA_PROJECT_KEY]: '' });
      await expect(jiraService.importFeedbackFromJira()).rejects.toThrow('project key');
    });
  });

  // ─── handleWebhook ────────────────────────────────────

  describe('handleWebhook', () => {
    it('updates status for a tracked issue', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-50', status: 'To Do' });

      const result = await jiraService.handleWebhook({
        webhookEvent: 'jira:issue_updated',
        issue: {
          key: 'PROJ-50',
          fields: { status: { name: 'In Review' }, summary: 'Updated title' },
        },
      });

      expect(result.processed).toBe(true);
      expect(result.jiraKey).toBe('PROJ-50');

      const updated = await prisma.jiraIssue.findUnique({ where: { jiraKey: 'PROJ-50' } });
      expect(updated!.status).toBe('In Review');
      expect(updated!.summary).toBe('Updated title');
    });

    it('auto-ships proposal when Jira status is Done', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-60' });

      await jiraService.handleWebhook({
        issue: {
          key: 'PROJ-60',
          fields: { status: { name: 'Done' }, summary: 'Completed' },
        },
      });

      const updatedProposal = await prisma.proposal.findUnique({ where: { id: proposal.id } });
      expect(updatedProposal!.status).toBe('shipped');
    });

    it('auto-ships for other done-like statuses', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-70' });

      await jiraService.handleWebhook({
        issue: {
          key: 'PROJ-70',
          fields: { status: { name: 'Resolved' }, summary: 'Fixed' },
        },
      });

      const updatedProposal = await prisma.proposal.findUnique({ where: { id: proposal.id } });
      expect(updatedProposal!.status).toBe('shipped');
    });

    it('does not auto-ship if already shipped', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'shipped' });
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-80' });

      const result = await jiraService.handleWebhook({
        issue: {
          key: 'PROJ-80',
          fields: { status: { name: 'Done' }, summary: 'Already done' },
        },
      });

      expect(result.processed).toBe(true);
      // Status should remain shipped (no extra update)
      const updatedProposal = await prisma.proposal.findUnique({ where: { id: proposal.id } });
      expect(updatedProposal!.status).toBe('shipped');
    });

    it('auto-ships using custom done statuses', async () => {
      // Configure custom done statuses
      await seedJiraConfig({
        [JIRA_SETTING_KEYS.JIRA_DONE_STATUSES]: 'Deployed, Live in Production',
      });
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-CUSTOM' });

      await jiraService.handleWebhook({
        issue: {
          key: 'PROJ-CUSTOM',
          fields: { status: { name: 'Deployed' }, summary: 'Custom done' },
        },
      });

      const updatedProposal = await prisma.proposal.findUnique({ where: { id: proposal.id } });
      expect(updatedProposal!.status).toBe('shipped');
    });

    it('ignores untracked issues', async () => {
      const result = await jiraService.handleWebhook({
        issue: {
          key: 'UNKNOWN-1',
          fields: { status: { name: 'Done' }, summary: 'Not tracked' },
        },
      });

      expect(result.processed).toBe(false);
    });

    it('ignores payloads without issue key', async () => {
      const result = await jiraService.handleWebhook({});
      expect(result.processed).toBe(false);
    });
  });

  // ─── getDashboardSummary ───────────────────────────────

  describe('getDashboardSummary', () => {
    it('returns empty summary when nothing exported', async () => {
      const summary = await jiraService.getDashboardSummary();
      expect(summary.totalExported).toBe(0);
      expect(summary.byStatus).toEqual({});
      expect(summary.recentExports).toEqual([]);
      expect(summary.epicCount).toBe(0);
    });

    it('returns correct counts and status breakdown', async () => {
      const theme = await createTheme();
      const p1 = await createProposal(theme.id);
      const p2 = await createProposal(theme.id);
      const p3 = await createProposal(theme.id);
      await createJiraIssue(p1.id, { jiraKey: 'PROJ-A', status: 'To Do' });
      await createJiraIssue(p2.id, { jiraKey: 'PROJ-B', status: 'In Progress' });
      await createJiraIssue(p3.id, { jiraKey: 'PROJ-C', status: 'To Do' });

      const summary = await jiraService.getDashboardSummary();
      expect(summary.totalExported).toBe(3);
      expect(summary.byStatus['To Do']).toBe(2);
      expect(summary.byStatus['In Progress']).toBe(1);
      expect(summary.recentExports).toHaveLength(3);
    });

    it('counts epics from themes', async () => {
      await createTheme({
        jiraEpicKey: 'PROJ-EPIC-1',
        jiraEpicUrl: 'https://test.atlassian.net/browse/PROJ-EPIC-1',
      });
      await createTheme({
        jiraEpicKey: 'PROJ-EPIC-2',
        jiraEpicUrl: 'https://test.atlassian.net/browse/PROJ-EPIC-2',
      });
      await createTheme(); // no epic

      const summary = await jiraService.getDashboardSummary();
      expect(summary.epicCount).toBe(2);
    });

    it('limits recent exports to 5', async () => {
      const theme = await createTheme();
      for (let i = 0; i < 7; i++) {
        const p = await createProposal(theme.id);
        await createJiraIssue(p.id, { jiraKey: `PROJ-${i}` });
      }

      const summary = await jiraService.getDashboardSummary();
      expect(summary.totalExported).toBe(7);
      expect(summary.recentExports).toHaveLength(5);
    });
  });
});
