import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createTheme, createProposal, createSpec } from '../helpers/factories';

// Mock the AI service to avoid real LLM calls
vi.mock('../../src/services/ai.service', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    chatCompletionText: vi.fn().mockResolvedValue(`# Mock PRD

## Overview
This is a mock PRD for testing.

## Problem Statement
Users have a problem that needs solving.

## Goals & Success Metrics
- Improve user satisfaction

## User Stories
- As a user, I want a better experience.

## Functional Requirements
- Display stat cards

## Non-Functional Requirements
- Page load under 2 seconds

## Data Model Changes
No changes needed.

## API Specifications
GET /api/test — returns test data

## UI/UX Considerations
Use dark theme.

## Open Questions
None at this time.
`),
  };
});

const app = createTestApp();

describe('Spec Routes', () => {
  // ─── POST /api/specs/generate/:proposalId ──────────────

  describe('POST /api/specs/generate/:proposalId', () => {
    it('generates spec from approved proposal (201)', async () => {
      const theme = await createTheme({ name: 'Gen Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, {
        title: 'Test Feature',
        status: 'approved',
      });

      const res = await request(app).post(`/api/specs/generate/${proposal.id}`);
      expect(res.status).toBe(201);
      expect(res.body.data.spec).toHaveProperty('id');
      expect(res.body.data.spec.proposalId).toBe(proposal.id);
      expect(res.body.data.spec.version).toBe(1);
      expect(res.body.data.spec.prdMarkdown).toContain('## Overview');
      expect(res.body.data.isRegeneration).toBe(false);
    });

    it('regenerates spec and bumps version (200)', async () => {
      const theme = await createTheme({ name: 'Regen Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, {
        title: 'Regen Feature',
        status: 'approved',
      });

      // First generation
      await request(app).post(`/api/specs/generate/${proposal.id}`).expect(201);

      // Regeneration
      const res = await request(app).post(`/api/specs/generate/${proposal.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.spec.version).toBe(2);
      expect(res.body.data.isRegeneration).toBe(true);
      expect(res.body.data.previousVersion).toBe(1);
    });

    it('rejects non-approved proposal (400)', async () => {
      const theme = await createTheme({ name: 'Non-approved Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { status: 'proposed' });

      const res = await request(app).post(`/api/specs/generate/${proposal.id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('approved');
    });

    it('returns 404 for non-existent proposal', async () => {
      const res = await request(app).post('/api/specs/generate/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/specs ────────────────────────────────────

  describe('GET /api/specs', () => {
    it('returns empty list when no specs exist', async () => {
      const res = await request(app).get('/api/specs');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns all specs with proposal info', async () => {
      const theme = await createTheme({ name: 'List Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, {
        title: 'Listed Proposal',
        status: 'approved',
      });
      await createSpec(proposal.id, { prdMarkdown: '# Test', agentPrompt: 'test' });

      const res = await request(app).get('/api/specs');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].proposal.title).toBe('Listed Proposal');
    });
  });

  // ─── GET /api/specs/:id ────────────────────────────────

  describe('GET /api/specs/:id', () => {
    it('returns spec by ID', async () => {
      const theme = await createTheme({ name: 'Get Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, {
        title: 'Get Proposal',
        status: 'approved',
      });
      const spec = await createSpec(proposal.id, {
        prdMarkdown: '# My PRD',
        agentPrompt: 'prompt',
      });

      const res = await request(app).get(`/api/specs/${spec.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.prdMarkdown).toBe('# My PRD');
      expect(res.body.data.proposal.title).toBe('Get Proposal');
    });

    it('returns 404 for non-existent spec', async () => {
      const res = await request(app).get('/api/specs/nonexistent-id');
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/specs/by-proposal/:proposalId ────────────

  describe('GET /api/specs/by-proposal/:proposalId', () => {
    it('returns spec by proposal ID', async () => {
      const theme = await createTheme({ name: 'ByProposal Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, {
        title: 'ByProposal Proposal',
        status: 'approved',
      });
      await createSpec(proposal.id, { prdMarkdown: '# PRD by proposal' });

      const res = await request(app).get(`/api/specs/by-proposal/${proposal.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.prdMarkdown).toBe('# PRD by proposal');
    });

    it('returns 404 when no spec exists for proposal', async () => {
      const theme = await createTheme({ name: 'NoSpec Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, { status: 'approved' });

      const res = await request(app).get(`/api/specs/by-proposal/${proposal.id}`);
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/specs/:id/agent-prompt ───────────────────

  describe('GET /api/specs/:id/agent-prompt', () => {
    it('returns cursor format prompt by default', async () => {
      const theme = await createTheme({ name: 'Prompt Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, {
        title: 'Prompt Proposal',
        status: 'approved',
        reachScore: 8,
        impactScore: 7,
        confidenceScore: 6,
        effortScore: 4,
        riceScore: 84,
      });
      const spec = await createSpec(proposal.id, {
        prdMarkdown: '## Overview\nTest overview\n\n## User Stories\nAs a user, I want...',
        agentPrompt: 'cursor prompt',
      });

      const res = await request(app).get(`/api/specs/${spec.id}/agent-prompt`);
      expect(res.status).toBe(200);
      expect(typeof res.body.data).toBe('string');
      expect(res.body.data).toContain('Prompt Proposal');
    });

    it('returns claude_code format when requested', async () => {
      const theme = await createTheme({ name: 'Claude Theme', feedbackCount: 5 });
      const proposal = await createProposal(theme.id, {
        title: 'Claude Feature',
        status: 'approved',
        reachScore: 5,
        impactScore: 5,
        confidenceScore: 5,
        effortScore: 5,
        riceScore: 25,
      });
      const spec = await createSpec(proposal.id, {
        prdMarkdown: '## Overview\nTest\n\n## User Stories\nStory',
        agentPrompt: 'prompt',
      });

      const res = await request(app).get(`/api/specs/${spec.id}/agent-prompt?format=claude_code`);
      expect(res.status).toBe(200);
      expect(res.body.data).toContain('Feature Implementation');
    });

    it('returns 404 for non-existent spec', async () => {
      const res = await request(app).get('/api/specs/nonexistent/agent-prompt');
      expect(res.status).toBe(404);
    });
  });
});
