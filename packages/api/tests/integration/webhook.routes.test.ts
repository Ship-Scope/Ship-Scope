import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { webhookService } from '../../src/services/webhook.service';

const app = createTestApp();

describe('Webhook Routes', () => {
  describe('POST /api/feedback/webhook', () => {
    it('should accept single item with valid API key and return 201', async () => {
      const { key } = await webhookService.generateApiKey('Test Key');

      const res = await request(app)
        .post('/api/feedback/webhook')
        .set('X-API-Key', key)
        .send({
          content: 'Webhook feedback item with enough content',
        })
        .expect(201);

      expect(res.body.count).toBe(1);
      expect(res.body.ids).toHaveLength(1);
    });

    it('should accept array of items and return 201', async () => {
      const { key } = await webhookService.generateApiKey();

      const res = await request(app)
        .post('/api/feedback/webhook')
        .set('X-API-Key', key)
        .send([
          { content: 'First webhook feedback item for array test' },
          { content: 'Second webhook feedback item for array test' },
          { content: 'Third webhook feedback item for array test' },
        ])
        .expect(201);

      expect(res.body.count).toBe(3);
      expect(res.body.ids).toHaveLength(3);
    });

    it('should return 401 when X-API-Key header is missing', async () => {
      await request(app)
        .post('/api/feedback/webhook')
        .send({ content: 'Feedback without API key authentication' })
        .expect(401);
    });

    it('should return 401 when API key is invalid', async () => {
      await request(app)
        .post('/api/feedback/webhook')
        .set('X-API-Key', 'sk_live_invalid_key_value')
        .send({ content: 'Feedback with invalid API key header' })
        .expect(401);
    });

    it('should return 401 when API key is revoked', async () => {
      const { key, id } = await webhookService.generateApiKey();
      await webhookService.revokeApiKey(id);

      await request(app)
        .post('/api/feedback/webhook')
        .set('X-API-Key', key)
        .send({ content: 'Feedback with revoked API key header' })
        .expect(401);
    });

    it('should return 400 when content is too short', async () => {
      const { key } = await webhookService.generateApiKey();

      await request(app)
        .post('/api/feedback/webhook')
        .set('X-API-Key', key)
        .send({ content: 'short' })
        .expect(400);
    });

    it('should accept items with optional fields', async () => {
      const { key } = await webhookService.generateApiKey();

      const res = await request(app)
        .post('/api/feedback/webhook')
        .set('X-API-Key', key)
        .send({
          content: 'Feedback with all optional fields filled',
          author: 'John Doe',
          email: 'john@example.com',
          channel: 'survey',
          metadata: { source: 'test' },
        })
        .expect(201);

      expect(res.body.count).toBe(1);
    });
  });

  describe('Settings API Key Routes', () => {
    it('should create and list API keys', async () => {
      // Create
      const createRes = await request(app)
        .post('/api/settings/api-keys')
        .send({ name: 'Integration Test Key' })
        .expect(201);

      expect(createRes.body.key).toMatch(/^sk_live_/);
      expect(createRes.body.name).toBe('Integration Test Key');

      // List
      const listRes = await request(app).get('/api/settings/api-keys').expect(200);

      expect(listRes.body.keys.length).toBeGreaterThanOrEqual(1);
      const found = listRes.body.keys.find((k: any) => k.id === createRes.body.id);
      expect(found).toBeDefined();
      expect(found.name).toBe('Integration Test Key');
    });

    it('should revoke an API key', async () => {
      const createRes = await request(app)
        .post('/api/settings/api-keys')
        .send({ name: 'Key To Revoke' })
        .expect(201);

      await request(app).delete(`/api/settings/api-keys/${createRes.body.id}`).expect(204);

      // Verify it's revoked (listed but inactive)
      const listRes = await request(app).get('/api/settings/api-keys').expect(200);

      const revoked = listRes.body.keys.find((k: any) => k.id === createRes.body.id);
      expect(revoked.isActive).toBe(false);
    });

    it('should return 404 when revoking non-existent key', async () => {
      await request(app).delete('/api/settings/api-keys/non-existent-id').expect(404);
    });
  });
});
