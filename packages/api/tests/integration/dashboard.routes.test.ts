import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/index';
import { prisma } from '../setup';
import {
  createFeedbackSource,
  createFeedbackItem,
  createTheme,
  createProposal,
  createSpec,
} from '../helpers/factories';

const app = createApp();

describe('Dashboard Routes', () => {
  describe('GET /api/dashboard/stats', () => {
    it('returns zero counts when no data exists', async () => {
      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(200);
      expect(res.body.data.feedback.total).toBe(0);
      expect(res.body.data.themes.total).toBe(0);
      expect(res.body.data.proposals.total).toBe(0);
      expect(res.body.data.specs.total).toBe(0);
    });

    it('returns correct counts with data', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id);
      await createFeedbackItem(source.id);
      const theme = await createTheme({ feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createSpec(proposal.id);

      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(200);
      expect(res.body.data.feedback.total).toBe(2);
      expect(res.body.data.themes.total).toBe(1);
      expect(res.body.data.proposals.total).toBe(1);
      expect(res.body.data.specs.total).toBe(1);
    });

    it('returns trend data with correct structure', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id);

      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(200);
      const fb = res.body.data.feedback;
      expect(fb).toHaveProperty('total');
      expect(fb).toHaveProperty('currentWeek');
      expect(fb).toHaveProperty('previousWeek');
      expect(fb).toHaveProperty('trendPercent');
      expect(fb).toHaveProperty('trendDirection');
      expect(['up', 'down', 'flat']).toContain(fb.trendDirection);
    });
  });

  describe('GET /api/dashboard/activity', () => {
    it('returns empty array when no activity', async () => {
      const res = await request(app).get('/api/dashboard/activity');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns activity entries', async () => {
      await prisma.activityLog.create({
        data: { type: 'import', description: 'Imported 10 items' },
      });

      const res = await request(app).get('/api/dashboard/activity');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('import');
      expect(res.body.data[0].description).toBe('Imported 10 items');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await prisma.activityLog.create({
          data: { type: 'import', description: `Activity ${i}` },
        });
      }

      const res = await request(app).get('/api/dashboard/activity?limit=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('caps limit at 50', async () => {
      const res = await request(app).get('/api/dashboard/activity?limit=100');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/dashboard/top-themes', () => {
    it('returns empty array when no themes', async () => {
      const res = await request(app).get('/api/dashboard/top-themes');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns themes ordered by feedback count', async () => {
      await createTheme({ name: 'Small Theme', feedbackCount: 2 });
      await createTheme({ name: 'Big Theme', feedbackCount: 10 });

      const res = await request(app).get('/api/dashboard/top-themes');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Big Theme');
      expect(res.body.data[0].feedbackCount).toBe(10);
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 8; i++) {
        await createTheme({ name: `Theme ${i}`, feedbackCount: i });
      }

      const res = await request(app).get('/api/dashboard/top-themes?limit=3');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
    });
  });

  describe('GET /api/dashboard/sentiment', () => {
    it('returns zero values when no feedback', async () => {
      const res = await request(app).get('/api/dashboard/sentiment');
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.average).toBe(0);
    });

    it('returns correct sentiment distribution', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id, { sentiment: -0.8 }); // negative
      await createFeedbackItem(source.id, { sentiment: 0.0 }); // neutral
      await createFeedbackItem(source.id, { sentiment: 0.1 }); // neutral
      await createFeedbackItem(source.id, { sentiment: 0.8 }); // positive
      await createFeedbackItem(source.id, { sentiment: 0.9 }); // positive

      const res = await request(app).get('/api/dashboard/sentiment');
      expect(res.status).toBe(200);
      expect(res.body.data.negative).toBe(1);
      expect(res.body.data.neutral).toBe(2);
      expect(res.body.data.positive).toBe(2);
      expect(res.body.data.total).toBe(5);
      expect(typeof res.body.data.average).toBe('number');
    });
  });
});
