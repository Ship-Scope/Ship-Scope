# 04 -- Spec Tests

## Objective

Write comprehensive unit and integration tests for the entire spec generation pipeline: PRD prompt construction, agent prompt building (both Cursor and Claude Code formats), PRD section parsing, spec service functions (generate, retrieve, version bumping), and all spec API routes. Achieve >80% coverage on `spec.service.ts` and `packages/core/src/prompts/specs.ts`. All OpenAI calls are mocked to ensure tests are deterministic, fast, and free of API cost.

## Dependencies

- 01 (PRD Generation) -- spec.service.ts, route handlers, PRD prompt template
- 02 (Agent Prompt Export) -- buildAgentPrompt(), extractSection(), format builders
- Phase 1: Testing infrastructure (Vitest, Supertest, vitest-mock-extended, test setup)
- Phase 4: Proposal test fixtures (need proposal + evidence test data)

## Files to Create

| File                                                  | Purpose                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/api/tests/unit/spec.service.test.ts`        | Unit tests for spec generation, retrieval, version management                |
| `packages/api/tests/unit/spec-prompts.test.ts`        | Unit tests for PRD prompt builder, agent prompt builder, section extraction  |
| `packages/api/tests/integration/specs.routes.test.ts` | Integration tests for all spec API endpoints                                 |
| `packages/api/tests/helpers/spec-fixtures.ts`         | Test data factories for specs, proposals with evidence, and mock PRD content |

## Files to Modify

| File                                        | Changes                                           |
| ------------------------------------------- | ------------------------------------------------- |
| `packages/api/tests/helpers/openai-mock.ts` | Add `mockPRDResponse()` for spec generation tests |

## Detailed Sub-Tasks

### 1. Create test data fixtures (`packages/api/tests/helpers/spec-fixtures.ts`)

Centralized test data that mirrors production shapes. These fixtures are used across all spec test files.

```typescript
import type { ProposalWithEvidence } from '@shipscope/core/types/proposal';

/**
 * A realistic mock proposal with evidence, suitable for PRD generation tests.
 */
export function createMockProposalWithEvidence(
  overrides?: Partial<ProposalWithEvidence>,
): ProposalWithEvidence {
  return {
    id: 'proposal-test-001',
    title: 'Add Bulk Export to CSV',
    description: 'Users need to export their data in bulk as CSV files for reporting.',
    problem:
      'Users cannot export more than 100 rows at a time. Enterprise customers with thousands of records must make dozens of manual exports, wasting hours each month.',
    solution:
      'Add a "Export All" button that generates a CSV file containing all filtered results. Support background generation for large datasets with a download notification when complete.',
    impactScore: 8,
    effortScore: 4,
    confidenceScore: 7,
    reachScore: 9,
    riceScore: 126.0, // (9 * 8 * 7) / 4
    status: 'approved',
    themeId: 'theme-test-001',
    theme: {
      id: 'theme-test-001',
      name: 'Bulk Data Export',
      category: 'feature_request',
    },
    evidence: [
      {
        id: 'ev-001',
        quote: 'I spend 2 hours every week manually exporting data page by page.',
        relevance: 0.95,
        feedback: {
          id: 'fb-001',
          content:
            'I spend 2 hours every week manually exporting data page by page. This is incredibly frustrating for our team.',
          author: 'Sarah Chen',
          channel: 'support_ticket',
        },
      },
      {
        id: 'ev-002',
        quote: 'Our compliance team needs full data exports for quarterly audits.',
        relevance: 0.88,
        feedback: {
          id: 'fb-002',
          content:
            'Our compliance team needs full data exports for quarterly audits. The current 100-row limit makes this basically impossible.',
          author: 'Mike Torres',
          channel: 'interview',
        },
      },
      {
        id: 'ev-003',
        quote: 'We switched to a competitor because they had one-click CSV export.',
        relevance: 0.82,
        feedback: {
          id: 'fb-003',
          content:
            'We switched to a competitor because they had one-click CSV export. If you add this, we would come back.',
          author: null,
          channel: 'survey',
        },
      },
    ],
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    ...overrides,
  };
}

/**
 * A realistic mock PRD markdown string, structured with all 10 required sections.
 */
export const MOCK_PRD_MARKDOWN = `# Add Bulk Export to CSV

## Overview
This feature adds bulk CSV export capability to the application, allowing users to export all filtered results in a single action. Background generation supports large datasets without blocking the UI.

## Problem Statement
Enterprise customers with thousands of records are forced to make dozens of manual exports due to the current 100-row limit per export. This wastes an average of 2 hours per week per affected user and has caused customer churn.

## User Stories
- As a data analyst, I want to export all filtered results as a CSV so that I can perform analysis in Excel without manual pagination.
- As a compliance officer, I want to export a complete dataset for quarterly audits so that I can meet regulatory reporting deadlines.
- As a team lead, I want to schedule recurring exports so that I receive fresh data each Monday morning.

## Acceptance Criteria
1. User can click "Export All" button to generate a CSV of all filtered results
2. Export includes all visible columns plus metadata (ID, created date)
3. Exports with more than 10,000 rows are processed in the background
4. User receives a notification when background export is complete
5. Download link is valid for 24 hours after generation
6. Export respects current filter and sort settings
7. CSV file uses UTF-8 encoding with BOM for Excel compatibility

## Edge Cases
- Empty result set: show toast "No data to export" instead of generating empty file
- Export in progress: disable button and show "Exporting..." state
- User navigates away during background export: export continues, notification appears on return
- Very large dataset (>100K rows): warn user about estimated generation time
- Special characters in data: properly escape commas, quotes, and newlines in CSV

## Data Model Changes
\`\`\`prisma
model Export {
  id        String   @id @default(cuid())
  userId    String
  status    String   @default("pending") // pending, processing, complete, failed
  fileUrl   String?
  rowCount  Int?
  filters   Json?
  expiresAt DateTime?
  createdAt DateTime @default(now())
}
\`\`\`

## API Changes
\`\`\`
POST /api/exports         - Trigger new export (returns exportId)
GET  /api/exports/:id     - Check export status and get download URL
GET  /api/exports         - List user's recent exports
\`\`\`

## UI/UX Requirements
- "Export All" button in the toolbar next to existing filter controls
- Progress indicator for background exports (percentage bar in notification area)
- Download modal with file size, row count, and expiration time
- Toast notification when export completes

## Out of Scope
- PDF export (future iteration)
- Scheduled/recurring exports (future iteration)
- Export templates or custom column selection
- Direct email delivery of exports

## Open Questions
- Should we limit the maximum export size (e.g., 1M rows)?
- Do we need to track export analytics (who exports, how often)?
- Should the download URL require authentication?`;

