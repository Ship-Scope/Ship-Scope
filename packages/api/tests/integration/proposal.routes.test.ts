import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import {
  createTheme,
  createProposal,
  createFeedbackSource,
  createFeedbackItem,
} from '../helpers/factories';
import { prisma } from '../setup';

const app = createTestApp();

describe('Proposal Routes', () => {
  // ─── GET /api/proposals ────────────────────────────────────

  describe('GET /api/proposals', () => {
    it('returns empty list when no proposals exist', async () => {
      const res = await request(app).get('/api/proposals');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        total: 0,
      });
    });

    it('returns proposals with pagination', async () => {
      const theme = await createTheme({ name: 'Pagination Theme', feedbackCount: 5 });
      await createProposal(theme.id, { title: 'Proposal A', riceScore: 50 });
      await new Promise((r) => setTimeout(r, 50));
      await createProposal(theme.id, { title: 'Proposal B', riceScore: 30 });
      await new Promise((r) => setTimeout(r, 50));
      await createProposal(theme.id, { title: 'Proposal C', riceScore: 10 });

      const res = await request(app).get('/api/proposals?pageSize=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('sorts by riceScore desc by default', async () => {
      const theme = await createTheme({ name: 'Sort Theme', feedbackCount: 5 });
      await createProposal(theme.id, { title: 'Low Score', riceScore: 10 });
      await createProposal(theme.id, { title: 'High Score', riceScore: 100 });
      await createProposal(theme.id, { title: 'Mid Score', riceScore: 50 });

      const res = await request(app).get('/api/proposals');
      expect(res.status).toBe(200);
      expect(res.body.data[0].title).toBe('High Score');
      expect(res.body.data[1].title).toBe('Mid Score');
      expect(res.body.data[2].title).toBe('Low Score');
    });

    it('filters by status', async () => {
      const theme = await createTheme({ name: 'Filter Theme', feedbackCount: 5 });
      await createProposal(theme.id, { title: 'Proposed One', status: 'proposed' });
      await createProposal(theme.id, { title: 'Approved One', status: 'approved' });
      await createProposal(theme.id, { title: 'Rejected One', status: 'rejected' });

      const res = await request(app).get('/api/proposals?status=approved');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Approved One');
    });

    it('searches by title', async () => {
      const theme = await createTheme({ name: 'Search Theme', feedbackCount: 5 });
      await createProposal(theme.id, { title: 'Dashboard Redesign', riceScore: 50 });
      await createProposal(theme.id, { title: 'API Rate Limiting', riceScore: 40 });

      const res = await request(app).get('/api/proposals?search=dashboard');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Dashboard Redesign');
    });

    it('searches by problem text', async () => {
      const theme = await createTheme({ name: 'Problem Search Theme', feedbackCount: 5 });
      await createProposal(theme.id, {
        title: 'Feature A',
        problem: 'Users cannot export CSV data efficiently',
      });
      await createProposal(theme.id, {
        title: 'Feature B',
        problem: 'The login flow is confusing',
      });

      const res = await request(app).get('/api/proposals?search=export');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Feature A');
    });

    it('includes theme and evidence count', async () => {
      const theme = await createTheme({ name: 'Include Theme', feedbackCount: 5 });
      await createProposal(theme.id, { title: 'With Includes' });

      const res = await request(app).get('/api/proposals');
      expect(res.status).toBe(200);
      expect(res.body.data[0].theme).toMatchObject({ name: 'Include Theme' });
      expect(res.body.data[0].evidenceCount).toBe(0);
    });

    it('paginates to page 2', async () => {
      const theme = await createTheme({ name: 'Page2 Theme', feedbackCount: 5 });
      for (let i = 0; i < 5; i++) {
        await createProposal(theme.id, { title: `Proposal ${i}`, riceScore: 50 - i * 10 });
      }

      const res = await request(app).get('/api/proposals?page=2&pageSize=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.page).toBe(2);
    });
  });

  // ─── GET /api/proposals/:id ────────────────────────────────

  describe('GET /api/proposals/:id', () => {
    it('returns proposal with evidence and theme', async () => {
      const theme = await createTheme({ name: 'Detail Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { title: 'Detailed Proposal' });

      const res = await request(app).get(`/api/proposals/${proposal.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Detailed Proposal');
      expect(res.body.data.theme).toMatchObject({ name: 'Detail Theme' });
      expect(res.body.data.evidence).toEqual([]);
    });

    it('returns 404 for non-existent proposal', async () => {
      const res = await request(app).get('/api/proposals/nonexistent-id-123');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Proposal not found');
    });

    it('includes evidence when present', async () => {
      const source = await createFeedbackSource();
      const theme = await createTheme({ name: 'Evidence Theme', feedbackCount: 5 });
      const item = await createFeedbackItem(source.id, {
        content: 'This feedback has useful content for testing',
      });
      const proposal = await createProposal(theme.id, { title: 'With Evidence' });

      await prisma.proposalEvidence.create({
        data: {
          proposalId: proposal.id,
          feedbackItemId: item.id,
          relevanceScore: 0.9,
          quote: 'useful content for testing',
        },
      });

      const res = await request(app).get(`/api/proposals/${proposal.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.evidence).toHaveLength(1);
      expect(res.body.data.evidence[0].quote).toBe('useful content for testing');
      expect(res.body.data.evidence[0].feedbackItem.content).toContain('useful content');
    });
  });

  // ─── PATCH /api/proposals/:id ──────────────────────────────

  describe('PATCH /api/proposals/:id', () => {
    it('updates proposal title', async () => {
      const theme = await createTheme({ name: 'Update Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { title: 'Original Title' });

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ title: 'Updated Title' });
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
    });

    it('transitions status from proposed to approved', async () => {
      const theme = await createTheme({ name: 'Status Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { status: 'proposed' });

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ status: 'approved' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    it('transitions approved to shipped', async () => {
      const theme = await createTheme({ name: 'Ship Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { status: 'approved' });

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ status: 'shipped' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('shipped');
    });

    it('rejects invalid status transition (proposed → shipped)', async () => {
      const theme = await createTheme({ name: 'Invalid Transition Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { status: 'proposed' });

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ status: 'shipped' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot transition');
    });

    it('rejects transition from shipped status', async () => {
      const theme = await createTheme({ name: 'Shipped Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { status: 'shipped' });

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ status: 'proposed' });
      expect(res.status).toBe(400);
    });

    it('allows reconsider transition (rejected → proposed)', async () => {
      const theme = await createTheme({ name: 'Reconsider Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { status: 'rejected' });

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ status: 'proposed' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('proposed');
    });

    it('recalculates RICE score when scores change', async () => {
      const theme = await createTheme({ name: 'RICE Recalc Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, {
        reachScore: 5,
        impactScore: 5,
        confidenceScore: 5,
        effortScore: 5,
        riceScore: 25,
      });

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ reachScore: 10 });
      expect(res.status).toBe(200);
      // (10 * 5 * 5) / 5 = 50
      expect(res.body.data.riceScore).toBe(50);
    });

    it('returns 400 when body is empty', async () => {
      const theme = await createTheme({ name: 'Empty Body Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id);

      const res = await request(app).patch(`/api/proposals/${proposal.id}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent proposal', async () => {
      const res = await request(app)
        .patch('/api/proposals/nonexistent-id-456')
        .send({ title: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('validates score bounds (rejects score > 10)', async () => {
      const theme = await createTheme({ name: 'Bounds Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id);

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ reachScore: 15 });
      expect(res.status).toBe(400);
    });

    it('validates score bounds (rejects score < 1)', async () => {
      const theme = await createTheme({ name: 'Min Bounds Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id);

      const res = await request(app)
        .patch(`/api/proposals/${proposal.id}`)
        .send({ effortScore: 0 });
      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/proposals/:id ─────────────────────────────

  describe('DELETE /api/proposals/:id', () => {
    it('deletes a proposal', async () => {
      const theme = await createTheme({ name: 'Delete Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { title: 'To Delete' });

      const res = await request(app).delete(`/api/proposals/${proposal.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      // Verify it's gone
      const check = await request(app).get(`/api/proposals/${proposal.id}`);
      expect(check.status).toBe(404);
    });

    it('cascades delete to evidence', async () => {
      const source = await createFeedbackSource();
      const theme = await createTheme({ name: 'Cascade Theme', feedbackCount: 5 });
      const item = await createFeedbackItem(source.id, {
        content: 'Feedback for cascade delete test',
      });
      const proposal = await createProposal(theme.id, { title: 'Cascade Delete' });

      await prisma.proposalEvidence.create({
        data: {
          proposalId: proposal.id,
          feedbackItemId: item.id,
          relevanceScore: 0.8,
          quote: 'cascade test',
        },
      });

      const res = await request(app).delete(`/api/proposals/${proposal.id}`);
      expect(res.status).toBe(200);

      // Verify evidence is also deleted
      const evidence = await prisma.proposalEvidence.findMany({
        where: { proposalId: proposal.id },
      });
      expect(evidence).toHaveLength(0);
    });

    it('returns 404 for non-existent proposal', async () => {
      const res = await request(app).delete('/api/proposals/nonexistent-id-789');
      expect(res.status).toBe(404);
    });
  });
});
