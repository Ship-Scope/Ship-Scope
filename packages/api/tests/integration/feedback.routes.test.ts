import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createFeedbackSource, createFeedbackItem } from '../helpers/factories';

const app = createTestApp();

describe('Feedback Routes', () => {
  describe('POST /api/feedback', () => {
    it('should create feedback item and return 201', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({ content: 'This is valid feedback content for testing' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe('This is valid feedback content for testing');
      expect(res.body.channel).toBe('manual');
    });

    it('should return 400 when content is missing', async () => {
      await request(app).post('/api/feedback').send({}).expect(400);
    });

    it('should return 400 when content is shorter than 10 characters', async () => {
      await request(app).post('/api/feedback').send({ content: 'short' }).expect(400);
    });

    it('should return 400 when email is invalid format', async () => {
      await request(app)
        .post('/api/feedback')
        .send({ content: 'This is valid feedback content', email: 'not-an-email' })
        .expect(400);
    });

    it('should trim whitespace from content', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({ content: '   This is valid feedback with spaces   ' })
        .expect(201);

      expect(res.body.content).toBe('This is valid feedback with spaces');
    });

    it('should accept valid channel', async () => {
      const res = await request(app)
        .post('/api/feedback')
        .send({ content: 'Feedback from survey channel', channel: 'survey' })
        .expect(201);

      expect(res.body.channel).toBe('survey');
    });
  });

  describe('GET /api/feedback', () => {
    it('should return paginated feedback items', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id, { content: 'First feedback item for pagination test' });
      await createFeedbackItem(source.id, { content: 'Second feedback item for pagination test' });

      const res = await request(app).get('/api/feedback').expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        pageSize: 50,
        total: 2,
        totalPages: 1,
      });
    });

    it('should filter by search term', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id, { content: 'This mentions dark mode feature' });
      await createFeedbackItem(source.id, { content: 'This is about export functionality' });

      const res = await request(app).get('/api/feedback?search=dark mode').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].content).toContain('dark mode');
    });

    it('should filter by channel', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id, {
        content: 'Survey feedback content',
        channel: 'survey',
      });
      await createFeedbackItem(source.id, {
        content: 'Slack feedback content here',
        channel: 'slack',
      });

      const res = await request(app).get('/api/feedback?channel=survey').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].channel).toBe('survey');
    });

    it('should return empty array when no items exist', async () => {
      const res = await request(app).get('/api/feedback').expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should sort by createdAt desc by default', async () => {
      const source = await createFeedbackSource();
      const item1 = await createFeedbackItem(source.id, { content: 'First created feedback item' });
      // Small delay so createdAt differs
      await new Promise((r) => setTimeout(r, 50));
      const item2 = await createFeedbackItem(source.id, {
        content: 'Second created feedback item',
      });

      const res = await request(app).get('/api/feedback').expect(200);

      // Most recent first (desc)
      expect(res.body.data[0].id).toBe(item2.id);
      expect(res.body.data[1].id).toBe(item1.id);
    });
  });

  describe('GET /api/feedback/:id', () => {
    it('should return single item with full details', async () => {
      const source = await createFeedbackSource();
      const item = await createFeedbackItem(source.id, {
        content: 'Detailed feedback for retrieval test',
      });

      const res = await request(app).get(`/api/feedback/${item.id}`).expect(200);

      expect(res.body.id).toBe(item.id);
      expect(res.body.content).toBe('Detailed feedback for retrieval test');
      expect(res.body.source).toBeDefined();
    });

    it('should return 404 for non-existent ID', async () => {
      await request(app).get('/api/feedback/non-existent-id-12345').expect(404);
    });
  });

  describe('DELETE /api/feedback/:id', () => {
    it('should delete item and return 204', async () => {
      const source = await createFeedbackSource();
      const item = await createFeedbackItem(source.id);

      await request(app).delete(`/api/feedback/${item.id}`).expect(204);

      // Verify it's gone
      await request(app).get(`/api/feedback/${item.id}`).expect(404);
    });

    it('should return 404 for non-existent ID', async () => {
      await request(app).delete('/api/feedback/non-existent-id-12345').expect(404);
    });
  });

  describe('POST /api/feedback/bulk-delete', () => {
    it('should delete multiple items and return count', async () => {
      const source = await createFeedbackSource();
      const item1 = await createFeedbackItem(source.id, { content: 'First bulk delete item test' });
      const item2 = await createFeedbackItem(source.id, {
        content: 'Second bulk delete item test',
      });

      const res = await request(app)
        .post('/api/feedback/bulk-delete')
        .send({ ids: [item1.id, item2.id] })
        .expect(200);

      expect(res.body.count).toBe(2);
    });

    it('should return 400 when ids array is empty', async () => {
      await request(app).post('/api/feedback/bulk-delete').send({ ids: [] }).expect(400);
    });
  });

  describe('GET /api/feedback/stats', () => {
    it('should return correct aggregate statistics', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id, {
        content: 'Processed feedback item for stats',
        channel: 'survey',
        processedAt: new Date(),
        sentiment: 0.8,
        urgency: 0.3,
      });
      await createFeedbackItem(source.id, {
        content: 'Unprocessed feedback item for stats',
        channel: 'slack',
        sentiment: -0.5,
        urgency: 0.9,
      });

      const res = await request(app).get('/api/feedback/stats').expect(200);

      expect(res.body.total).toBe(2);
      expect(res.body.processed).toBe(1);
      expect(res.body.unprocessed).toBe(1);
      expect(res.body.byChannel).toHaveLength(2);
      expect(res.body.averages.sentiment).toBeCloseTo(0.15, 1);
    });

    it('should return zero counts when no items exist', async () => {
      const res = await request(app).get('/api/feedback/stats').expect(200);

      expect(res.body.total).toBe(0);
      expect(res.body.processed).toBe(0);
      expect(res.body.unprocessed).toBe(0);
    });
  });

  describe('POST /api/feedback/mark-processed', () => {
    it('should mark items as processed', async () => {
      const source = await createFeedbackSource();
      const item1 = await createFeedbackItem(source.id, {
        content: 'First item to mark processed',
      });
      const item2 = await createFeedbackItem(source.id, {
        content: 'Second item to mark processed',
      });

      const res = await request(app)
        .post('/api/feedback/mark-processed')
        .send({ ids: [item1.id, item2.id] })
        .expect(200);

      expect(res.body.count).toBe(2);

      // Verify they're marked
      const detail = await request(app).get(`/api/feedback/${item1.id}`).expect(200);

      expect(detail.body.processedAt).not.toBeNull();
    });
  });
});
