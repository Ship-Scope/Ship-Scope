# 05 — Proposal Tests

## Objective

Write comprehensive unit and integration tests for the entire proposal pipeline: RICE score calculation, proposal generation service, evidence linking service, quote extraction, status transition validation, all proposal CRUD endpoints, and edge cases around malformed AI output. Achieve >80% coverage on `proposal.service.ts` and `evidence.service.ts`.

## Dependencies

- 01-proposal-generation (proposal.service.ts complete)
- 02-rice-scoring-crud (routes, schemas, status validation complete)
- 03-evidence-linking (evidence.service.ts complete)
- Phase 1: Testing infrastructure (Vitest, Supertest, test database setup)
- Phase 3 tests: Mock patterns for OpenAI (reuse `openai-mock.ts`)

## Files to Create

| File                                                      | Purpose                                              |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `packages/api/tests/unit/proposal.service.test.ts`        | Unit tests for proposal generation and CRUD          |
| `packages/api/tests/unit/evidence.service.test.ts`        | Unit tests for evidence linking and quote extraction |
| `packages/api/tests/unit/rice.test.ts`                    | Unit tests for RICE calculation (pure function)      |
| `packages/api/tests/unit/proposal-prompt.test.ts`         | Unit tests for prompt template building              |
| `packages/api/tests/integration/proposals.routes.test.ts` | Integration tests for all proposal endpoints         |

## Files to Modify

| File                                        | Changes                               |
| ------------------------------------------- | ------------------------------------- |
| `packages/api/tests/helpers/openai-mock.ts` | Add proposal generation mock response |
| `packages/api/tests/helpers/seed.ts`        | Add proposal + evidence seed helpers  |

## Detailed Sub-Tasks

### 1. Unit Tests: RICE Calculation (`rice.test.ts`)

The RICE calculation is a pure function with no dependencies. Test it exhaustively.

```typescript
import { describe, it, expect } from 'vitest';
import { calculateRICE } from '../../src/services/proposal.service';

describe('calculateRICE', () => {
  it('should calculate (Reach x Impact x Confidence) / Effort', () => {
    expect(calculateRICE(8, 7, 6, 3)).toBe(112);
    // (8 * 7 * 6) / 3 = 336 / 3 = 112
  });

  it('should return a float when result is not an integer', () => {
    const result = calculateRICE(3, 4, 5, 8);
    // (3 * 4 * 5) / 8 = 60 / 8 = 7.5
    expect(result).toBe(7.5);
  });

  it('should handle minimum scores (all 1)', () => {
    expect(calculateRICE(1, 1, 1, 1)).toBe(1);
  });

  it('should handle maximum scores (all 10)', () => {
    expect(calculateRICE(10, 10, 10, 10)).toBe(100);
    // (10 * 10 * 10) / 10 = 100
  });

  it('should handle high reach/impact with high effort', () => {
    expect(calculateRICE(10, 10, 10, 1)).toBe(1000);
  });

  it('should throw when effort is 0 (division by zero)', () => {
    expect(() => calculateRICE(5, 5, 5, 0)).toThrow('Effort score cannot be zero');
  });

  it('should return low score when effort is high', () => {
    const result = calculateRICE(2, 2, 2, 10);
    // (2 * 2 * 2) / 10 = 0.8
    expect(result).toBeCloseTo(0.8);
  });

  it('should differentiate between similar proposals', () => {
    const proposalA = calculateRICE(8, 7, 6, 5);
    const proposalB = calculateRICE(8, 7, 6, 3);
    // A: 336/5 = 67.2, B: 336/3 = 112
    expect(proposalB).toBeGreaterThan(proposalA);
  });

  it('should produce consistent ordering for ranking', () => {
    const scores = [
      calculateRICE(10, 9, 8, 2), // 360
      calculateRICE(5, 5, 5, 5), // 25
      calculateRICE(8, 7, 6, 3), // 112
      calculateRICE(1, 1, 1, 10), // 0.1
    ];
    const sorted = [...scores].sort((a, b) => b - a);
    expect(sorted).toEqual([360, 112, 25, 0.1]);
  });
});
```

### 2. Unit Tests: Proposal Prompt (`proposal-prompt.test.ts`)

Test the prompt template builder produces correct output.

