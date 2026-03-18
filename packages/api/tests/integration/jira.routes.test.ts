import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/index';
import { prisma } from '../setup';
import { createTheme, createProposal, createSpec, createJiraIssue } from '../helpers/factories';

// Mock global fetch for Jira API calls (external service)
function mockFetch(response: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

async function seedJiraConfig() {
  const settings = {
    jira_host: 'https://test.atlassian.net',
    jira_email: 'user@example.com',
    jira_api_token: 'test-api-token',
    jira_project_key: 'PROJ',
    jira_issue_type: 'Story',
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

const app = createApp();

describe('Jira Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── PUT /api/jira/config ──────────────────────────────

  describe('PUT /api/jira/config', () => {
    it('saves valid Jira config', async () => {
      const res = await request(app)
        .put('/api/jira/config')
        .send({
          jira_host: 'https://myco.atlassian.net',
          jira_email: 'admin@myco.com',
          jira_api_token: 'secret-token',
          jira_project_key: 'MC',
        })
        .expect(200);

      expect(res.body.data.saved).toBe(true);

      // Verify persisted
      const host = await prisma.setting.findUnique({ where: { key: 'jira_host' } });
      expect(host!.value).toBe('https://myco.atlassian.net');
    });

    it('accepts partial config', async () => {
      const res = await request(app)
        .put('/api/jira/config')
        .send({ jira_project_key: 'NEW' })
        .expect(200);

      expect(res.body.data.saved).toBe(true);
    });

    it('saves advanced config fields', async () => {
      const res = await request(app)
        .put('/api/jira/config')
        .send({
          jira_story_points_field: 'customfield_10016',
          jira_done_statuses: 'Deployed, Live',
          jira_epic_name_field: 'customfield_10011',
        })
        .expect(200);

      expect(res.body.data.saved).toBe(true);

      const spField = await prisma.setting.findUnique({
        where: { key: 'jira_story_points_field' },
      });
      expect(spField!.value).toBe('customfield_10016');

      const doneStatuses = await prisma.setting.findUnique({
        where: { key: 'jira_done_statuses' },
      });
      expect(doneStatuses!.value).toBe('Deployed, Live');
    });

    it('rejects non-HTTPS host', async () => {
      await request(app)
        .put('/api/jira/config')
        .send({ jira_host: 'http://insecure.atlassian.net' })
        .expect(400);
    });

    it('rejects invalid email', async () => {
      await request(app).put('/api/jira/config').send({ jira_email: 'not-an-email' }).expect(400);
    });
  });

  // ─── POST /api/jira/test ───────────────────────────────

  describe('POST /api/jira/test', () => {
    it('returns success when connection works', async () => {
      await seedJiraConfig();
      mockFetch({ serverTitle: 'Test Jira' });

      const res = await request(app).post('/api/jira/test').expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('Test Jira');
    });

    it('returns failure when not configured', async () => {
      const res = await request(app).post('/api/jira/test').expect(200);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.message).toContain('not configured');
    });
  });

  // ─── GET /api/jira/projects ────────────────────────────

  describe('GET /api/jira/projects', () => {
    it('returns project list', async () => {
      await seedJiraConfig();
      mockFetch([
        { id: '1', key: 'PROJ', name: 'Project' },
        { id: '2', key: 'DEV', name: 'Development' },
      ]);

      const res = await request(app).get('/api/jira/projects').expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].key).toBe('PROJ');
    });
  });

  // ─── GET /api/jira/issue-types ─────────────────────────

  describe('GET /api/jira/issue-types', () => {
    it('returns filtered issue types', async () => {
      await seedJiraConfig();
      mockFetch({
        issueTypes: [
          { id: '1', name: 'Story', subtask: false },
          { id: '2', name: 'Sub-task', subtask: true },
        ],
      });

      const res = await request(app).get('/api/jira/issue-types').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Story');
    });
  });

  // ─── GET /api/jira/priorities ──────────────────────────

  describe('GET /api/jira/priorities', () => {
    it('returns priorities from Jira', async () => {
      await seedJiraConfig();
      mockFetch([
        { id: '1', name: 'Highest' },
        { id: '2', name: 'High' },
        { id: '3', name: 'Medium' },
      ]);

      const res = await request(app).get('/api/jira/priorities').expect(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].name).toBe('Highest');
    });
  });

  // ─── GET /api/jira/fields ─────────────────────────────

  describe('GET /api/jira/fields', () => {
    it('returns custom fields from Jira', async () => {
      await seedJiraConfig();
      mockFetch([
        { id: 'customfield_10016', name: 'Story Points', custom: true },
        { id: 'summary', name: 'Summary', custom: false },
      ]);

      const res = await request(app).get('/api/jira/fields').expect(200);
      expect(res.body.data).toHaveLength(1); // only custom fields
      expect(res.body.data[0].id).toBe('customfield_10016');
    });
  });

  // ─── POST /api/jira/export/:proposalId ─────────────────

  describe('POST /api/jira/export/:proposalId', () => {
    it('exports proposal to Jira and returns 201', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      mockFetch({ id: '10001', key: 'PROJ-42', self: '' });

      const res = await request(app).post(`/api/jira/export/${proposal.id}`).expect(201);

      expect(res.body.data.jiraKey).toBe('PROJ-42');
      expect(res.body.data.jiraUrl).toContain('browse/PROJ-42');

      // Verify activity logged
      const activity = await prisma.activityLog.findFirst({
        where: { type: 'jira_export' },
      });
      expect(activity).not.toBeNull();
      expect(activity!.description).toContain('PROJ-42');
    });

    it('returns 400 for already exported proposal', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id);

      const res = await request(app).post(`/api/jira/export/${proposal.id}`).expect(400);

      expect(res.body.error).toContain('already exported');
    });

    it('returns 404 for non-existent proposal', async () => {
      await seedJiraConfig();
      mockFetch({});

      await request(app).post('/api/jira/export/nonexistent-id').expect(404);
    });
  });

  // ─── POST /api/jira/sync/:proposalId ───────────────────

  describe('POST /api/jira/sync/:proposalId', () => {
    it('syncs status from Jira', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id);

      mockFetch({
        id: '10001',
        key: 'PROJ-1',
        fields: {
          status: { name: 'In Progress' },
          summary: 'Updated',
          issuetype: { name: 'Story' },
        },
      });

      const res = await request(app).post(`/api/jira/sync/${proposal.id}`).expect(200);

      expect(res.body.data.status).toBe('In Progress');
    });

    it('returns 404 for unlinked proposal', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await request(app).post(`/api/jira/sync/${proposal.id}`).expect(404);
    });
  });

  // ─── GET /api/jira/issues ──────────────────────────────

  describe('GET /api/jira/issues', () => {
    it('returns empty list when nothing exported', async () => {
      const res = await request(app).get('/api/jira/issues').expect(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns exported issues with proposal data', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { title: 'My Feature' });
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-5' });

      const res = await request(app).get('/api/jira/issues').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].jiraKey).toBe('PROJ-5');
      expect(res.body.data[0].proposal.title).toBe('My Feature');
    });
  });

  // ─── GET /api/jira/issues/:proposalId ──────────────────

  describe('GET /api/jira/issues/:proposalId', () => {
    it('returns Jira issue for a proposal', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-99' });

      const res = await request(app).get(`/api/jira/issues/${proposal.id}`).expect(200);

      expect(res.body.data.jiraKey).toBe('PROJ-99');
    });

    it('returns null when no Jira issue is linked', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      const res = await request(app).get(`/api/jira/issues/${proposal.id}`).expect(200);

      expect(res.body.data).toBeNull();
    });
  });

  // ─── DELETE /api/jira/issues/:proposalId ───────────────

  describe('DELETE /api/jira/issues/:proposalId', () => {
    it('unlinks Jira issue and returns 204', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id);

      await request(app).delete(`/api/jira/issues/${proposal.id}`).expect(204);

      const issue = await prisma.jiraIssue.findUnique({ where: { proposalId: proposal.id } });
      expect(issue).toBeNull();
    });

    it('returns 404 when no link exists', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await request(app).delete(`/api/jira/issues/${proposal.id}`).expect(404);
    });
  });

  // ─── POST /api/jira/export-theme/:themeId ──────────────

  describe('POST /api/jira/export-theme/:themeId', () => {
    it('exports theme as epic with stories', async () => {
      await seedJiraConfig();
      const theme = await createTheme({ name: 'Perf Theme' });
      await createProposal(theme.id, { title: 'Story 1' });

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: `${callCount}`,
              key: callCount === 1 ? 'PROJ-EPIC' : `PROJ-S${callCount}`,
              self: '',
            }),
          text: () => Promise.resolve(''),
        } as Response;
      });

      const res = await request(app).post(`/api/jira/export-theme/${theme.id}`).expect(201);

      expect(res.body.data.epicKey).toBe('PROJ-EPIC');
      expect(res.body.data.storiesCreated).toBe(1);

      // Verify activity logged
      const activity = await prisma.activityLog.findFirst({
        where: { type: 'jira_export' },
      });
      expect(activity).not.toBeNull();
      expect(activity!.description).toContain('Epic');
    });

    it('returns 400 for theme with existing epic', async () => {
      await seedJiraConfig();
      const theme = await createTheme({ jiraEpicKey: 'PROJ-OLD' });

      const res = await request(app).post(`/api/jira/export-theme/${theme.id}`).expect(400);

      expect(res.body.error).toContain('already exported');
    });
  });

  // ─── POST /api/jira/attach-spec/:proposalId ───────────

  describe('POST /api/jira/attach-spec/:proposalId', () => {
    it('attaches spec as Jira comment', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-10' });
      await createSpec(proposal.id);
      mockFetch({});

      const res = await request(app).post(`/api/jira/attach-spec/${proposal.id}`).expect(200);

      expect(res.body.data.jiraKey).toBe('PROJ-10');
      expect(res.body.data.commented).toBe(true);
    });

    it('returns 404 when no Jira issue linked', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await request(app).post(`/api/jira/attach-spec/${proposal.id}`).expect(404);
    });

    it('returns 400 when no spec exists', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id);

      await request(app).post(`/api/jira/attach-spec/${proposal.id}`).expect(400);
    });
  });

  // ─── POST /api/jira/import-feedback ────────────────────

  describe('POST /api/jira/import-feedback', () => {
    it('imports Jira issues as feedback with 201', async () => {
      await seedJiraConfig();
      mockFetch({
        issues: [
          {
            key: 'PROJ-100',
            fields: {
              summary: 'Bug report',
              description: null,
              issuetype: { name: 'Bug' },
              reporter: { displayName: 'Alice' },
              created: '2024-01-01T00:00:00.000Z',
              labels: [],
              status: { name: 'Open' },
            },
          },
        ],
        total: 1,
      });

      const res = await request(app)
        .post('/api/jira/import-feedback')
        .send({ jql: 'project = PROJ', maxResults: 10 })
        .expect(201);

      expect(res.body.data.imported).toBe(1);
      expect(res.body.data.skipped).toBe(0);

      // Verify activity logged
      const activity = await prisma.activityLog.findFirst({
        where: { type: 'import' },
      });
      expect(activity).not.toBeNull();
      expect(activity!.description).toContain('Jira');
    });

    it('handles empty results', async () => {
      await seedJiraConfig();
      mockFetch({ issues: [], total: 0 });

      const res = await request(app).post('/api/jira/import-feedback').send({}).expect(201);

      expect(res.body.data.imported).toBe(0);
    });
  });

  // ─── POST /api/jira/sync-all ───────────────────────────

  describe('POST /api/jira/sync-all', () => {
    it('syncs all linked issues', async () => {
      await seedJiraConfig();
      const theme = await createTheme();
      const p1 = await createProposal(theme.id);
      const p2 = await createProposal(theme.id);
      await createJiraIssue(p1.id, { jiraKey: 'PROJ-1' });
      await createJiraIssue(p2.id, { jiraKey: 'PROJ-2' });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const key = String(url).includes('PROJ-1') ? 'PROJ-1' : 'PROJ-2';
        return {
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: '1',
              key,
              fields: { status: { name: 'Done' }, summary: `${key} done` },
            }),
          text: () => Promise.resolve(''),
        } as Response;
      });

      const res = await request(app).post('/api/jira/sync-all').expect(200);

      expect(res.body.data.synced).toBe(2);
      expect(res.body.data.autoShipped).toBe(2);
    });

    it('returns zeros when nothing to sync', async () => {
      await seedJiraConfig();

      const res = await request(app).post('/api/jira/sync-all').expect(200);

      expect(res.body.data.synced).toBe(0);
      expect(res.body.data.errors).toBe(0);
    });
  });

  // ─── POST /api/jira/webhook ────────────────────────────

  describe('POST /api/jira/webhook', () => {
    it('processes webhook for tracked issue', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createJiraIssue(proposal.id, { jiraKey: 'PROJ-50' });

      const res = await request(app)
        .post('/api/jira/webhook')
        .send({
          webhookEvent: 'jira:issue_updated',
          issue: {
            key: 'PROJ-50',
            fields: { status: { name: 'In Review' }, summary: 'Updated' },
          },
        })
        .expect(200);

      expect(res.body.data.processed).toBe(true);
    });

    it('ignores untracked issues', async () => {
      const res = await request(app)
        .post('/api/jira/webhook')
        .send({
          issue: {
            key: 'UNKNOWN-1',
            fields: { status: { name: 'Done' }, summary: 'Unknown' },
          },
        })
        .expect(200);

      expect(res.body.data.processed).toBe(false);
    });

    it('ignores empty payload', async () => {
      const res = await request(app).post('/api/jira/webhook').send({}).expect(200);

      expect(res.body.data.processed).toBe(false);
    });
  });

  // ─── GET /api/jira/dashboard ───────────────────────────

  describe('GET /api/jira/dashboard', () => {
    it('returns empty summary', async () => {
      const res = await request(app).get('/api/jira/dashboard').expect(200);

      expect(res.body.data.totalExported).toBe(0);
      expect(res.body.data.byStatus).toEqual({});
      expect(res.body.data.recentExports).toEqual([]);
      expect(res.body.data.epicCount).toBe(0);
    });

    it('returns populated summary', async () => {
      const theme = await createTheme({ jiraEpicKey: 'PROJ-EPIC' });
      const p1 = await createProposal(theme.id);
      const p2 = await createProposal(theme.id);
      await createJiraIssue(p1.id, { jiraKey: 'PROJ-1', status: 'To Do' });
      await createJiraIssue(p2.id, { jiraKey: 'PROJ-2', status: 'Done' });

      const res = await request(app).get('/api/jira/dashboard').expect(200);

      expect(res.body.data.totalExported).toBe(2);
      expect(res.body.data.byStatus['To Do']).toBe(1);
      expect(res.body.data.byStatus['Done']).toBe(1);
      expect(res.body.data.recentExports).toHaveLength(2);
      expect(res.body.data.epicCount).toBe(1);
    });
  });
});
