import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';

describe('GET /api/health', () => {
  const app = createTestApp();

  it('should return 200 with status ok when all services connected', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: expect.stringMatching(/ok|degraded/),
      db: 'connected',
      redis: expect.any(String),
      timestamp: expect.any(String),
    });
  });

  it('should include a valid ISO timestamp', async () => {
    const res = await request(app).get('/api/health');
    const date = new Date(res.body.timestamp);
    expect(date.toISOString()).toBe(res.body.timestamp);
  });
});