```typescript
import { describe, it, expect } from 'vitest';
import { buildProposalPrompt, buildProposalSystemPrompt } from '@shipscope/core/prompts/proposals';
import type { ThemeWithEvidence } from '@shipscope/core/types/proposal';

describe('buildProposalPrompt', () => {
  const mockTheme: ThemeWithEvidence = {
    id: 'theme-1',
    name: 'Missing Bulk Export',
    description: 'Users frequently request the ability to export data in bulk',
    category: 'feature_request',
    painPoints: ['Cannot export more than 100 rows', 'No CSV download option'],
    feedbackCount: 42,
    avgSentiment: -0.35,
    avgUrgency: 0.72,
    score: 22.1,
    sampleFeedback: [
      'I need to export all my data but can only do 100 rows at a time',
      'Please add a CSV export feature, this is basic functionality',
      'The export is broken for large datasets',
    ],
  };

  it('should include theme name in prompt', () => {
    const prompt = buildProposalPrompt(mockTheme);
    expect(prompt).toContain('Theme: Missing Bulk Export');
  });

  it('should include theme description', () => {
    const prompt = buildProposalPrompt(mockTheme);
    expect(prompt).toContain(mockTheme.description);
  });

  it('should include pain points as comma-separated list', () => {
    const prompt = buildProposalPrompt(mockTheme);
    expect(prompt).toContain('Cannot export more than 100 rows, No CSV download option');
  });

  it('should include feedback count', () => {
    const prompt = buildProposalPrompt(mockTheme);
    expect(prompt).toContain('Feedback Count: 42');
  });

  it('should include formatted sentiment and urgency', () => {
    const prompt = buildProposalPrompt(mockTheme);
    expect(prompt).toContain('-0.35');
    expect(prompt).toContain('0.72');
  });

  it('should include numbered sample feedback', () => {
    const prompt = buildProposalPrompt(mockTheme);
    expect(prompt).toContain('1. "I need to export all my data');
    expect(prompt).toContain('2. "Please add a CSV export');
    expect(prompt).toContain('3. "The export is broken');
  });

  it('should include JSON response format', () => {
    const prompt = buildProposalPrompt(mockTheme);
    expect(prompt).toContain('"title":');
    expect(prompt).toContain('"problem":');
    expect(prompt).toContain('"solution":');
    expect(prompt).toContain('"impactScore":');
    expect(prompt).toContain('"effortScore":');
    expect(prompt).toContain('"confidenceScore":');
    expect(prompt).toContain('"reachScore":');
  });

  it('should handle null sentiment gracefully', () => {
    const themeWithNull = { ...mockTheme, avgSentiment: null };
    const prompt = buildProposalPrompt(themeWithNull);
    expect(prompt).toContain('N/A');
  });

  it('should handle null category', () => {
    const themeWithNull = { ...mockTheme, category: null };
    const prompt = buildProposalPrompt(themeWithNull);
    expect(prompt).toContain('uncategorized');
  });

  it('should handle empty painPoints array', () => {
    const themeEmpty = { ...mockTheme, painPoints: [] };
    const prompt = buildProposalPrompt(themeEmpty);
    expect(prompt).toContain('Pain Points: ');
  });

  it('should handle empty sampleFeedback array', () => {
    const themeEmpty = { ...mockTheme, sampleFeedback: [] };
    const prompt = buildProposalPrompt(themeEmpty);
    expect(prompt).not.toContain('1. "');
  });
});

describe('buildProposalSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = buildProposalSystemPrompt();
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('should mention product manager role', () => {
    const prompt = buildProposalSystemPrompt();
    expect(prompt.toLowerCase()).toContain('product manager');
  });

  it('should mention JSON response requirement', () => {
    const prompt = buildProposalSystemPrompt();
    expect(prompt.toLowerCase()).toContain('json');
  });
});
```

### 3. Unit Tests: Proposal Service (`proposal.service.test.ts`)

Mock Prisma and AI service to test business logic in isolation.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proposalService, calculateRICE } from '../../src/services/proposal.service';
import { prisma } from '../../src/lib/prisma';
import { aiService } from '../../src/services/ai.service';

// Mock Prisma
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    theme: { findMany: vi.fn() },
    proposal: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    proposalEvidence: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    feedbackThemeLink: { findMany: vi.fn() },
    spec: { deleteMany: vi.fn() },
    $transaction: vi.fn((fns) => Promise.all(fns)),
  },
}));

// Mock AI service
vi.mock('../../src/services/ai.service', () => ({
  aiService: {
    chatJSON: vi.fn(),
    getUsage: vi.fn(() => ({ totalTokens: 500 })),
  },
}));

