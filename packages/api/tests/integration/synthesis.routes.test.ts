import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createFeedbackSource, createFeedbackItem, createTheme } from '../helpers/factories';
import { prisma } from '../setup';

const app = createTestApp();

describe('Synthesis Routes', () => {
  describe('GET /api/synthesis/status', () => {
    it('returns idle status when no synthesis has run', async () => {
      const res = await request(app).get('/api/synthesis/status');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: expect.stringMatching(/^(idle|completed|failed)$/),
        progress: expect.any(Number),
      });
    });
  });

  describe('GET /api/synthesis/themes', () => {
    it('returns empty list when no themes exist', async () => {
      const res = await request(app).get('/api/synthesis/themes');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        total: 0,
      });
    });

    it('returns themes with pagination', async () => {
      await createTheme({ name: 'Theme 1', opportunityScore: 5.0 });
      await createTheme({ name: 'Theme 2', opportunityScore: 10.0 });
      await createTheme({ name: 'Theme 3', opportunityScore: 2.0 });

      const res = await request(app).get('/api/synthesis/themes?pageSize=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('sorts by opportunityScore desc by default', async () => {
      await createTheme({ name: 'Low', opportunityScore: 1.0 });
      await createTheme({ name: 'High', opportunityScore: 10.0 });
      await createTheme({ name: 'Mid', opportunityScore: 5.0 });

      const res = await request(app).get('/api/synthesis/themes');
      expect(res.status).toBe(200);
      expect(res.body.data[0].name).toBe('High');
      expect(res.body.data[1].name).toBe('Mid');
      expect(res.body.data[2].name).toBe('Low');
    });

    it('filters by category', async () => {
      await createTheme({ name: 'Bug', category: 'bug', opportunityScore: 5 });
      await createTheme({ name: 'Feature', category: 'feature_request', opportunityScore: 5 });

      const res = await request(app).get('/api/synthesis/themes?category=bug');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Bug');
    });

    it('sorts by feedbackCount', async () => {
      await createTheme({ name: 'Few', feedbackCount: 2, opportunityScore: 10 });
      await createTheme({ name: 'Many', feedbackCount: 50, opportunityScore: 1 });

      const res = await request(app).get('/api/synthesis/themes?sortBy=feedbackCount');
      expect(res.status).toBe(200);
      expect(res.body.data[0].name).toBe('Many');
    });
  });

  describe('GET /api/synthesis/themes/:id', () => {
    it('returns theme with linked feedback', async () => {
      const source = await createFeedbackSource();
      const item = await createFeedbackItem(source.id, {
        content: 'Test feedback for theme linking',
        sentiment: -0.5,
        urgency: 0.8,
      });
      const theme = await createTheme({ name: 'Test Theme' });

      // Link feedback to theme
      await prisma.feedbackThemeLink.create({
        data: {
          feedbackItemId: item.id,
          themeId: theme.id,
          similarityScore: 0.95,
        },
      });

      const res = await request(app).get(`/api/synthesis/themes/${theme.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test Theme');
      expect(res.body.data.feedbackItems).toHaveLength(1);
      expect(res.body.data.feedbackItems[0].feedbackItem.content).toBe(
        'Test feedback for theme linking',
      );
    });

    it('returns 404 for non-existent theme', async () => {
      const res = await request(app).get('/api/synthesis/themes/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/synthesis/cost', () => {
    it('returns token usage stats', async () => {
      const res = await request(app).get('/api/synthesis/cost');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        totalCalls: expect.any(Number),
        totalTokens: expect.any(Number),
        totalCost: expect.any(Number),
      });
    });
  });
});
