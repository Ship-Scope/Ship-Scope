# 01 -- PRD Generation Service

## Objective

Build the backend service that takes an approved proposal (with its linked evidence and source theme) and generates a complete Product Requirements Document via gpt-4o-mini. The PRD is a single markdown document containing all 10 required sections (Overview, Problem Statement, User Stories, Acceptance Criteria, Edge Cases, Data Model Changes, API Changes, UI/UX Requirements, Out of Scope, Open Questions). The service stores the PRD on a Spec record linked to the proposal, supports regeneration with version bumping, parses individual sections into their dedicated Prisma fields for downstream use, and exposes API endpoints for generation and retrieval.

## Dependencies

- Phase 4 complete (Proposals exist with status workflow, evidence linked)
- `packages/api/src/services/ai.service.ts` (aiService.chatText for free-form markdown generation)
- `packages/api/src/lib/openai.ts` (withRetry, AI_CONFIG)
- `packages/core/src/prompts/specs.ts` (to be created -- buildPRDPrompt)
- `packages/core/src/types/proposal.ts` (ProposalWithEvidence interface from Phase 4)
- Prisma schema: Spec model, Proposal model, ProposalEvidence model

## Files to Create

| File                                        | Purpose                                        |
| ------------------------------------------- | ---------------------------------------------- |
| `packages/api/src/services/spec.service.ts` | Spec generation, retrieval, version management |
| `packages/core/src/prompts/specs.ts`        | PRD prompt template and agent prompt builder   |
| `packages/core/src/types/spec.ts`           | Shared TypeScript types for specs              |

## Files to Modify

| File                               | Changes                                         |
| ---------------------------------- | ----------------------------------------------- |
| `packages/api/src/routes/specs.ts` | Replace stub handlers with real implementations |
| `packages/api/src/index.ts`        | Already imports specRouter -- no changes needed |

## Detailed Sub-Tasks

### 1. Define shared types (`packages/core/src/types/spec.ts`)

These types are consumed by both the API service and the frontend.

```typescript
export interface SpecResponse {
  id: string;
  proposalId: string;
  proposal: {
    id: string;
    title: string;
    status: string;
    riceScore: number | null;
  };
  prd: string | null;
  agentPrompt: string | null;
  userStories: string[] | null;
  acceptanceCriteria: string[] | null;
  dataModel: string | null;
  apiSpec: string | null;
  taskBreakdown: string[] | null;
  exportedTo: string | null;
  exportedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpecGenerationResult {
  spec: SpecResponse;
  isRegeneration: boolean;
  previousVersion: number | null;
  tokensUsed: number;
  estimatedCost: number;
}

export interface PRDSections {
  overview: string;
  problemStatement: string;
  userStories: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  dataModelChanges: string;
  apiChanges: string;
  uiUxRequirements: string;
  outOfScope: string;
  openQuestions: string[];
}

export type AgentPromptFormat = 'cursor' | 'claude-code';
```

### 2. Build the PRD prompt template (`packages/core/src/prompts/specs.ts`)

This is the prompt sent to gpt-4o-mini. It receives the full proposal context including evidence quotes and produces a complete markdown PRD.

```typescript
import type { ProposalWithEvidence } from '../types/proposal';

export function buildPRDPrompt(proposal: ProposalWithEvidence): string {
  const evidenceBlock = proposal.evidence
    .map(
      (e, i) =>
        `${i + 1}. "${e.quote}" -- ${e.feedback.author || 'Anonymous'} (${e.feedback.channel || 'unknown'})`,
    )
    .join('\n');

  return `You are a senior product manager writing a PRD (Product Requirements Document).

Feature: ${proposal.title}
Problem: ${proposal.problem}
Solution: ${proposal.solution}

Supporting evidence from ${proposal.evidence.length} user feedback items:
${evidenceBlock}

Write a complete PRD in Markdown with these exact sections:

# ${proposal.title}

## Overview
(2-3 sentence summary of the feature and its value)

## Problem Statement
(Detailed problem description with user impact. Reference evidence where relevant.)

## User Stories
(3-5 user stories in "As a [user], I want [action] so that [benefit]" format)

## Acceptance Criteria
(Numbered list of testable, specific criteria. Each must be pass/fail verifiable.)

## Edge Cases
(List of boundary conditions, error states, and unusual scenarios to handle)

## Data Model Changes
(Any new tables, fields, or migrations needed. Say "None" if not applicable. Use code blocks for schema.)

