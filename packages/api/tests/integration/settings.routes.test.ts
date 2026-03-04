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

describe('Settings Routes', () => {
  describe('GET /api/settings', () => {
    it('returns default settings when none are saved', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('ai_model', 'gpt-4o-mini');
      expect(res.body.data).toHaveProperty('similarity_threshold', '0.78');
      expect(res.body.data).toHaveProperty('min_cluster_size', '3');
    });

    it('returns saved settings merged with defaults', async () => {
      await prisma.setting.create({ data: { key: 'ai_model', value: 'gpt-4o' } });

      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body.data.ai_model).toBe('gpt-4o');
      expect(res.body.data.similarity_threshold).toBe('0.78'); // default
    });

    it('masks API key in response', async () => {
      await prisma.setting.create({
        data: { key: 'openai_api_key', value: 'sk-test1234567890abcdef' },
      });

      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body.data.openai_api_key).toContain('...');
      expect(res.body.data.openai_api_key).not.toBe('sk-test1234567890abcdef');
    });
  });

  describe('PUT /api/settings', () => {
    it('saves a single setting', async () => {
      const res = await request(app).put('/api/settings').send({ ai_model: 'gpt-4o' });
      expect(res.status).toBe(200);
      expect(res.body.data.ai_model).toBe('gpt-4o');
    });

    it('saves multiple settings', async () => {
      const res = await request(app).put('/api/settings').send({
        ai_model: 'gpt-4-turbo',
        similarity_threshold: '0.85',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.ai_model).toBe('gpt-4-turbo');
      expect(res.body.data.similarity_threshold).toBe('0.85');
    });

    it('updates existing setting', async () => {
      await prisma.setting.create({ data: { key: 'ai_model', value: 'gpt-4o-mini' } });

      const res = await request(app).put('/api/settings').send({ ai_model: 'gpt-4o' });
      expect(res.status).toBe(200);
      expect(res.body.data.ai_model).toBe('gpt-4o');
    });
  });

  describe('POST /api/settings/export', () => {
    it('exports empty data', async () => {
      const res = await request(app).post('/api/settings/export');
      expect(res.status).toBe(200);
      expect(res.body.data.counts.feedback).toBe(0);
      expect(res.body.data.counts.themes).toBe(0);
    });

    it('exports all data types', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id);
      const theme = await createTheme({ feedbackCount: 1 });
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createSpec(proposal.id);

      const res = await request(app).post('/api/settings/export');
      expect(res.status).toBe(200);
      expect(res.body.data.counts.feedback).toBe(1);
      expect(res.body.data.counts.themes).toBe(1);
      expect(res.body.data.counts.proposals).toBe(1);
      expect(res.body.data.counts.specs).toBe(1);
      expect(res.body.data.exportedAt).toBeDefined();
    });
  });

  describe('DELETE /api/settings/data', () => {
    it('deletes all data', async () => {
      const source = await createFeedbackSource();
      await createFeedbackItem(source.id);
      const theme = await createTheme({ feedbackCount: 1 });
      await createProposal(theme.id);

      const res = await request(app).delete('/api/settings/data');
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBeDefined();

      // Verify empty
      const feedbackCount = await prisma.feedbackItem.count();
      expect(feedbackCount).toBe(0);
      const themeCount = await prisma.theme.count();
      expect(themeCount).toBe(0);
    });
  });
});