describe('proposalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFromThemes', () => {
    it('should fetch top N themes by opportunity score', async () => {
      vi.mocked(prisma.theme.findMany).mockResolvedValue([]);

      await expect(proposalService.generateFromThemes(10)).rejects.toThrow('No themes found');

      expect(prisma.theme.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { score: 'desc' },
          take: 10,
        }),
      );
    });

    it('should skip themes with approved proposals', async () => {
      const mockTheme = createMockTheme();
      vi.mocked(prisma.theme.findMany).mockResolvedValue([mockTheme]);
      vi.mocked(prisma.proposal.findFirst).mockResolvedValue({
        id: 'existing',
        status: 'approved',
      } as any);

      const result = await proposalService.generateFromThemes(20);

      expect(result.proposalsSkipped).toBe(1);
      expect(result.proposalsCreated).toBe(0);
      expect(aiService.chatJSON).not.toHaveBeenCalled();
    });

    it('should skip themes with shipped proposals', async () => {
      const mockTheme = createMockTheme();
      vi.mocked(prisma.theme.findMany).mockResolvedValue([mockTheme]);
      vi.mocked(prisma.proposal.findFirst).mockResolvedValue({
        id: 'existing',
        status: 'shipped',
      } as any);

      const result = await proposalService.generateFromThemes(20);
      expect(result.proposalsSkipped).toBe(1);
    });

    it('should delete existing "proposed" proposals before regeneration', async () => {
      const mockTheme = createMockTheme();
      vi.mocked(prisma.theme.findMany).mockResolvedValue([mockTheme]);
      vi.mocked(prisma.proposal.findFirst).mockResolvedValue(null);
      vi.mocked(aiService.chatJSON).mockResolvedValue(createMockGeneratedProposal());
      vi.mocked(prisma.proposal.create).mockResolvedValue({ id: 'new-proposal' } as any);

      await proposalService.generateFromThemes(20);

      expect(prisma.proposalEvidence.deleteMany).toHaveBeenCalled();
      expect(prisma.proposal.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { themeId: mockTheme.id, status: 'proposed' },
        }),
      );
    });

    it('should create proposal with calculated RICE score', async () => {
      const mockTheme = createMockTheme();
      vi.mocked(prisma.theme.findMany).mockResolvedValue([mockTheme]);
      vi.mocked(prisma.proposal.findFirst).mockResolvedValue(null);
      vi.mocked(aiService.chatJSON).mockResolvedValue({
        title: 'Add bulk export',
        problem: 'Users cannot export data',
        solution: 'Add CSV export button',
        impactScore: 7,
        effortScore: 3,
        confidenceScore: 8,
        reachScore: 6,
      });
      vi.mocked(prisma.proposal.create).mockResolvedValue({ id: 'new' } as any);

      await proposalService.generateFromThemes(20);

      expect(prisma.proposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            riceScore: (6 * 7 * 8) / 3, // 112
            status: 'proposed',
            themeId: mockTheme.id,
          }),
        }),
      );
    });

    it('should continue to next theme on LLM failure', async () => {
      const themes = [createMockTheme('t1'), createMockTheme('t2')];
      vi.mocked(prisma.theme.findMany).mockResolvedValue(themes);
      vi.mocked(prisma.proposal.findFirst).mockResolvedValue(null);
      vi.mocked(aiService.chatJSON)
        .mockRejectedValueOnce(new Error('AI error'))
        .mockResolvedValueOnce(createMockGeneratedProposal());
      vi.mocked(prisma.proposal.create).mockResolvedValue({ id: 'new' } as any);

      const result = await proposalService.generateFromThemes(20);

      expect(result.errors.length).toBe(1);
      expect(result.proposalsCreated).toBe(1);
    });

    it('should sanitize malformed AI output', async () => {
      const mockTheme = createMockTheme();
      vi.mocked(prisma.theme.findMany).mockResolvedValue([mockTheme]);
      vi.mocked(prisma.proposal.findFirst).mockResolvedValue(null);
      vi.mocked(aiService.chatJSON).mockResolvedValue({
        title: '', // Empty → fallback
        problem: null, // Null → fallback
        solution: 'Valid solution',
        impactScore: 15, // Over 10 → clamped to 10
        effortScore: -3, // Under 1 → clamped to 1
        confidenceScore: 'high', // String → fallback to 5
        reachScore: 7.8, // Float → rounded to 8
      });
      vi.mocked(prisma.proposal.create).mockResolvedValue({ id: 'new' } as any);

      await proposalService.generateFromThemes(20);

      expect(prisma.proposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Untitled Proposal',
            problem: 'No problem statement generated.',
            solution: 'Valid solution',
            impactScore: 10,
            effortScore: 1,
            confidenceScore: 5,
            reachScore: 8,
          }),
        }),
      );
    });

    it('should return total token usage', async () => {
      vi.mocked(prisma.theme.findMany).mockResolvedValue([createMockTheme()]);
      vi.mocked(prisma.proposal.findFirst).mockResolvedValue(null);
      vi.mocked(aiService.chatJSON).mockResolvedValue(createMockGeneratedProposal());
      vi.mocked(prisma.proposal.create).mockResolvedValue({ id: 'new' } as any);
      vi.mocked(aiService.getUsage).mockReturnValue({ totalTokens: 1200 } as any);

      const result = await proposalService.generateFromThemes(20);
      expect(result.totalTokensUsed).toBe(1200);
    });
  });

  describe('list', () => {
    it('should return paginated proposals sorted by riceScore desc by default', async () => {
      vi.mocked(prisma.proposal.findMany).mockResolvedValue([]);
      vi.mocked(prisma.proposal.count).mockResolvedValue(0);

      const result = await proposalService.list({
        page: 1,
        pageSize: 20,
        sortBy: 'riceScore',
        sortOrder: 'desc',
      });

      expect(prisma.proposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { riceScore: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.proposal.findMany).mockResolvedValue([]);
      vi.mocked(prisma.proposal.count).mockResolvedValue(0);

      await proposalService.list({
        page: 1,
        pageSize: 20,
        status: 'approved',
        sortBy: 'riceScore',
        sortOrder: 'desc',
      });

      expect(prisma.proposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });

    it('should search across title, problem, and solution', async () => {
      vi.mocked(prisma.proposal.findMany).mockResolvedValue([]);
      vi.mocked(prisma.proposal.count).mockResolvedValue(0);

      await proposalService.list({
        page: 1,
        pageSize: 20,
        search: 'export',
        sortBy: 'riceScore',
        sortOrder: 'desc',
      });

      expect(prisma.proposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: { contains: 'export', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('should include evidence count in response', async () => {
      vi.mocked(prisma.proposal.findMany).mockResolvedValue([
        { id: 'p1', _count: { evidence: 7 } } as any,
      ]);
      vi.mocked(prisma.proposal.count).mockResolvedValue(1);

      const result = await proposalService.list({
        page: 1,
        pageSize: 20,
        sortBy: 'riceScore',
        sortOrder: 'desc',
      });

      expect(result.data[0].evidenceCount).toBe(7);
    });
  });

  describe('findById', () => {
    it('should return proposal with evidence and theme', async () => {
      const mockProposal = {
        id: 'p1',
        title: 'Test',
        theme: { id: 't1', name: 'Theme' },
        evidence: [{ id: 'e1', quote: 'A quote', relevance: 0.9 }],
      };
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue(mockProposal as any);

      const result = await proposalService.findById('p1');
      expect(result.evidence).toHaveLength(1);
      expect(result.theme?.name).toBe('Theme');
    });

    it('should throw 404 for non-existent proposal', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue(null);

      await expect(proposalService.findById('nonexistent')).rejects.toThrow('Proposal not found');
    });
  });

  describe('update', () => {
    it('should update text fields without recalculating RICE', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        status: 'proposed',
        reachScore: 5,
        impactScore: 5,
        confidenceScore: 5,
        effortScore: 5,
      } as any);
      vi.mocked(prisma.proposal.update).mockResolvedValue({ id: 'p1' } as any);

      await proposalService.update('p1', { title: 'New title' });

      expect(prisma.proposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ riceScore: expect.anything() }),
        }),
      );
    });

    it('should recalculate RICE when a score changes', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        status: 'proposed',
        reachScore: 8,
        impactScore: 7,
        confidenceScore: 6,
        effortScore: 5,
      } as any);
      vi.mocked(prisma.proposal.update).mockResolvedValue({ id: 'p1' } as any);

      await proposalService.update('p1', { effortScore: 3 });

      expect(prisma.proposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            effortScore: 3,
            riceScore: (8 * 7 * 6) / 3, // 112
          }),
        }),
      );
    });

    it('should validate status transition: proposed -> approved', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        status: 'proposed',
      } as any);
      vi.mocked(prisma.proposal.update).mockResolvedValue({ id: 'p1' } as any);

      await expect(proposalService.update('p1', { status: 'approved' })).resolves.toBeDefined();
    });

    it('should reject invalid transition: proposed -> shipped', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        status: 'proposed',
      } as any);

      await expect(proposalService.update('p1', { status: 'shipped' })).rejects.toThrow(
        'Invalid status transition',
      );
    });

    it('should reject invalid transition: shipped -> proposed', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        status: 'shipped',
      } as any);

      await expect(proposalService.update('p1', { status: 'proposed' })).rejects.toThrow(
        'Invalid status transition',
      );
    });

    it('should allow transition: rejected -> proposed (re-open)', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        status: 'rejected',
      } as any);
      vi.mocked(prisma.proposal.update).mockResolvedValue({ id: 'p1' } as any);

      await expect(proposalService.update('p1', { status: 'proposed' })).resolves.toBeDefined();
    });

    it('should throw 404 for non-existent proposal', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue(null);

      await expect(proposalService.update('nonexistent', { title: 'New' })).rejects.toThrow(
        'Proposal not found',
      );
    });
  });

  describe('delete', () => {
    it('should cascade delete evidence and specs', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({ id: 'p1' } as any);

      await proposalService.delete('p1');

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.anything(), // proposalEvidence.deleteMany
          expect.anything(), // spec.deleteMany
          expect.anything(), // proposal.delete
        ]),
      );
    });

    it('should throw 404 for non-existent proposal', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue(null);

      await expect(proposalService.delete('nonexistent')).rejects.toThrow('Proposal not found');
    });
  });
});