## API Changes
(Any new or modified endpoints with request/response shapes. Say "None" if not applicable. Use code blocks.)

## UI/UX Requirements
(Key screens, interactions, states. Describe layout, components, and behavior.)

## Out of Scope
(What this feature does NOT include in this iteration)

## Open Questions
(Unresolved decisions or dependencies that need discussion before implementation)`;
}

export function buildPRDSystemPrompt(): string {
  return `You are a senior product manager at a SaaS company writing detailed, implementation-ready PRDs.

Your PRDs should be:
- Specific and actionable (engineers can build from this document alone)
- Grounded in the provided user evidence (reference real pain points)
- Technically aware (mention data model changes, API shapes, state management)
- Realistic in scope (avoid scope creep; be explicit about what is out of scope)
- Structured exactly as requested (use the exact section headers provided)

Write in Markdown format. Use code blocks for schema and API examples.
Use numbered lists for acceptance criteria. Use bullet lists for edge cases.
Each user story must follow the "As a [user], I want [action] so that [benefit]" template exactly.`;
}
```

### 3. Build the PRD section parser

After the LLM returns the full markdown, parse it into individual sections for storage in the decomposed Prisma fields. This enables downstream features (e.g., exporting just user stories to Linear).

```typescript
// packages/api/src/services/spec.service.ts (internal helper)

interface ParsedPRD {
  userStories: string[];
  acceptanceCriteria: string[];
  dataModel: string;
  apiSpec: string;
  taskBreakdown: string[];
}

function parsePRDSections(markdown: string): ParsedPRD {
  const getSection = (heading: string): string => {
    // Match ## Heading through next ## or end of string
    const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = markdown.match(regex);
    return match ? match[1].trim() : '';
  };

  const extractListItems = (section: string): string[] => {
    // Match lines starting with -, *, or numbered (1., 2., etc.)
    return section
      .split('\n')
      .map((line) =>
        line
          .replace(/^[\s]*[-*]\s*/, '')
          .replace(/^[\s]*\d+\.\s*/, '')
          .trim(),
      )
      .filter((line) => line.length > 0);
  };

  const userStoriesRaw = getSection('User Stories');
  const acceptanceCriteriaRaw = getSection('Acceptance Criteria');
  const dataModel = getSection('Data Model Changes');
  const apiSpec = getSection('API Changes');

  return {
    userStories: extractListItems(userStoriesRaw),
    acceptanceCriteria: extractListItems(acceptanceCriteriaRaw),
    dataModel,
    apiSpec,
    taskBreakdown: [], // Not generated in PRD; reserved for future use
  };
}
```

### 4. Build the spec generation service (`packages/api/src/services/spec.service.ts`)

This is the core service. It orchestrates fetching the proposal, calling the LLM, parsing the result, and persisting the Spec.