/**
 * A mock PRD with missing sections (for validation testing).
 */
export const MOCK_INCOMPLETE_PRD = `# Incomplete Feature

## Overview
This is an incomplete PRD for testing.

## Problem Statement
Users have a problem.

## User Stories
- As a user, I want something.

## Acceptance Criteria
1. It works.

## Edge Cases
- None identified.
`;
// Missing: Data Model Changes, API Changes, UI/UX Requirements, Out of Scope, Open Questions

/**
 * Database seed helper: create a proposal with evidence in the test DB.
 */
export async function seedProposalWithEvidence(prisma: any): Promise<string> {
  const source = await prisma.feedbackSource.create({
    data: { name: 'Test Source', type: 'manual' },
  });

  const feedbackItems = await Promise.all([
    prisma.feedbackItem.create({
      data: {
        content: 'I spend 2 hours every week manually exporting data page by page.',
        sourceId: source.id,
        author: 'Sarah Chen',
        channel: 'support_ticket',
        processed: true,
      },
    }),
    prisma.feedbackItem.create({
      data: {
        content: 'Our compliance team needs full data exports for quarterly audits.',
        sourceId: source.id,
        author: 'Mike Torres',
        channel: 'interview',
        processed: true,
      },
    }),
  ]);

  const theme = await prisma.theme.create({
    data: {
      name: 'Bulk Data Export',
      description: 'Users need bulk export functionality',
      category: 'feature_request',
      feedbackCount: 2,
    },
  });

  const proposal = await prisma.proposal.create({
    data: {
      title: 'Add Bulk Export to CSV',
      description: 'Users need bulk CSV export.',
      problem: 'Cannot export more than 100 rows at a time.',
      solution: 'Add Export All button with background processing.',
      impactScore: 8,
      effortScore: 4,
      confidenceScore: 7,
      reachScore: 9,
      riceScore: 126.0,
      status: 'approved',
      themeId: theme.id,
    },
  });

  await Promise.all(
    feedbackItems.map((fb, i) =>
      prisma.proposalEvidence.create({
        data: {
          proposalId: proposal.id,
          feedbackId: fb.id,
          relevance: 0.95 - i * 0.1,
          quote: fb.content.slice(0, 80),
        },
      }),
    ),
  );

  return proposal.id;
}
```

### 2. Add mock PRD response to OpenAI mock helpers

```typescript
// packages/api/tests/helpers/openai-mock.ts (additions)

import { MOCK_PRD_MARKDOWN } from './spec-fixtures';

/**
 * Mock OpenAI chat completion response for PRD generation.
 * Returns a realistic PRD markdown string.
 */
export function mockChatTextResponse(content: string = MOCK_PRD_MARKDOWN) {
  return {
    choices: [
      {
        message: { content, role: 'assistant' },
        finish_reason: 'stop',
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 800,
      completion_tokens: 2400,
      total_tokens: 3200,
    },
  };
}

/**
 * Mock an empty/failed PRD response.
 */
export function mockEmptyChatResponse() {
  return {
    choices: [
      {
        message: { content: '', role: 'assistant' },
        finish_reason: 'stop',
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 800,
      completion_tokens: 0,
      total_tokens: 800,
    },
  };
}
```

### 3. Unit Tests: Spec Prompts (`spec-prompts.test.ts`)

Test the prompt builders and section extractors from `packages/core/src/prompts/specs.ts`.

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildPRDPrompt,
  buildPRDSystemPrompt,
  buildAgentPrompt,
  extractSection,
  buildPromptContext,
} from '@shipscope/core/prompts/specs';
import {
  createMockProposalWithEvidence,
  MOCK_PRD_MARKDOWN,
  MOCK_INCOMPLETE_PRD,
} from '../helpers/spec-fixtures';

describe('buildPRDPrompt', () => {
  const proposal = createMockProposalWithEvidence();

  it('should include the proposal title in the prompt', () => {
    const prompt = buildPRDPrompt(proposal);
    expect(prompt).toContain('Add Bulk Export to CSV');
  });

  it('should include the problem statement', () => {
    const prompt = buildPRDPrompt(proposal);
    expect(prompt).toContain(proposal.problem);
  });

  it('should include the solution description', () => {
    const prompt = buildPRDPrompt(proposal);
    expect(prompt).toContain(proposal.solution);
  });

  it('should include all evidence quotes', () => {
    const prompt = buildPRDPrompt(proposal);
    proposal.evidence.forEach((e) => {
      expect(prompt).toContain(e.quote);
    });
  });

  it('should include evidence author names', () => {
    const prompt = buildPRDPrompt(proposal);
    expect(prompt).toContain('Sarah Chen');
    expect(prompt).toContain('Mike Torres');
  });

  it('should handle evidence with null author (Anonymous)', () => {
    const prompt = buildPRDPrompt(proposal);
    expect(prompt).toContain('Anonymous');
  });

  it('should include evidence channel', () => {
    const prompt = buildPRDPrompt(proposal);
    expect(prompt).toContain('support_ticket');
    expect(prompt).toContain('interview');
  });

  it('should include the evidence count', () => {
    const prompt = buildPRDPrompt(proposal);
    expect(prompt).toContain(`${proposal.evidence.length}`);
  });

  it('should request all 10 required PRD sections', () => {
    const prompt = buildPRDPrompt(proposal);
    const requiredSections = [
      'Overview',
      'Problem Statement',
      'User Stories',
      'Acceptance Criteria',
      'Edge Cases',
      'Data Model Changes',
      'API Changes',
      'UI/UX Requirements',
      'Out of Scope',
      'Open Questions',
    ];
    requiredSections.forEach((section) => {
      expect(prompt).toContain(`## ${section}`);
    });
  });

  it('should handle proposal with empty evidence array', () => {
    const emptyEvidence = createMockProposalWithEvidence({ evidence: [] });
    const prompt = buildPRDPrompt(emptyEvidence);
    expect(prompt).toContain('0 user feedback items');
    expect(prompt).toBeDefined();
  });
});