// ─── Test Helpers ────────────────────────────────────────

function createMockTheme(id = 'theme-1') {
  return {
    id,
    name: 'Test Theme',
    description: 'A test theme',
    category: 'feature_request',
    feedbackCount: 10,
    avgSentiment: -0.3,
    avgUrgency: 0.7,
    score: 20,
    feedbackItems: [
      {
        confidence: 0.95,
        feedback: { content: 'Sample feedback one' },
      },
      {
        confidence: 0.88,
        feedback: { content: 'Sample feedback two' },
      },
    ],
  };
}

function createMockGeneratedProposal() {
  return {
    title: 'Add bulk export functionality',
    problem: 'Users cannot export their data in bulk.',
    solution: 'Add a CSV export button to the data table.',
    impactScore: 7,
    effortScore: 3,
    confidenceScore: 8,
    reachScore: 6,
  };
}
```

### 4. Unit Tests: Evidence Service (`evidence.service.test.ts`)

Test evidence linking, quote extraction, and edge cases.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evidenceService } from '../../src/services/evidence.service';
import { prisma } from '../../src/lib/prisma';

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    proposal: { findUnique: vi.fn() },
    proposalEvidence: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    feedbackThemeLink: { findMany: vi.fn() },
  },
}));

describe('evidenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('linkEvidence', () => {
    it('should select top 10 feedback items from source theme', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        themeId: 't1',
        title: 'Export feature',
        problem: 'Cannot export data',
      } as any);

      const mockLinks = Array.from({ length: 15 }, (_, i) => ({
        confidence: 1 - i * 0.05,
        feedback: {
          id: `f${i}`,
          content: `Feedback item ${i} about exporting data`,
          urgency: 0.5,
          sentiment: -0.2,
          author: `User ${i}`,
          channel: 'support_ticket',
        },
      }));
      vi.mocked(prisma.feedbackThemeLink.findMany).mockResolvedValue(mockLinks as any);
      vi.mocked(prisma.proposalEvidence.createMany).mockResolvedValue({ count: 10 } as any);

      const count = await evidenceService.linkEvidence('p1', 10);

      expect(count).toBe(10);
      expect(prisma.feedbackThemeLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: expect.arrayContaining([{ confidence: 'desc' }]),
        }),
      );
    });

    it('should delete existing evidence before re-linking', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        themeId: 't1',
        title: 'Test',
        problem: 'Test',
      } as any);
      vi.mocked(prisma.feedbackThemeLink.findMany).mockResolvedValue([]);

      await evidenceService.linkEvidence('p1');

      expect(prisma.proposalEvidence.deleteMany).toHaveBeenCalledWith({
        where: { proposalId: 'p1' },
      });
    });

    it('should return 0 for proposals without a theme', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        themeId: null,
        title: 'Test',
        problem: 'Test',
      } as any);

      const count = await evidenceService.linkEvidence('p1');
      expect(count).toBe(0);
    });

    it('should return 0 when theme has no feedback items', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        themeId: 't1',
        title: 'Test',
        problem: 'Test',
      } as any);
      vi.mocked(prisma.feedbackThemeLink.findMany).mockResolvedValue([]);

      const count = await evidenceService.linkEvidence('p1');
      expect(count).toBe(0);
    });

    it('should throw 404 for non-existent proposal', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue(null);

      await expect(evidenceService.linkEvidence('nonexistent')).rejects.toThrow(
        'Proposal not found',
      );
    });

    it('should include extracted quotes in evidence records', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        themeId: 't1',
        title: 'Bulk export',
        problem: 'Users need bulk export',
      } as any);
      vi.mocked(prisma.feedbackThemeLink.findMany).mockResolvedValue([
        {
          confidence: 0.95,
          feedback: {
            id: 'f1',
            content:
              'The app is great overall. I really need bulk export for my workflow. The UI looks nice.',
            urgency: 0.8,
            sentiment: -0.3,
            author: 'Jane',
            channel: 'survey',
          },
        },
      ] as any);
      vi.mocked(prisma.proposalEvidence.createMany).mockResolvedValue({ count: 1 } as any);

      await evidenceService.linkEvidence('p1');

      expect(prisma.proposalEvidence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              proposalId: 'p1',
              feedbackId: 'f1',
              relevance: 0.95,
              quote: expect.stringContaining('bulk export'),
            }),
          ]),
        }),
      );
    });

    it('should use skipDuplicates on createMany', async () => {
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        themeId: 't1',
        title: 'Test',
        problem: 'Test',
      } as any);
      vi.mocked(prisma.feedbackThemeLink.findMany).mockResolvedValue([
        {
          confidence: 0.9,
          feedback: {
            id: 'f1',
            content: 'Feedback',
            urgency: null,
            sentiment: null,
            author: null,
            channel: null,
          },
        },
      ] as any);
      vi.mocked(prisma.proposalEvidence.createMany).mockResolvedValue({ count: 1 } as any);

      await evidenceService.linkEvidence('p1');

      expect(prisma.proposalEvidence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        }),
      );
    });
  });

  describe('linkEvidenceForAll', () => {
    it('should process all proposals without evidence', async () => {
      const mockProposals = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
      vi.mocked(prisma.proposal.findMany as any).mockResolvedValue(mockProposals);

      // Mock linkEvidence calls
      vi.mocked(prisma.proposal.findUnique).mockResolvedValue({
        id: 'p1',
        themeId: 't1',
        title: 'T',
        problem: 'P',
      } as any);
      vi.mocked(prisma.feedbackThemeLink.findMany).mockResolvedValue([
        {
          confidence: 0.9,
          feedback: {
            id: 'f1',
            content: 'Content',
            urgency: null,
            sentiment: null,
            author: null,
            channel: null,
          },
        },
      ] as any);
      vi.mocked(prisma.proposalEvidence.createMany).mockResolvedValue({ count: 1 } as any);

      const result = await evidenceService.linkEvidenceForAll();
      expect(result.linked).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEvidence', () => {
    it('should return evidence ordered by relevance desc', async () => {
      vi.mocked(prisma.proposalEvidence.findMany).mockResolvedValue([
        { id: 'e1', relevance: 0.95 },
        { id: 'e2', relevance: 0.8 },
      ] as any);

      const result = await evidenceService.getEvidence('p1');

      expect(prisma.proposalEvidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { relevance: 'desc' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });
});

// ─── Quote Extraction Tests ─────────────────────────────
// These test the internal extractBestQuote function.
// If extractBestQuote is not exported, test it via linkEvidence behavior (above).
// If exported for testing:

describe('extractBestQuote', () => {
  // Import if exported: import { extractBestQuote } from '../../src/services/evidence.service';

  it('should select sentence most relevant to proposal title', () => {
    const content = 'The app is fast. I really need a bulk export feature. The colors are nice.';
    const quote = extractBestQuote(content, 'Bulk export feature', 'Users need bulk export');
    expect(quote).toContain('bulk export');
  });

  it('should prefer medium-length sentences', () => {
    const content =
      'Ok. I really need a way to export all my data because the current export only handles 100 rows at a time. Yes.';
    const quote = extractBestQuote(content, 'Data export', 'Export limitation');
    expect(quote.length).toBeGreaterThan(20);
  });

  it('should boost sentences with urgency signals', () => {
    const content =
      'The product is good. I really need this feature to complete my work. The dashboard looks fine.';
    const quote = extractBestQuote(content, 'Feature request', 'Complete work');
    expect(quote).toContain('need');
  });

  it('should handle single-sentence content', () => {
    const content = 'Please add export functionality.';
    const quote = extractBestQuote(content, 'Export', 'Export');
    expect(quote).toBe('Please add export functionality.');
  });

  it('should handle empty content', () => {
    const quote = extractBestQuote('', 'Title', 'Problem');
    expect(quote).toBe('');
  });

  it('should truncate quotes to 300 characters', () => {
    const longSentence = 'A'.repeat(500) + '.';
    const quote = extractBestQuote(longSentence, 'Title', 'Problem');
    expect(quote.length).toBeLessThanOrEqual(300);
  });

  it('should handle content with only newlines', () => {
    const content = 'First line\nSecond line about export\nThird line';
    const quote = extractBestQuote(content, 'Export feature', 'Export');
    expect(quote).toContain('export');
  });
});
```