```typescript
import { prisma } from '../lib/prisma';
import { aiService } from './ai.service';
import { buildPRDPrompt, buildPRDSystemPrompt } from '@shipscope/core/prompts/specs';
import { buildAgentPrompt } from '@shipscope/core/prompts/specs';
import { AppError } from '../lib/errors';
import type { SpecGenerationResult } from '@shipscope/core/types/spec';
import type { ProposalWithEvidence } from '@shipscope/core/types/proposal';

export const specService = {
  /**
   * Generate a full PRD + agent prompt for an approved proposal.
   * If a Spec already exists for this proposal, regenerate (bump version).
   */
  async generatePRD(proposalId: string): Promise<SpecGenerationResult> {
    // 1. Fetch proposal with evidence
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        theme: true,
        evidence: {
          include: {
            feedback: {
              select: { id: true, content: true, author: true, channel: true },
            },
          },
          orderBy: { relevance: 'desc' },
          take: 10,
        },
      },
    });

    if (!proposal) {
      throw new AppError(404, `Proposal not found: ${proposalId}`);
    }

    if (proposal.status !== 'approved') {
      throw new AppError(
        400,
        `Cannot generate spec for proposal with status "${proposal.status}". Only approved proposals can have specs generated.`,
      );
    }

    // 2. Check for existing spec (regeneration case)
    const existingSpec = await prisma.spec.findFirst({
      where: { proposalId },
    });

    const previousVersion = existingSpec ? ((existingSpec as any).version ?? 1) : null;
    const isRegeneration = existingSpec !== null;

    // 3. Build prompt and call LLM
    const proposalWithEvidence: ProposalWithEvidence = {
      id: proposal.id,
      title: proposal.title,
      description: proposal.description,
      problem: proposal.problem,
      solution: proposal.solution,
      impactScore: proposal.impactScore,
      effortScore: proposal.effortScore,
      confidenceScore: proposal.confidenceScore,
      reachScore: proposal.reachScore,
      riceScore: proposal.riceScore,
      status: proposal.status,
      themeId: proposal.themeId,
      theme: proposal.theme
        ? { id: proposal.theme.id, name: proposal.theme.name, category: proposal.theme.category }
        : null,
      evidence: proposal.evidence.map((e) => ({
        id: e.id,
        quote: e.quote,
        relevance: e.relevance,
        feedback: e.feedback,
      })),
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    };

    const prdMarkdown = await aiService.chatText(
      buildPRDPrompt(proposalWithEvidence),
      buildPRDSystemPrompt(),
    );

    if (!prdMarkdown || prdMarkdown.trim().length < 100) {
      throw new AppError(502, 'AI returned an empty or insufficient PRD. Please try again.');
    }

    // 4. Parse PRD into individual sections
    const parsed = parsePRDSections(prdMarkdown);

    // 5. Generate default agent prompt (Cursor format)
    const agentPrompt = buildAgentPrompt(prdMarkdown, proposalWithEvidence, 'cursor');

    // 6. Upsert Spec record
    const newVersion = isRegeneration ? (previousVersion ?? 1) + 1 : 1;

    const spec = existingSpec
      ? await prisma.spec.update({
          where: { id: existingSpec.id },
          data: {
            prd: prdMarkdown,
            agentPrompt,
            userStories: parsed.userStories,
            acceptanceCriteria: parsed.acceptanceCriteria,
            dataModel: parsed.dataModel,
            apiSpec: parsed.apiSpec,
            taskBreakdown: parsed.taskBreakdown,
            // version: newVersion,  // Uncomment when migration adds version field
            updatedAt: new Date(),
          },
          include: { proposal: true },
        })
      : await prisma.spec.create({
          data: {
            proposalId,
            prd: prdMarkdown,
            agentPrompt,
            userStories: parsed.userStories,
            acceptanceCriteria: parsed.acceptanceCriteria,
            dataModel: parsed.dataModel,
            apiSpec: parsed.apiSpec,
            taskBreakdown: parsed.taskBreakdown,
          },
          include: { proposal: true },
        });

    // 7. Return result with metadata
    const usage = aiService.getUsage();
    return {
      spec: formatSpecResponse(spec),
      isRegeneration,
      previousVersion,
      tokensUsed: usage.totalTokens,
      estimatedCost: usage.totalCost,
    };
  },

  /**
   * Get a spec by ID with full content.
   */
  async getById(specId: string): Promise<SpecResponse> {
    const spec = await prisma.spec.findUnique({
      where: { id: specId },
      include: { proposal: true },
    });

    if (!spec) {
      throw new AppError(404, `Spec not found: ${specId}`);
    }

    return formatSpecResponse(spec);
  },

  /**
   * Get a spec by its linked proposal ID.
   */
  async getByProposalId(proposalId: string): Promise<SpecResponse | null> {
    const spec = await prisma.spec.findFirst({
      where: { proposalId },
      include: { proposal: true },
    });

    if (!spec) return null;
    return formatSpecResponse(spec);
  },

  /**
   * Get just the PRD markdown for a spec.
   */
  async getPRD(specId: string): Promise<string> {
    const spec = await prisma.spec.findUnique({
      where: { id: specId },
      select: { prd: true },
    });

    if (!spec) {
      throw new AppError(404, `Spec not found: ${specId}`);
    }

    if (!spec.prd) {
      throw new AppError(404, 'PRD has not been generated for this spec.');
    }

    return spec.prd;
  },

  /**
   * Get the agent-ready prompt in the specified format.
   */
  async getAgentPrompt(specId: string, format: AgentPromptFormat = 'cursor'): Promise<string> {
    const spec = await prisma.spec.findUnique({
      where: { id: specId },
      include: {
        proposal: {
          include: {
            evidence: {
              include: { feedback: true },
              orderBy: { relevance: 'desc' },
              take: 10,
            },
            theme: true,
          },
        },
      },
    });

    if (!spec) {
      throw new AppError(404, `Spec not found: ${specId}`);
    }

    if (!spec.prd) {
      throw new AppError(400, 'Cannot generate agent prompt: PRD has not been generated yet.');
    }

    // Build on-the-fly for the requested format
    const proposalWithEvidence = mapProposalToWithEvidence(spec.proposal);
    return buildAgentPrompt(spec.prd, proposalWithEvidence, format);
  },
};
```