describe('buildPRDSystemPrompt', () => {
  it('should return a non-empty system prompt', () => {
    const systemPrompt = buildPRDSystemPrompt();
    expect(systemPrompt.length).toBeGreaterThan(50);
  });

  it('should instruct the LLM to write in markdown format', () => {
    const systemPrompt = buildPRDSystemPrompt();
    expect(systemPrompt.toLowerCase()).toContain('markdown');
  });

  it('should instruct specific and actionable output', () => {
    const systemPrompt = buildPRDSystemPrompt();
    expect(systemPrompt.toLowerCase()).toContain('specific');
    expect(systemPrompt.toLowerCase()).toContain('actionable');
  });
});

describe('extractSection', () => {
  it('should extract the Overview section from a full PRD', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'Overview');
    expect(section).toContain('bulk CSV export capability');
  });

  it('should extract the Problem Statement section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'Problem Statement');
    expect(section).toContain('Enterprise customers');
  });

  it('should extract the User Stories section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'User Stories');
    expect(section).toContain('As a data analyst');
    expect(section).toContain('As a compliance officer');
  });

  it('should extract the Acceptance Criteria section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'Acceptance Criteria');
    expect(section).toContain('Export All');
    expect(section).toContain('UTF-8');
  });

  it('should extract the Edge Cases section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'Edge Cases');
    expect(section).toContain('Empty result set');
  });

  it('should extract the Data Model Changes section with code blocks', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'Data Model Changes');
    expect(section).toContain('model Export');
  });

  it('should extract the API Changes section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'API Changes');
    expect(section).toContain('POST /api/exports');
  });

  it('should extract the UI/UX Requirements section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'UI/UX Requirements');
    expect(section).toContain('Export All');
    expect(section).toContain('toolbar');
  });

  it('should extract the Out of Scope section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'Out of Scope');
    expect(section).toContain('PDF export');
  });

  it('should extract the Open Questions section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'Open Questions');
    expect(section).toContain('maximum export size');
  });

  it('should return empty string for non-existent section', () => {
    const section = extractSection(MOCK_PRD_MARKDOWN, 'Non-Existent Section');
    expect(section).toBe('');
  });

  it('should handle headings with trailing colons', () => {
    const markdown = '## Edge Cases:\n- item 1\n- item 2\n\n## Next Section\n';
    const section = extractSection(markdown, 'Edge Cases');
    expect(section).toContain('item 1');
  });

  it('should handle extra whitespace in headings', () => {
    const markdown = '##   Overview  \nContent here.\n\n## Next\n';
    const section = extractSection(markdown, 'Overview');
    expect(section).toContain('Content here');
  });

  it('should handle fuzzy matching (partial heading name)', () => {
    const markdown = '## UI Requirements\nUI content here.\n\n## Next\n';
    const section = extractSection(markdown, 'UI/UX Requirements');
    expect(section).toContain('UI content here');
  });
});

describe('buildPromptContext', () => {
  const proposal = createMockProposalWithEvidence();

  it('should assemble all fields from PRD and proposal', () => {
    const ctx = buildPromptContext(MOCK_PRD_MARKDOWN, proposal);

    expect(ctx.title).toBe('Add Bulk Export to CSV');
    expect(ctx.problem).toBe(proposal.problem);
    expect(ctx.solution).toBe(proposal.solution);
    expect(ctx.themeName).toBe('Bulk Data Export');
    expect(ctx.riceScore).toBe(126.0);
    expect(ctx.evidenceCount).toBe(3);
  });

  it('should extract acceptance criteria from PRD', () => {
    const ctx = buildPromptContext(MOCK_PRD_MARKDOWN, proposal);
    expect(ctx.acceptanceCriteria).toContain('Export All');
  });

  it('should extract data model changes from PRD', () => {
    const ctx = buildPromptContext(MOCK_PRD_MARKDOWN, proposal);
    expect(ctx.dataModelChanges).toContain('model Export');
  });

  it('should derive test cases from acceptance criteria and edge cases', () => {
    const ctx = buildPromptContext(MOCK_PRD_MARKDOWN, proposal);
    expect(ctx.testCases).toContain('should');
  });

  it('should handle proposal with no theme', () => {
    const noTheme = createMockProposalWithEvidence({ theme: null, themeId: null });
    const ctx = buildPromptContext(MOCK_PRD_MARKDOWN, noTheme);
    expect(ctx.themeName).toBeNull();
  });
});