### 5. Integration Tests: Proposal Routes (`proposals.routes.test.ts`)

Test the full HTTP request/response cycle with a test database.

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { aiService } from '../../src/services/ai.service';

// Mock AI service for integration tests
vi.mock('../../src/services/ai.service', () => ({
  aiService: {
    chatJSON: vi.fn().mockResolvedValue({
      title: 'Add bulk export',
      problem: 'Users cannot export data in bulk.',
      solution: 'Add a CSV download button.',
      impactScore: 7,
      effortScore: 3,
      confidenceScore: 8,
      reachScore: 6,
    }),
    getUsage: vi.fn().mockReturnValue({ totalTokens: 500, totalCost: 0.01 }),
  },
}));

describe('Proposal Routes', () => {
  let themeId: string;
  let proposalId: string;
  let feedbackIds: string[];

  beforeAll(async () => {
    // Seed: create a source, feedback items, and a theme
    const source = await prisma.feedbackSource.create({
      data: { name: 'Test Source', type: 'manual' },
    });

    const items = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        prisma.feedbackItem.create({
          data: {
            content: `Feedback item ${i} about needing a bulk export feature for large datasets`,
            sourceId: source.id,
            sentiment: -0.3,
            urgency: 0.7,
            channel: 'support_ticket',
          },
        }),
      ),
    );
    feedbackIds = items.map((i) => i.id);

    const theme = await prisma.theme.create({
      data: {
        name: 'Bulk Export Need',
        description: 'Users need bulk export functionality',
        category: 'feature_request',
        feedbackCount: 15,
        avgSentiment: -0.3,
        avgUrgency: 0.7,
        score: 15.3,
      },
    });
    themeId = theme.id;

    // Create FeedbackThemeLinks
    await prisma.feedbackThemeLink.createMany({
      data: feedbackIds.map((fid, i) => ({
        feedbackId: fid,
        themeId: theme.id,
        confidence: 1 - i * 0.05,
      })),
    });
  });

  afterAll(async () => {
    // Clean up in correct order
    await prisma.proposalEvidence.deleteMany();
    await prisma.proposal.deleteMany();
    await prisma.feedbackThemeLink.deleteMany();
    await prisma.theme.deleteMany();
    await prisma.feedbackItem.deleteMany();
    await prisma.feedbackSource.deleteMany();
  });

  describe('POST /api/proposals/generate', () => {
    it('should generate proposals from themes and return result', async () => {
      const res = await request(app).post('/api/proposals/generate').send({ topN: 10 }).expect(201);

      expect(res.body.data.proposalsCreated).toBeGreaterThanOrEqual(1);
      expect(res.body.data.errors).toHaveLength(0);
    });

    it('should accept default topN when not provided', async () => {
      // Clean up from previous test
      await prisma.proposalEvidence.deleteMany();
      await prisma.proposal.deleteMany();

      const res = await request(app).post('/api/proposals/generate').send({}).expect(201);

      expect(res.body.data.proposalsCreated).toBeGreaterThanOrEqual(1);
    });

    it('should return 400 for invalid topN', async () => {
      const res = await request(app).post('/api/proposals/generate').send({ topN: 0 }).expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('should not duplicate proposals on regeneration', async () => {
      // Generate twice
      await request(app).post('/api/proposals/generate').send({}).expect(201);
      await request(app).post('/api/proposals/generate').send({}).expect(201);

      // Count proposals for this theme
      const count = await prisma.proposal.count({ where: { themeId } });
      expect(count).toBe(1); // Only one proposal per theme
    });
  });

  describe('GET /api/proposals', () => {
    beforeEach(async () => {
      // Ensure at least one proposal exists
      const existing = await prisma.proposal.count();
      if (existing === 0) {
        await request(app).post('/api/proposals/generate').send({});
      }
      proposalId = (await prisma.proposal.findFirst())!.id;
    });

    it('should return paginated list of proposals', async () => {
      const res = await request(app).get('/api/proposals').expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('should default sort by riceScore desc', async () => {
      const res = await request(app).get('/api/proposals').expect(200);

      if (res.body.data.length > 1) {
        expect(res.body.data[0].riceScore).toBeGreaterThanOrEqual(res.body.data[1].riceScore);
      }
    });

    it('should filter by status', async () => {
      const res = await request(app).get('/api/proposals?status=proposed').expect(200);

      res.body.data.forEach((p: any) => {
        expect(p.status).toBe('proposed');
      });
    });

    it('should include evidenceCount', async () => {
      const res = await request(app).get('/api/proposals').expect(200);

      expect(res.body.data[0]).toHaveProperty('evidenceCount');
      expect(typeof res.body.data[0].evidenceCount).toBe('number');
    });

    it('should include theme name', async () => {
      const res = await request(app).get('/api/proposals').expect(200);

      expect(res.body.data[0].theme).toBeDefined();
      expect(res.body.data[0].theme.name).toBe('Bulk Export Need');
    });

    it('should search by title', async () => {
      const res = await request(app).get('/api/proposals?search=bulk').expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for search with no matches', async () => {
      const res = await request(app).get('/api/proposals?search=zzzznonexistentzzzz').expect(200);

      expect(res.body.data).toHaveLength(0);
    });

    it('should sort by createdAt ascending', async () => {
      const res = await request(app)
        .get('/api/proposals?sortBy=createdAt&sortOrder=asc')
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/proposals/:id', () => {
    it('should return proposal with evidence array', async () => {
      const res = await request(app).get(`/api/proposals/${proposalId}`).expect(200);

      expect(res.body.data.id).toBe(proposalId);
      expect(res.body.data.evidence).toBeInstanceOf(Array);
      expect(res.body.data.theme).toBeDefined();
    });

    it('should return evidence with quotes', async () => {
      const res = await request(app).get(`/api/proposals/${proposalId}`).expect(200);

      if (res.body.data.evidence.length > 0) {
        expect(res.body.data.evidence[0]).toHaveProperty('quote');
        expect(res.body.data.evidence[0]).toHaveProperty('relevance');
        expect(res.body.data.evidence[0]).toHaveProperty('feedback');
      }
    });

    it('should return 404 for non-existent ID', async () => {
      await request(app).get('/api/proposals/clxxxxxxxxxxxxxxxxxx').expect(404);
    });
  });

  describe('PATCH /api/proposals/:id', () => {
    it('should update proposal title', async () => {
      const res = await request(app)
        .patch(`/api/proposals/${proposalId}`)
        .send({ title: 'Updated Bulk Export Feature' })
        .expect(200);

      expect(res.body.data.title).toBe('Updated Bulk Export Feature');
    });

    it('should recalculate RICE when score changes', async () => {
      const before = await request(app).get(`/api/proposals/${proposalId}`).expect(200);
      const oldRice = before.body.data.riceScore;

      const res = await request(app)
        .patch(`/api/proposals/${proposalId}`)
        .send({ effortScore: 1 })
        .expect(200);

      expect(res.body.data.riceScore).not.toBe(oldRice);
      expect(res.body.data.effortScore).toBe(1);
    });

    it('should transition status from proposed to approved', async () => {
      // Reset status to proposed first
      await prisma.proposal.update({ where: { id: proposalId }, data: { status: 'proposed' } });

      const res = await request(app)
        .patch(`/api/proposals/${proposalId}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(res.body.data.status).toBe('approved');
    });

    it('should transition status from approved to shipped', async () => {
      const res = await request(app)
        .patch(`/api/proposals/${proposalId}`)
        .send({ status: 'shipped' })
        .expect(200);

      expect(res.body.data.status).toBe('shipped');
    });

    it('should reject invalid status transition: shipped -> proposed', async () => {
      await request(app)
        .patch(`/api/proposals/${proposalId}`)
        .send({ status: 'proposed' })
        .expect(400);
    });

    it('should return 400 for empty body', async () => {
      await request(app).patch(`/api/proposals/${proposalId}`).send({}).expect(400);
    });

    it('should return 400 for out-of-range score', async () => {
      await request(app)
        .patch(`/api/proposals/${proposalId}`)
        .send({ impactScore: 11 })
        .expect(400);
    });

    it('should return 404 for non-existent proposal', async () => {
      await request(app)
        .patch('/api/proposals/clxxxxxxxxxxxxxxxxxx')
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/proposals/:id', () => {
    it('should delete proposal and cascade to evidence', async () => {
      // Create a fresh proposal for deletion
      const newProposal = await prisma.proposal.create({
        data: {
          title: 'To Delete',
          description: 'Will be deleted',
          problem: 'Test problem',
          solution: 'Test solution',
          status: 'proposed',
          themeId,
        },
      });

      await request(app).delete(`/api/proposals/${newProposal.id}`).expect(204);

      // Verify it is gone
      const found = await prisma.proposal.findUnique({ where: { id: newProposal.id } });
      expect(found).toBeNull();
    });

    it('should return 404 for non-existent proposal', async () => {
      await request(app).delete('/api/proposals/clxxxxxxxxxxxxxxxxxx').expect(404);
    });
  });
});
```

### 6. Add mock helpers for proposal tests

Extend the existing test helpers with proposal-specific seed data.

```typescript
// packages/api/tests/helpers/openai-mock.ts (additions)

export function mockProposalGenerationResponse() {
  return {
    title: 'Add bulk export functionality',
    problem:
      'Users frequently need to export large datasets but the current export is limited to 100 rows.',
    solution: 'Add a CSV/JSON bulk export endpoint that streams data for large datasets.',
    impactScore: 7,
    effortScore: 3,
    confidenceScore: 8,
    reachScore: 6,
  };
}

// packages/api/tests/helpers/seed.ts (additions)

export async function seedThemeWithFeedback(prisma: PrismaClient, count: number = 10) {
  const source = await prisma.feedbackSource.create({
    data: { name: 'Test Source', type: 'manual' },
  });

  const items = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      prisma.feedbackItem.create({
        data: {
          content: `Test feedback item ${i}: I need bulk export functionality for handling large datasets efficiently.`,
          sourceId: source.id,
          sentiment: -0.2 - i * 0.05,
          urgency: 0.5 + i * 0.03,
          channel: 'support_ticket',
        },
      }),
    ),
  );

  const theme = await prisma.theme.create({
    data: {
      name: 'Bulk Export Need',
      description: 'Users need to export data in bulk',
      category: 'feature_request',
      feedbackCount: count,
      avgSentiment: -0.3,
      avgUrgency: 0.7,
      score: count * 0.7 * (1 - -0.3),
    },
  });

  await prisma.feedbackThemeLink.createMany({
    data: items.map((item, i) => ({
      feedbackId: item.id,
      themeId: theme.id,
      confidence: 1 - i * 0.05,
    })),
  });

  return { source, items, theme };
}

export async function cleanupProposalTests(prisma: PrismaClient) {
  await prisma.proposalEvidence.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.feedbackThemeLink.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.feedbackItem.deleteMany();
  await prisma.feedbackSource.deleteMany();
}
```

### 7. Coverage targets and test organization

**Required coverage targets:**

| File                    | Target | Focus Areas                                             |
| ----------------------- | ------ | ------------------------------------------------------- |
| `proposal.service.ts`   | >80%   | Generation loop, sanitization, RICE, status transitions |
| `evidence.service.ts`   | >80%   | linkEvidence, quote extraction, edge cases              |
| `proposals.ts` (routes) | >80%   | All 5 endpoints, error responses                        |
| `proposal.schema.ts`    | >90%   | All Zod schemas validate and reject correctly           |

**Test run command:**

```bash
# Run all proposal tests
npx vitest run --reporter=verbose tests/unit/proposal.service.test.ts tests/unit/evidence.service.test.ts tests/unit/rice.test.ts tests/unit/proposal-prompt.test.ts tests/integration/proposals.routes.test.ts

# Run with coverage
npx vitest run --coverage --reporter=verbose tests/unit/proposal*.test.ts tests/unit/rice.test.ts tests/unit/evidence.service.test.ts tests/integration/proposals.routes.test.ts
```

**Total test count estimate:**

| Test File                  | Approx. Test Cases |
| -------------------------- | ------------------ |
| `rice.test.ts`             | 9                  |
| `proposal-prompt.test.ts`  | 12                 |
| `proposal.service.test.ts` | 18                 |
| `evidence.service.test.ts` | 14                 |
| `proposals.routes.test.ts` | 20                 |
| **Total**                  | **~73**            |

## Acceptance Criteria

- [ ] All RICE calculation unit tests pass (9 cases including edge cases)
- [ ] All prompt template tests pass (12 cases including null/empty handling)
- [ ] All proposal service unit tests pass with mocked Prisma and AI service
- [ ] Proposal generation handles malformed AI output (sanitization tested)
- [ ] Status transitions validated: all valid transitions pass, all invalid transitions rejected
- [ ] RICE recalculation on partial score update tested
- [ ] All evidence service unit tests pass (14 cases)
- [ ] Quote extraction selects relevant sentences (keyword overlap tested)
- [ ] Evidence linking is idempotent (re-linking tested)
- [ ] All 20 integration test cases pass against test database
- [ ] Integration tests: generate, list, get, update, delete all return correct status codes
- [ ] Integration tests: status transitions work end-to-end
- [ ] Integration tests: search, filter, sort work correctly
- [ ] Integration tests: evidence included in proposal detail response
- [ ] Test database cleaned up after each test suite
- [ ] > 80% coverage on proposal.service.ts
- [ ] > 80% coverage on evidence.service.ts
- [ ] > 80% coverage on proposals.ts routes
- [ ] All tests are deterministic (no random data, no timing dependencies)
- [ ] `npm test` runs all proposal tests and reports results

## Complexity Estimate

**L (Large)** -- 5 test files, ~73 individual test cases. Requires mock setup for Prisma and AI service, integration test database seeding with themes/feedback/links, and thorough edge case coverage for sanitization and status transitions.

## Risk Factors & Mitigations

| Risk                                                             | Impact                             | Mitigation                                                                |
| ---------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| Integration tests slow due to database operations                | Medium -- slow CI                  | Use transactions for test isolation; parallelize independent test suites  |
| Prisma mock does not match real behavior (e.g., cascade deletes) | High -- false positives            | Integration tests catch discrepancies; keep mocks aligned with schema     |
| Quote extraction tests fragile (sentence splitting varies)       | Medium -- flaky tests              | Test with fixed, unambiguous content; avoid edge-case-heavy real text     |
| Test database state leaks between test suites                    | High -- non-deterministic failures | Use beforeAll/afterAll cleanup; run suites in isolation if needed         |
| Mock AI response shape drifts from real service                  | Medium -- false positives          | Keep mock response aligned with GeneratedProposal type; type-check mocks  |
| Coverage tool misreports on service files with many branches     | Low -- misleading metrics          | Review uncovered lines manually; focus on meaningful coverage, not just % |