### 5. Implement the spec response formatter

Consistent response shaping for the API layer.

```typescript
function formatSpecResponse(spec: any): SpecResponse {
  return {
    id: spec.id,
    proposalId: spec.proposalId,
    proposal: {
      id: spec.proposal.id,
      title: spec.proposal.title,
      status: spec.proposal.status,
      riceScore: spec.proposal.riceScore,
    },
    prd: spec.prd,
    agentPrompt: spec.agentPrompt,
    userStories: spec.userStories as string[] | null,
    acceptanceCriteria: spec.acceptanceCriteria as string[] | null,
    dataModel: spec.dataModel,
    apiSpec: spec.apiSpec,
    taskBreakdown: spec.taskBreakdown as string[] | null,
    exportedTo: spec.exportedTo,
    exportedAt: spec.exportedAt?.toISOString() ?? null,
    version: (spec as any).version ?? 1,
    createdAt: spec.createdAt.toISOString(),
    updatedAt: spec.updatedAt.toISOString(),
  };
}
```

### 6. Implement the route handlers (`packages/api/src/routes/specs.ts`)

Replace all stub handlers with real implementations that delegate to specService.

```typescript
import { Router } from 'express';
import { specService } from '../services/spec.service';
import { z } from 'zod';
import { validate } from '../middleware/validate';

export const specRouter = Router();

// POST /api/specs/generate/:proposalId - Generate spec from approved proposal
specRouter.post('/generate/:proposalId', async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const result = await specService.generatePRD(proposalId);

    const statusCode = result.isRegeneration ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/specs/:id - Get a generated spec (full content)
specRouter.get('/:id', async (req, res, next) => {
  try {
    const spec = await specService.getById(req.params.id);
    res.json(spec);
  } catch (err) {
    next(err);
  }
});

// GET /api/specs/:id/prd - Get just the PRD markdown
specRouter.get('/:id/prd', async (req, res, next) => {
  try {
    const prd = await specService.getPRD(req.params.id);
    res.type('text/markdown').send(prd);
  } catch (err) {
    next(err);
  }
});

// GET /api/specs/:id/agent-prompt - Get the agent-ready prompt
const agentPromptQuerySchema = z.object({
  format: z.enum(['cursor', 'claude-code']).default('cursor'),
});

specRouter.get('/:id/agent-prompt', async (req, res, next) => {
  try {
    const query = agentPromptQuerySchema.parse(req.query);
    const prompt = await specService.getAgentPrompt(req.params.id, query.format);
    res.type('text/plain').send(prompt);
  } catch (err) {
    next(err);
  }
});

// GET /api/specs/by-proposal/:proposalId - Get spec by proposal ID
specRouter.get('/by-proposal/:proposalId', async (req, res, next) => {
  try {
    const spec = await specService.getByProposalId(req.params.proposalId);
    if (!spec) {
      return res.status(404).json({ error: 'No spec found for this proposal.' });
    }
    res.json(spec);
  } catch (err) {
    next(err);
  }
});
```

### 7. Handle PRD validation and fallback

The LLM may omit sections or produce malformed markdown. Validate the generated PRD before storing.

```typescript
// packages/api/src/services/spec.service.ts (internal helper)

const REQUIRED_SECTIONS = [
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

function validatePRD(markdown: string): { valid: boolean; missingSections: string[] } {
  const missingSections = REQUIRED_SECTIONS.filter((section) => {
    const regex = new RegExp(`##\\s+${section}`, 'i');
    return !regex.test(markdown);
  });

  return {
    valid: missingSections.length === 0,
    missingSections,
  };
}

function appendMissingSections(markdown: string, missing: string[]): string {
  let result = markdown;
  for (const section of missing) {
    result += `\n\n## ${section}\n\n_This section was not generated. Please fill in manually._\n`;
  }
  return result;
}
```

Use this validation in `generatePRD()` after the LLM call:

```typescript
// After receiving prdMarkdown from aiService.chatText:
const validation = validatePRD(prdMarkdown);
const finalPRD = validation.valid
  ? prdMarkdown
  : appendMissingSections(prdMarkdown, validation.missingSections);