describe('buildAgentPrompt', () => {
  const proposal = createMockProposalWithEvidence();

  describe('Cursor format', () => {
    it('should produce a non-empty prompt', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('should use ## headers (H2)', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt).toContain('## Task');
      expect(prompt).toContain('## Requirements');
    });

    it('should NOT use # headers (H1)', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      // Should not start any line with a single # (H1)
      const h1Lines = prompt.split('\n').filter((l) => /^# [^#]/.test(l));
      expect(h1Lines.length).toBe(0);
    });

    it('should include the task title', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt).toContain('Add Bulk Export to CSV');
    });

    it('should include acceptance criteria', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt).toContain('Export All');
    });

    it('should include data model changes when present', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt).toContain('model Export');
    });

    it('should omit data model section when content is "None"', () => {
      const noneDataModel = MOCK_PRD_MARKDOWN.replace(
        /## Data Model Changes[\s\S]*?(?=\n## )/,
        '## Data Model Changes\nNone\n\n',
      );
      const prompt = buildAgentPrompt(noneDataModel, proposal, 'cursor');
      expect(prompt).not.toContain('## Data Model Changes');
    });

    it('should include edge cases', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt).toContain('Edge Cases');
    });

    it('should include test cases', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt).toContain('Tests');
    });

    it('should include theme context when available', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt).toContain('Bulk Data Export');
    });

    it('should include RICE score when available', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(prompt).toContain('126.0');
    });
  });

  describe('Claude Code format', () => {
    it('should produce a non-empty prompt', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'claude-code');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('should use # header (H1) for the title', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'claude-code');
      expect(prompt).toMatch(/^# Feature Implementation:/m);
    });

    it('should include numbered implementation steps', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'claude-code');
      expect(prompt).toContain('### Step 1');
      expect(prompt).toContain('### Step 2');
    });

    it('should include design system tokens', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'claude-code');
      expect(prompt).toContain('#07080A');
      expect(prompt).toContain('#0D0F12');
      expect(prompt).toContain('#3B82F6');
    });

    it('should mention Vitest and Supertest', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'claude-code');
      expect(prompt).toContain('Vitest');
      expect(prompt).toContain('Supertest');
    });

    it('should include explicit "Do NOT implement" for out of scope', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'claude-code');
      expect(prompt).toContain('Do NOT implement');
    });

    it('should mention thin-route pattern for API implementation', () => {
      const prompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'claude-code');
      expect(prompt).toContain('thin-route');
    });

    it('should be longer than Cursor format', () => {
      const cursorPrompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      const claudePrompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'claude-code');
      expect(claudePrompt.length).toBeGreaterThan(cursorPrompt.length);
    });
  });

  describe('format validation', () => {
    it('should default to cursor format when no format specified', () => {
      const defaultPrompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal);
      const cursorPrompt = buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'cursor');
      expect(defaultPrompt).toBe(cursorPrompt);
    });

    it('should throw for unknown format', () => {
      expect(() => {
        buildAgentPrompt(MOCK_PRD_MARKDOWN, proposal, 'unknown' as any);
      }).toThrow();
    });
  });

  describe('with incomplete PRD', () => {
    it('should handle missing sections gracefully', () => {
      const prompt = buildAgentPrompt(MOCK_INCOMPLETE_PRD, proposal, 'cursor');
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(50);
    });

    it('should still include available sections', () => {
      const prompt = buildAgentPrompt(MOCK_INCOMPLETE_PRD, proposal, 'cursor');
      expect(prompt).toContain('Add Bulk Export to CSV');
    });
  });
});
```

### 4. Unit Tests: Spec Service (`spec.service.test.ts`)

Mock Prisma and the AI service to test spec.service.ts in isolation.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import { MOCK_PRD_MARKDOWN, createMockProposalWithEvidence } from '../helpers/spec-fixtures';

// Mock dependencies
vi.mock('../../src/lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

vi.mock('../../src/services/ai.service', () => ({
  aiService: {
    chatText: vi.fn(),
    chatJSON: vi.fn(),
    getUsage: vi.fn(() => ({ totalTokens: 3200, totalCost: 0.002 })),
  },
}));

vi.mock('@shipscope/core/prompts/specs', () => ({
  buildPRDPrompt: vi.fn(() => 'mock prd prompt'),
  buildPRDSystemPrompt: vi.fn(() => 'mock system prompt'),
  buildAgentPrompt: vi.fn(() => 'mock agent prompt'),
}));

import { prisma } from '../../src/lib/prisma';
import { aiService } from '../../src/services/ai.service';
import { specService } from '../../src/services/spec.service';

const mockPrisma = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

beforeEach(() => {
  mockReset(mockPrisma);
  vi.clearAllMocks();
});

describe('specService', () => {
  describe('generatePRD', () => {
    it('should generate a PRD for an approved proposal', async () => {
      // Setup: proposal exists and is approved
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'proposal-1',
        title: 'Test Feature',
        description: 'Test',
        problem: 'Test problem',
        solution: 'Test solution',
        status: 'approved',
        impactScore: 8,
        effortScore: 4,
        confidenceScore: 7,
        reachScore: 9,
        riceScore: 126.0,
        themeId: 'theme-1',
        theme: { id: 'theme-1', name: 'Test Theme', category: 'feature_request' },
        evidence: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockPrisma.spec.findFirst.mockResolvedValue(null); // No existing spec
      (aiService.chatText as any).mockResolvedValue(MOCK_PRD_MARKDOWN);
      mockPrisma.spec.create.mockResolvedValue({
        id: 'spec-1',
        proposalId: 'proposal-1',
        prd: MOCK_PRD_MARKDOWN,
        agentPrompt: 'mock agent prompt',
        createdAt: new Date(),
        updatedAt: new Date(),
        proposal: { id: 'proposal-1', title: 'Test Feature', status: 'approved', riceScore: 126 },
      } as any);

      const result = await specService.generatePRD('proposal-1');

      expect(result.isRegeneration).toBe(false);
      expect(result.previousVersion).toBeNull();
      expect(result.spec.prd).toBe(MOCK_PRD_MARKDOWN);
      expect(aiService.chatText).toHaveBeenCalledOnce();
      expect(mockPrisma.spec.create).toHaveBeenCalledOnce();
    });

    it('should throw 404 for non-existent proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(specService.generatePRD('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('should throw 400 for non-approved proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'proposal-1',
        status: 'proposed',
        // ... other fields
      } as any);

      await expect(specService.generatePRD('proposal-1')).rejects.toThrow(/approved/i);
    });

    it('should throw 400 for rejected proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'proposal-1',
        status: 'rejected',
      } as any);

      await expect(specService.generatePRD('proposal-1')).rejects.toThrow(/approved/i);
    });

    it('should update existing spec on regeneration (bump version)', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'proposal-1',
        status: 'approved',
        title: 'Test',
        problem: 'problem',
        solution: 'solution',
        description: 'desc',
        themeId: null,
        theme: null,
        evidence: [],
        impactScore: 5,
        effortScore: 5,
        confidenceScore: 5,
        reachScore: 5,
        riceScore: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockPrisma.spec.findFirst.mockResolvedValue({
        id: 'spec-existing',
        proposalId: 'proposal-1',
        version: 2,
      } as any);

      (aiService.chatText as any).mockResolvedValue(MOCK_PRD_MARKDOWN);
      mockPrisma.spec.update.mockResolvedValue({
        id: 'spec-existing',
        proposalId: 'proposal-1',
        prd: MOCK_PRD_MARKDOWN,
        agentPrompt: 'mock agent prompt',
        proposal: { id: 'proposal-1', title: 'Test', status: 'approved', riceScore: 25 },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await specService.generatePRD('proposal-1');

      expect(result.isRegeneration).toBe(true);
      expect(result.previousVersion).toBe(2);
      expect(mockPrisma.spec.update).toHaveBeenCalledOnce();
      expect(mockPrisma.spec.create).not.toHaveBeenCalled();
    });

    it('should throw 502 on empty AI response', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'proposal-1',
        status: 'approved',
        title: 'Test',
        problem: 'problem',
        solution: 'solution',
        description: 'desc',
        themeId: null,
        theme: null,
        evidence: [],
        impactScore: 5,
        effortScore: 5,
        confidenceScore: 5,
        reachScore: 5,
        riceScore: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockPrisma.spec.findFirst.mockResolvedValue(null);
      (aiService.chatText as any).mockResolvedValue('');

      await expect(specService.generatePRD('proposal-1')).rejects.toThrow(/empty|insufficient/i);
    });

    it('should validate PRD contains all required sections', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'proposal-1',
        status: 'approved',
        title: 'Test',
        problem: 'problem',
        solution: 'solution',
        description: 'desc',
        themeId: null,
        theme: null,
        evidence: [],
        impactScore: 5,
        effortScore: 5,
        confidenceScore: 5,
        reachScore: 5,
        riceScore: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockPrisma.spec.findFirst.mockResolvedValue(null);
      // Return PRD with all sections
      (aiService.chatText as any).mockResolvedValue(MOCK_PRD_MARKDOWN);
      mockPrisma.spec.create.mockResolvedValue({
        id: 'spec-1',
        proposalId: 'proposal-1',
        prd: MOCK_PRD_MARKDOWN,
        agentPrompt: 'mock',
        proposal: { id: 'proposal-1', title: 'Test', status: 'approved', riceScore: 25 },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await specService.generatePRD('proposal-1');

      // The stored PRD should contain all sections
      const createCall = mockPrisma.spec.create.mock.calls[0][0];
      const storedPRD = (createCall as any).data.prd;
      expect(storedPRD).toContain('## Overview');
      expect(storedPRD).toContain('## Acceptance Criteria');
    });

    it('should return token usage and cost in result', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'proposal-1',
        status: 'approved',
        title: 'Test',
        problem: 'p',
        solution: 's',
        description: 'd',
        themeId: null,
        theme: null,
        evidence: [],
        impactScore: 5,
        effortScore: 5,
        confidenceScore: 5,
        reachScore: 5,
        riceScore: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockPrisma.spec.findFirst.mockResolvedValue(null);
      (aiService.chatText as any).mockResolvedValue(MOCK_PRD_MARKDOWN);
      mockPrisma.spec.create.mockResolvedValue({
        id: 'spec-1',
        proposalId: 'proposal-1',
        prd: MOCK_PRD_MARKDOWN,
        agentPrompt: 'mock',
        proposal: { id: 'proposal-1', title: 'Test', status: 'approved', riceScore: 25 },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await specService.generatePRD('proposal-1');
      expect(result.tokensUsed).toBe(3200);
      expect(result.estimatedCost).toBe(0.002);
    });
  });

  describe('getById', () => {
    it('should return formatted spec with proposal metadata', async () => {
      mockPrisma.spec.findUnique.mockResolvedValue({
        id: 'spec-1',
        proposalId: 'proposal-1',
        prd: MOCK_PRD_MARKDOWN,
        agentPrompt: 'agent prompt content',
        userStories: ['story1'],
        acceptanceCriteria: ['ac1'],
        dataModel: 'model changes',
        apiSpec: 'api spec',
        taskBreakdown: null,
        exportedTo: null,
        exportedAt: null,
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
        proposal: {
          id: 'proposal-1',
          title: 'Test Feature',
          status: 'approved',
          riceScore: 126.0,
        },
      } as any);

      const spec = await specService.getById('spec-1');

      expect(spec.id).toBe('spec-1');
      expect(spec.proposal.title).toBe('Test Feature');
      expect(spec.prd).toBe(MOCK_PRD_MARKDOWN);
    });

    it('should throw 404 for non-existent spec', async () => {
      mockPrisma.spec.findUnique.mockResolvedValue(null);
      await expect(specService.getById('nonexistent')).rejects.toThrow(/not found/i);
    });
  });

  describe('getByProposalId', () => {
    it('should return spec when it exists', async () => {
      mockPrisma.spec.findFirst.mockResolvedValue({
        id: 'spec-1',
        proposalId: 'proposal-1',
        prd: 'content',
        proposal: { id: 'proposal-1', title: 'Test', status: 'approved', riceScore: 50 },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const spec = await specService.getByProposalId('proposal-1');
      expect(spec).not.toBeNull();
      expect(spec!.proposalId).toBe('proposal-1');
    });

    it('should return null when no spec exists for proposal', async () => {
      mockPrisma.spec.findFirst.mockResolvedValue(null);
      const spec = await specService.getByProposalId('proposal-1');
      expect(spec).toBeNull();
    });
  });

  describe('getPRD', () => {
    it('should return PRD markdown string', async () => {
      mockPrisma.spec.findUnique.mockResolvedValue({
        prd: MOCK_PRD_MARKDOWN,
      } as any);

      const prd = await specService.getPRD('spec-1');
      expect(prd).toBe(MOCK_PRD_MARKDOWN);
    });

    it('should throw 404 when spec not found', async () => {
      mockPrisma.spec.findUnique.mockResolvedValue(null);
      await expect(specService.getPRD('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('should throw 404 when prd field is null', async () => {
      mockPrisma.spec.findUnique.mockResolvedValue({ prd: null } as any);
      await expect(specService.getPRD('spec-1')).rejects.toThrow(/not been generated/i);
    });
  });

  describe('getAgentPrompt', () => {
    it('should call buildAgentPrompt with correct format', async () => {
      mockPrisma.spec.findUnique.mockResolvedValue({
        id: 'spec-1',
        prd: MOCK_PRD_MARKDOWN,
        proposal: {
          id: 'proposal-1',
          title: 'Test',
          status: 'approved',
          problem: 'p',
          solution: 's',
          description: 'd',
          themeId: null,
          theme: null,
          evidence: [],
          impactScore: 5,
          effortScore: 5,
          confidenceScore: 5,
          reachScore: 5,
          riceScore: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      const prompt = await specService.getAgentPrompt('spec-1', 'claude-code');
      expect(prompt).toBeDefined();
    });

    it('should throw 400 when prd not generated', async () => {
      mockPrisma.spec.findUnique.mockResolvedValue({
        id: 'spec-1',
        prd: null,
        proposal: { id: 'p1' },
      } as any);

      await expect(specService.getAgentPrompt('spec-1', 'cursor')).rejects.toThrow(
        /not been generated/i,
      );
    });
  });
});
```

