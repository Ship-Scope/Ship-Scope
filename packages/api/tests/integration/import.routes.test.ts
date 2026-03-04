import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';

const app = createTestApp();
const fixture = (name: string) => readFileSync(resolve(__dirname, '../fixtures', name));

describe('Import Routes', () => {
  describe('POST /api/feedback/import/csv', () => {
    it('should accept valid CSV file and return 201', async () => {
      const res = await request(app)
        .post('/api/feedback/import/csv')
        .attach('file', fixture('valid.csv'), 'valid.csv')
        .expect(201);

      expect(res.body.count).toBe(5);
      expect(res.body.source).toBeDefined();
      expect(res.body.contentColumn).toBe('feedback');
    });

    it('should return 400 when no file uploaded', async () => {
      await request(app).post('/api/feedback/import/csv').expect(400);
    });

    it('should handle BOM CSV file correctly', async () => {
      const res = await request(app)
        .post('/api/feedback/import/csv')
        .attach('file', fixture('bom.csv'), 'bom.csv')
        .expect(201);

      expect(res.body.count).toBe(5);
    });

    it('should handle CSV with quoted fields', async () => {
      const res = await request(app)
        .post('/api/feedback/import/csv')
        .attach('file', fixture('quoted.csv'), 'quoted.csv')
        .expect(201);

      expect(res.body.count).toBeGreaterThan(0);
    });
  });
});