```

### 8. Handle version bumping

When the Prisma schema includes a `version` field (the README notes this as part of the Spec model), increment it on regeneration. If the field is not yet in the schema (pending migration), handle gracefully.

```typescript
// Version field handling — compatible with both pre- and post-migration schemas
function getNextVersion(existingSpec: any): number {
  if (typeof existingSpec?.version === 'number') {
    return existingSpec.version + 1;
  }
  // If version field doesn't exist yet, default to 1
  return 1;
}
```

**Migration note:** If the Spec model does not yet have a `version` column, create a migration:

```sql
-- Migration: add_version_to_spec
ALTER TABLE "Spec" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
```

And update the Prisma schema:

```prisma
model Spec {
  // ... existing fields ...
  version    Int      @default(1)
}
```

### 9. Rate limiting and error handling for generation

PRD generation is expensive (one LLM call with a large prompt). Protect against abuse.

```typescript
// In the POST /generate/:proposalId handler, add a concurrency guard:
const generationInProgress = new Set<string>();

specRouter.post('/generate/:proposalId', async (req, res, next) => {
  const { proposalId } = req.params;

  // Prevent concurrent generation for the same proposal
  if (generationInProgress.has(proposalId)) {
    return res.status(409).json({
      error: 'Spec generation is already in progress for this proposal.',
    });
  }

  generationInProgress.add(proposalId);
  try {
    const result = await specService.generatePRD(proposalId);
    const statusCode = result.isRegeneration ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (err) {
    next(err);
  } finally {
    generationInProgress.delete(proposalId);
  }
});
```

## Acceptance Criteria

- [ ] `specService.generatePRD(proposalId)` fetches the proposal with full evidence (top 10 by relevance)
- [ ] Throws AppError(404) if proposal does not exist
- [ ] Throws AppError(400) if proposal status is not "approved"
- [ ] Builds prompt using `buildPRDPrompt()` with title, problem, solution, and evidence quotes
- [ ] Calls `aiService.chatText()` with PRD prompt and system prompt
- [ ] Validates generated PRD contains all 10 required sections
- [ ] Appends placeholder stubs for any missing sections
- [ ] Parses PRD into individual fields (userStories, acceptanceCriteria, dataModel, apiSpec)
- [ ] Generates default agent prompt in Cursor format using `buildAgentPrompt()`
- [ ] Creates new Spec record on first generation (returns 201)
- [ ] Updates existing Spec record on regeneration with bumped version (returns 200)
- [ ] Prevents concurrent generation for the same proposal (returns 409)
- [ ] Returns SpecGenerationResult with spec data, version info, and token usage
- [ ] `specService.getById()` returns formatted spec with proposal metadata
- [ ] `specService.getPRD()` returns raw markdown string
- [ ] `specService.getByProposalId()` returns spec or null
- [ ] GET /api/specs/:id/prd returns `Content-Type: text/markdown`
- [ ] GET /api/specs/:id/agent-prompt accepts `format` query parameter
- [ ] GET /api/specs/by-proposal/:proposalId returns spec linked to that proposal
- [ ] Malformed AI output (short, empty, missing sections) handled gracefully without crashing

## Complexity Estimate

**L (Large)** -- Single LLM call but significant surrounding logic: proposal fetching with nested includes, PRD validation with section detection, markdown parsing into structured fields, upsert with version management, concurrency protection, and 5 route handlers.

## Risk Factors & Mitigations

| Risk                                                       | Impact                            | Mitigation                                                                                                         |
| ---------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| LLM omits required PRD sections                            | Medium -- incomplete spec         | `validatePRD()` detects missing sections; `appendMissingSections()` adds placeholders; UI shows warning            |
| LLM generates PRD exceeding token limit                    | Medium -- truncated output        | gpt-4o-mini has 16K output tokens; PRDs are typically 2-4K tokens; set `max_tokens: 8192` as safety cap            |
| PRD section parser fails on unexpected markdown formatting | Medium -- decomposed fields empty | Parser uses lenient regex; falls back to empty arrays/strings; `prd` field always has the full markdown regardless |
| Concurrent regeneration requests corrupt Spec record       | High -- data inconsistency        | In-memory concurrency guard with Set; future: Redis-based distributed lock                                         |
| Version field missing from schema (migration not applied)  | Low -- version always 1           | Graceful fallback: `getNextVersion()` returns 1 if field absent; works pre- and post-migration                     |
| Large evidence set bloats prompt token count               | Low -- increased cost             | Evidence capped at top 10 items; quotes are short strings from ProposalEvidence                                    |