### 5. Integration Tests: Spec Routes (`specs.routes.test.ts`)

End-to-end tests using Supertest against the real Express app with a test database. OpenAI calls are mocked.

```typescript
import { describe, it, expect, beforeAll, beforeEach, vi, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { seedProposalWithEvidence, MOCK_PRD_MARKDOWN } from '../helpers/spec-fixtures';

// Mock AI service to avoid real OpenAI calls
vi.mock('../../src/services/ai.service', () => ({
  aiService: {
    chatText: vi.fn().mockResolvedValue(MOCK_PRD_MARKDOWN),
    chatJSON: vi.fn(),
    getUsage: vi.fn(() => ({ totalTokens: 3200, totalCost: 0.002 })),
  },
}));

vi.mock('@shipscope/core/prompts/specs', async () => {
  const actual = await vi.importActual('@shipscope/core/prompts/specs');
  return {
    ...actual,
    buildAgentPrompt: vi.fn(() => 'mock agent prompt for testing'),
  };
});

let proposalId: string;

beforeAll(async () => {
  // Ensure test DB is clean and seeded
  await prisma.$transaction([
    prisma.spec.deleteMany(),
    prisma.proposalEvidence.deleteMany(),
    prisma.proposal.deleteMany(),
    prisma.feedbackThemeLink.deleteMany(),
    prisma.theme.deleteMany(),
    prisma.feedbackItem.deleteMany(),
    prisma.feedbackSource.deleteMany(),
  ]);
});

beforeEach(async () => {
  // Clean specs between tests
  await prisma.spec.deleteMany();
  await prisma.proposalEvidence.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.feedbackThemeLink.deleteMany();
  await prisma.theme.deleteMany();
  await prisma.feedbackItem.deleteMany();
  await prisma.feedbackSource.deleteMany();

  // Re-seed
  proposalId = await seedProposalWithEvidence(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Spec Routes', () => {
  describe('POST /api/specs/generate/:proposalId', () => {
    it('should generate a spec for an approved proposal (201)', async () => {
      const res = await request(app).post(`/api/specs/generate/${proposalId}`).expect(201);

      expect(res.body.spec).toBeDefined();
      expect(res.body.spec.prd).toBeDefined();
      expect(res.body.spec.proposalId).toBe(proposalId);
      expect(res.body.isRegeneration).toBe(false);
      expect(res.body.tokensUsed).toBe(3200);
    });

    it('should regenerate an existing spec (200)', async () => {
      // First generation
      await request(app).post(`/api/specs/generate/${proposalId}`).expect(201);

      // Regeneration
      const res = await request(app).post(`/api/specs/generate/${proposalId}`).expect(200);

      expect(res.body.isRegeneration).toBe(true);
    });

    it('should return 404 for non-existent proposal', async () => {
      const res = await request(app).post('/api/specs/generate/nonexistent-id').expect(404);

      expect(res.body.error).toContain('not found');
    });

    it('should return 400 for non-approved proposal', async () => {
      // Change proposal status to 'proposed'
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'proposed' },
      });

      const res = await request(app).post(`/api/specs/generate/${proposalId}`).expect(400);

      expect(res.body.error).toContain('approved');
    });

    it('should return 400 for rejected proposal', async () => {
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'rejected' },
      });

      const res = await request(app).post(`/api/specs/generate/${proposalId}`).expect(400);

      expect(res.body.error).toContain('approved');
    });
  });

  describe('GET /api/specs/:id', () => {
    it('should return a full spec with proposal metadata', async () => {
      // Generate first
      const genRes = await request(app).post(`/api/specs/generate/${proposalId}`).expect(201);

      const specId = genRes.body.spec.id;

      const res = await request(app).get(`/api/specs/${specId}`).expect(200);

      expect(res.body.id).toBe(specId);
      expect(res.body.proposal).toBeDefined();
      expect(res.body.proposal.title).toBeDefined();
      expect(res.body.prd).toBeDefined();
    });

    it('should return 404 for non-existent spec', async () => {
      await request(app).get('/api/specs/nonexistent-id').expect(404);
    });
  });

  describe('GET /api/specs/:id/prd', () => {
    it('should return PRD markdown with correct content type', async () => {
      const genRes = await request(app).post(`/api/specs/generate/${proposalId}`).expect(201);

      const specId = genRes.body.spec.id;

      const res = await request(app).get(`/api/specs/${specId}/prd`).expect(200);

      expect(res.headers['content-type']).toContain('text/markdown');
      expect(res.text.length).toBeGreaterThan(100);
    });

    it('should return 404 for non-existent spec', async () => {
      await request(app).get('/api/specs/nonexistent-id/prd').expect(404);
    });
  });

  describe('GET /api/specs/:id/agent-prompt', () => {
    it('should return agent prompt in Cursor format by default', async () => {
      const genRes = await request(app).post(`/api/specs/generate/${proposalId}`).expect(201);

      const specId = genRes.body.spec.id;

      const res = await request(app).get(`/api/specs/${specId}/agent-prompt`).expect(200);

      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toBeDefined();
    });

    it('should return agent prompt in Claude Code format', async () => {
      const genRes = await request(app).post(`/api/specs/generate/${proposalId}`).expect(201);

      const specId = genRes.body.spec.id;

      const res = await request(app)
        .get(`/api/specs/${specId}/agent-prompt?format=claude-code`)
        .expect(200);

      expect(res.text).toBeDefined();
    });

    it('should accept format=cursor query parameter', async () => {
      const genRes = await request(app).post(`/api/specs/generate/${proposalId}`).expect(201);

      const specId = genRes.body.spec.id;

      await request(app).get(`/api/specs/${specId}/agent-prompt?format=cursor`).expect(200);
    });

    it('should return 404 for non-existent spec', async () => {
      await request(app).get('/api/specs/nonexistent-id/agent-prompt').expect(404);
    });
  });

  describe('GET /api/specs/by-proposal/:proposalId', () => {
    it('should return spec by proposal ID', async () => {
      await request(app).post(`/api/specs/generate/${proposalId}`).expect(201);

      const res = await request(app).get(`/api/specs/by-proposal/${proposalId}`).expect(200);

      expect(res.body.proposalId).toBe(proposalId);
    });

    it('should return 404 when no spec exists for proposal', async () => {
      await request(app).get(`/api/specs/by-proposal/${proposalId}`).expect(404);
    });
  });
});
```

