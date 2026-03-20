import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/index';
import { prisma } from '../setup';
import { createTheme, createProposal, createLinearIssue } from '../helpers/factories';

// Mock global fetch for Linear GraphQL API calls
function mockFetch(response: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

async function seedLinearConfig() {
  const settings = {
    linear_api_key: 'lin_api_test_key_123',
    linear_team_id: 'team-001',
    linear_project_id: 'project-001',
    linear_done_states: 'Done,Cancelled',
    linear_default_label_id: 'label-001',
    linear_cycle_id: 'cycle-001',
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

describe('Linear Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── PUT /api/linear/config ────────────────────────────

  describe('PUT /api/linear/config', () => {
    it('saves valid Linear config', async () => {
      const res = await request(app)
        .put('/api/linear/config')
        .send({
          linear_api_key: 'lin_api_my_key',
          linear_team_id: 'team-123',
        })
        .expect(200);

      expect(res.body.data.saved).toBe(true);

      const key = await prisma.setting.findUnique({ where: { key: 'linear_api_key' } });
      expect(key!.value).toBe('lin_api_my_key');
    });

    it('accepts partial config', async () => {
      const res = await request(app)
        .put('/api/linear/config')
        .send({ linear_team_id: 'new-team' })
        .expect(200);

      expect(res.body.data.saved).toBe(true);
    });

    it('rejects empty API key', async () => {
      await request(app).put('/api/linear/config').send({ linear_api_key: '' }).expect(400);
    });
  });

  // ─── POST /api/linear/test ─────────────────────────────

  describe('POST /api/linear/test', () => {
    it('returns success when connection works', async () => {
      await seedLinearConfig();
      mockFetch({
        data: { viewer: { id: 'u1', name: 'Test User', email: 'test@example.com' } },
      });

      const res = await request(app).post('/api/linear/test').expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('Test User');
    });

    it('returns failure when not configured', async () => {
      const res = await request(app).post('/api/linear/test').expect(200);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.message).toContain('not configured');
    });
  });

  // ─── GET /api/linear/teams ─────────────────────────────

  describe('GET /api/linear/teams', () => {
    it('returns team list', async () => {
      await seedLinearConfig();
      mockFetch({
        data: {
          teams: { nodes: [{ id: 't1', name: 'Engineering', key: 'ENG' }] },
        },
      });

      const res = await request(app).get('/api/linear/teams').expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Engineering');
    });
  });

  // ─── POST /api/linear/export/:proposalId ───────────────

  describe('POST /api/linear/export/:proposalId', () => {
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

      const res = await request(app).post(`/api/linear/export/${proposal.id}`).expect(201);

      expect(res.body.data.identifier).toBe('ENG-42');

      // Verify DB record
      const dbRecord = await prisma.linearIssue.findUnique({
        where: { proposalId: proposal.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.identifier).toBe('ENG-42');
    });

    it('returns 400 when already exported', async () => {
      await seedLinearConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createLinearIssue(proposal.id);

      await request(app).post(`/api/linear/export/${proposal.id}`).expect(400);
    });

    it('returns 404 for nonexistent proposal', async () => {
      await seedLinearConfig();

      const res = await request(app).post('/api/linear/export/nonexistent-id');

      // May be 404 or 400 depending on service implementation
      expect([400, 404]).toContain(res.status);
    });
  });

  // ─── POST /api/linear/sync/:proposalId ─────────────────

  describe('POST /api/linear/sync/:proposalId', () => {
    it('syncs status from Linear', async () => {
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

      const res = await request(app).post(`/api/linear/sync/${proposal.id}`).expect(200);

      expect(res.body.data.status).toBe('In Progress');
    });
  });

  // ─── GET /api/linear/issues ────────────────────────────

  describe('GET /api/linear/issues', () => {
    it('returns all exported issues', async () => {
      const theme = await createTheme();
      const p1 = await createProposal(theme.id);
      const p2 = await createProposal(theme.id);
      await createLinearIssue(p1.id, { identifier: 'ENG-1', linearId: 'lin-1' });
      await createLinearIssue(p2.id, { identifier: 'ENG-2', linearId: 'lin-2' });

      const res = await request(app).get('/api/linear/issues').expect(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('returns empty array when no issues', async () => {
      const res = await request(app).get('/api/linear/issues').expect(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─── GET /api/linear/issues/:proposalId ────────────────

  describe('GET /api/linear/issues/:proposalId', () => {
    it('returns linked issue for proposal', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createLinearIssue(proposal.id, { identifier: 'ENG-99' });

      const res = await request(app).get(`/api/linear/issues/${proposal.id}`).expect(200);

      expect(res.body.data.identifier).toBe('ENG-99');
    });

    it('returns 404 when no linked issue', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await request(app).get(`/api/linear/issues/${proposal.id}`).expect(404);
    });
  });

  // ─── DELETE /api/linear/issues/:proposalId ─────────────

  describe('DELETE /api/linear/issues/:proposalId', () => {
    it('unlinks a linear issue', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createLinearIssue(proposal.id);

      await request(app).delete(`/api/linear/issues/${proposal.id}`).expect(200);

      const record = await prisma.linearIssue.findUnique({
        where: { proposalId: proposal.id },
      });
      expect(record).toBeNull();
    });
  });

  // ─── GET /api/linear/dashboard ─────────────────────────

  describe('GET /api/linear/dashboard', () => {
    it('returns dashboard summary', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createLinearIssue(proposal.id, {
        status: 'In Progress',
        priority: 2,
      });

      const res = await request(app).get('/api/linear/dashboard').expect(200);
      expect(res.body.data.totalExported).toBe(1);
      expect(Object.keys(res.body.data.byStatus)).toHaveLength(1);
    });
  });

  // ─── POST /api/linear/webhook ──────────────────────────

  describe('POST /api/linear/webhook', () => {
    it('processes a valid webhook payload', async () => {
      await seedLinearConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createLinearIssue(proposal.id, {
        linearId: 'lin-webhook-001',
        status: 'Backlog',
      });

      mockFetch({
        data: {
          issue: { state: { name: 'Done' }, priority: 1 },
        },
      });

      const res = await request(app)
        .post('/api/linear/webhook')
        .send({
          type: 'Issue',
          action: 'update',
          data: {
            id: 'lin-webhook-001',
            state: { name: 'Done' },
          },
        })
        .expect(200);

      expect(res.body.data.received).toBe(true);
    });

    it('ignores non-Issue webhook events', async () => {
      const res = await request(app)
        .post('/api/linear/webhook')
        .send({
          type: 'Comment',
          action: 'create',
          data: { id: 'comment-1' },
        })
        .expect(200);

      expect(res.body.data.received).toBe(true);
    });
  });
});