### 6. PRD section validation tests

Dedicated tests for the `validatePRD()` and `appendMissingSections()` internal helpers.

```typescript
// Add to spec.service.test.ts or create packages/api/tests/unit/spec-validation.test.ts

describe('validatePRD', () => {
  it('should return valid: true for PRD with all 10 sections', () => {
    const result = validatePRD(MOCK_PRD_MARKDOWN);
    expect(result.valid).toBe(true);
    expect(result.missingSections).toHaveLength(0);
  });

  it('should detect missing sections in incomplete PRD', () => {
    const result = validatePRD(MOCK_INCOMPLETE_PRD);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('Data Model Changes');
    expect(result.missingSections).toContain('API Changes');
    expect(result.missingSections).toContain('UI/UX Requirements');
    expect(result.missingSections).toContain('Out of Scope');
    expect(result.missingSections).toContain('Open Questions');
  });

  it('should handle empty markdown', () => {
    const result = validatePRD('');
    expect(result.valid).toBe(false);
    expect(result.missingSections).toHaveLength(10);
  });

  it('should be case-insensitive for section headings', () => {
    const markdown =
      '## overview\nContent\n## problem statement\nContent\n' +
      '## user stories\n## acceptance criteria\n## edge cases\n' +
      '## data model changes\n## api changes\n## ui/ux requirements\n' +
      '## out of scope\n## open questions\n';
    const result = validatePRD(markdown);
    expect(result.valid).toBe(true);
  });
});

describe('appendMissingSections', () => {
  it('should append placeholder stubs for missing sections', () => {
    const result = appendMissingSections(MOCK_INCOMPLETE_PRD, [
      'Data Model Changes',
      'API Changes',
    ]);
    expect(result).toContain('## Data Model Changes');
    expect(result).toContain('## API Changes');
    expect(result).toContain('fill in manually');
  });

  it('should not modify the original content', () => {
    const result = appendMissingSections(MOCK_INCOMPLETE_PRD, ['Out of Scope']);
    expect(result).toContain('## Overview'); // Original content preserved
    expect(result).toContain('## Out of Scope'); // New section added
  });

  it('should handle empty missing list', () => {
    const result = appendMissingSections(MOCK_PRD_MARKDOWN, []);
    expect(result).toBe(MOCK_PRD_MARKDOWN);
  });
});
```

### 7. Coverage configuration

Ensure vitest coverage includes spec files.

```typescript
// Update vitest.config.ts (or packages/api/vitest.config.ts)
coverage: {
  provider: 'v8',
  reporter: ['text', 'html'],
  include: [
    'packages/api/src/services/**',
    'packages/core/src/prompts/**',
  ],
  thresholds: {
    'packages/api/src/services/spec.service.ts': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
    'packages/core/src/prompts/specs.ts': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
},
```

## Acceptance Criteria

- [ ] All unit tests for `buildPRDPrompt()` pass -- prompt includes title, problem, solution, evidence, all 10 section headers
- [ ] All unit tests for `buildPRDSystemPrompt()` pass -- returns non-empty string with markdown instruction
- [ ] All unit tests for `extractSection()` pass -- extracts all 10 sections, handles fuzzy/missing/trailing-colon variations
- [ ] All unit tests for `buildPromptContext()` pass -- assembles all fields from PRD + proposal
- [ ] All unit tests for `buildAgentPrompt()` Cursor format pass -- uses ## headers, imperative tone, includes all sections
- [ ] All unit tests for `buildAgentPrompt()` Claude Code format pass -- uses # header, numbered steps, design tokens, framework names
- [ ] Claude Code format is measurably longer than Cursor format
- [ ] Both formats handle missing PRD sections gracefully (no crash, content still usable)
- [ ] Default format is Cursor when none specified
- [ ] Unknown format throws error
- [ ] All unit tests for `specService.generatePRD()` pass -- creates spec, handles 404/400, handles regeneration, validates PRD
- [ ] All unit tests for `specService.getById()` pass -- returns formatted spec, throws 404
- [ ] All unit tests for `specService.getByProposalId()` pass -- returns spec or null
- [ ] All unit tests for `specService.getPRD()` pass -- returns markdown, throws 404
- [ ] All unit tests for `specService.getAgentPrompt()` pass -- calls buildAgentPrompt with format, throws on missing PRD
- [ ] Version bumping tested: regeneration increments version, first generation is version 1
- [ ] Token usage and cost returned in generation result
- [ ] Empty/short AI response throws 502 error
- [ ] `validatePRD()` correctly detects all missing sections
- [ ] `appendMissingSections()` adds placeholder stubs without modifying original content
- [ ] All integration tests for POST /api/specs/generate/:proposalId pass (201, 200 regen, 404, 400)
- [ ] All integration tests for GET /api/specs/:id pass (200, 404)
- [ ] All integration tests for GET /api/specs/:id/prd pass (200 with text/markdown, 404)
- [ ] All integration tests for GET /api/specs/:id/agent-prompt pass (200 with cursor, 200 with claude-code, 404)
- [ ] All integration tests for GET /api/specs/by-proposal/:proposalId pass (200, 404)
- [ ] OpenAI is fully mocked in all tests (no real API calls)
- [ ] Tests are deterministic (same input produces same output)
- [ ] Tests clean up database state between runs (beforeEach cleanup)
- [ ] > 80% code coverage on `packages/api/src/services/spec.service.ts`
- [ ] > 80% code coverage on `packages/core/src/prompts/specs.ts`
- [ ] `npm test` runs all spec tests and reports results

## Complexity Estimate

**L (Large)** -- 4 test files with approximately 60-70 individual test cases. Requires mock setup for Prisma (vitest-mock-extended), AI service mocking, test database seeding with proposal + evidence chain (FeedbackSource -> FeedbackItem -> Theme -> Proposal -> ProposalEvidence), integration test lifecycle management, and coverage configuration.

## Risk Factors & Mitigations

| Risk                                                  | Impact                                        | Mitigation                                                                                     |
| ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Prisma mock shape diverges from real DB behavior      | High -- false positives in unit tests         | Use vitest-mock-extended for type safety; complement with integration tests using real DB      |
| Integration tests slow due to DB seeding              | Medium -- CI pipeline bottleneck              | Minimal seed data (2 feedback items, 1 theme, 1 proposal); clean before each test, not after   |
| AI mock doesn't match real OpenAI response shape      | Medium -- tests pass but production breaks    | Mock response structure matches OpenAI SDK types; test with actual API manually before release |
| Coverage threshold too strict for generated code      | Low -- CI fails on minor refactor             | 80% threshold is reasonable; exclude auto-generated Prisma client from coverage                |
| PRD section regex tests are brittle                   | Medium -- tests break on minor format changes | Test both exact and fuzzy extraction; use realistic mock PRDs; parameterize section names      |
| Integration test database pollution between test runs | High -- flaky tests                           | Strict beforeEach cleanup with transaction deleting all tables in dependency order             |
