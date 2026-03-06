# 01 — LLM Proposal Generation Service

## Objective

Build the service that takes the top N themes (by opportunity score) from Phase 3 synthesis results and generates one feature proposal per theme using gpt-4o-mini. Each proposal includes a title, problem statement, solution description, and four RICE component scores. The service handles malformed AI output, implements retry logic, and calculates the composite RICE score before persisting to the database.

## Dependencies

- Phase 3 complete (Themes exist with feedbackCount, avgSentiment, avgUrgency, score)
- `packages/api/src/services/ai.service.ts` (aiService.chatJSON)
- `packages/api/src/lib/openai.ts` (withRetry, AI_CONFIG)
- `packages/core/src/prompts/synthesis.ts` (existing prompt patterns)
- Prisma schema: Proposal model, Theme model

## Files to Create

| File                                            | Purpose                                                |
| ----------------------------------------------- | ------------------------------------------------------ |
| `packages/api/src/services/proposal.service.ts` | Proposal generation, RICE calculation, CRUD operations |
| `packages/core/src/prompts/proposals.ts`        | Prompt template for proposal generation                |

## Files to Modify

| File                                  | Changes                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| `packages/core/src/types/proposal.ts` | Add ProposalGeneration types, ThemeWithEvidence interface |
| `packages/api/src/index.ts`           | Import proposal routes                                    |

## Detailed Sub-Tasks

### 1. Define shared types (`packages/core/src/types/proposal.ts`)

Add interfaces consumed by both the API service and the prompt builder:

```typescript
export interface ThemeWithEvidence {
  id: string;
  name: string;
  description: string;
  category: string | null;
  painPoints: string[];
  feedbackCount: number;
  avgSentiment: number | null;
  avgUrgency: number | null;
  score: number | null;
  sampleFeedback: string[]; // Top 5 feedback items by similarity
}

export interface GeneratedProposal {
  title: string;
  problem: string;
  solution: string;
  impactScore: number;
  effortScore: number;
  confidenceScore: number;
  reachScore: number;
}

export interface ProposalWithEvidence {
  id: string;
  title: string;
  description: string;
  problem: string;
  solution: string;
  impactScore: number | null;
  effortScore: number | null;
  confidenceScore: number | null;
  reachScore: number | null;
  riceScore: number | null;
  status: string;
  themeId: string | null;
  theme: {
    id: string;
    name: string;
    category: string | null;
  } | null;
  evidence: {
    id: string;
    quote: string | null;
    relevance: number;
    feedback: {
      id: string;
      content: string;
      author: string | null;
      channel: string | null;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export type ProposalStatus = 'proposed' | 'approved' | 'rejected' | 'shipped';

export interface ProposalGenerationResult {
  proposalsCreated: number;
  proposalsSkipped: number; // Themes with existing approved/shipped proposals
  errors: { themeId: string; themeName: string; error: string }[];
  totalTokensUsed: number;
}
```

### 2. Implement proposal generation prompt (`packages/core/src/prompts/proposals.ts`)

This is the prompt template sent to gpt-4o-mini for each theme. It must produce structured JSON that maps directly to the GeneratedProposal interface.

```typescript
import type { ThemeWithEvidence } from '../types/proposal';

export function buildProposalPrompt(theme: ThemeWithEvidence): string {
  return `You are a senior product manager analyzing customer feedback themes to generate feature proposals.

Theme: ${theme.name}
Description: ${theme.description}
Category: ${theme.category || 'uncategorized'}
Pain Points: ${theme.painPoints.join(', ')}
Feedback Count: ${theme.feedbackCount}
Average Sentiment: ${theme.avgSentiment?.toFixed(2) ?? 'N/A'}
Average Urgency: ${theme.avgUrgency?.toFixed(2) ?? 'N/A'}

Sample feedback (top 5 by relevance):
${theme.sampleFeedback.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

Generate a feature proposal. Respond with JSON only:
{
  "title": "Concise, actionable title (e.g., 'Add bulk export to CSV')",
  "problem": "2-3 sentence problem statement describing user pain",
  "solution": "2-3 sentence proposed solution with enough specificity to estimate effort",
  "impactScore": 1-10,
  "effortScore": 1-10,
  "confidenceScore": 1-10,
  "reachScore": 1-10
}

Scoring guide:
- impactScore: How much would this improve user experience? (1 = minimal, 10 = transformative)
- effortScore: How complex is this to build? (1 = trivial, 10 = months of work)
- confidenceScore: How confident are we this is the right solution? (1 = guessing, 10 = certain from evidence)
- reachScore: What percentage of users would benefit? (1 = niche edge case, 10 = affects everyone)`;
}

export function buildProposalSystemPrompt(): string {
  return `You are a senior product manager at a SaaS company. You generate actionable,
specific feature proposals based on customer feedback analysis. Your proposals should be:
- Specific enough to be actionable (not vague platitudes)
- Grounded in the evidence provided (reference real user pain points)
- Realistically scoped (prefer smaller, shippable features over massive rewrites)
- Scored conservatively (avoid giving everything 8-10; differentiate meaningfully)

Always respond with valid JSON matching the requested schema exactly.`;
}
```

### 3. Build the proposal generation service (`packages/api/src/services/proposal.service.ts`)

This is the core of Phase 4. The service fetches top themes, generates proposals via LLM, and persists results.

**Function: `generateFromThemes(topN: number = 20)`**

```typescript
import { prisma } from '../lib/prisma';
import { aiService } from './ai.service';
import { buildProposalPrompt, buildProposalSystemPrompt } from '@shipscope/core/prompts/proposals';
import type {
  GeneratedProposal,
  ThemeWithEvidence,
  ProposalGenerationResult,
} from '@shipscope/core/types/proposal';

export const proposalService = {
  async generateFromThemes(topN: number = 20): Promise<ProposalGenerationResult> {
    // 1. Fetch top N themes by opportunity score
    const themes = await prisma.theme.findMany({
      orderBy: { score: 'desc' },
      take: topN,
      include: {
        feedbackItems: {
          include: { feedback: true },
          orderBy: { confidence: 'desc' },
          take: 5,
        },
      },
    });

    if (themes.length === 0) {
      throw new AppError(404, 'No themes found. Run synthesis first.');
    }

    const result: ProposalGenerationResult = {
      proposalsCreated: 0,
      proposalsSkipped: 0,
      errors: [],
      totalTokensUsed: 0,
    };

    const systemPrompt = buildProposalSystemPrompt();

    for (const theme of themes) {
      // 2. Skip themes that already have approved/shipped proposals
      const existingProtected = await prisma.proposal.findFirst({
        where: {
          themeId: theme.id,
          status: { in: ['approved', 'shipped'] },
        },
      });

      if (existingProtected) {
        result.proposalsSkipped++;
        continue;
      }

      // 3. Delete existing "proposed" proposals for this theme (regeneration)
      await prisma.proposalEvidence.deleteMany({
        where: {
          proposal: { themeId: theme.id, status: 'proposed' },
        },
      });
      await prisma.proposal.deleteMany({
        where: { themeId: theme.id, status: 'proposed' },
      });

      // 4. Build theme context with sample feedback
      const themeWithEvidence: ThemeWithEvidence = {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        category: theme.category,
        painPoints: parsePainPoints(theme),
        feedbackCount: theme.feedbackCount,
        avgSentiment: theme.avgSentiment,
        avgUrgency: theme.avgUrgency,
        score: theme.score,
        sampleFeedback: theme.feedbackItems.map((link) => link.feedback.content),
      };

      try {
        // 5. Call LLM
        const generated = await aiService.chatJSON<GeneratedProposal>(
          buildProposalPrompt(themeWithEvidence),
          systemPrompt,
        );

        // 6. Validate and sanitize AI output
        const sanitized = sanitizeProposal(generated);

        // 7. Calculate RICE score
        const riceScore = calculateRICE(
          sanitized.reachScore,
          sanitized.impactScore,
          sanitized.confidenceScore,
          sanitized.effortScore,
        );

        // 8. Create Proposal record
        await prisma.proposal.create({
          data: {
            title: sanitized.title,
            description: sanitized.problem, // description mirrors problem for backwards compat
            problem: sanitized.problem,
            solution: sanitized.solution,
            impactScore: sanitized.impactScore,
            effortScore: sanitized.effortScore,
            confidenceScore: sanitized.confidenceScore,
            reachScore: sanitized.reachScore,
            riceScore,
            status: 'proposed',
            themeId: theme.id,
          },
        });

        result.proposalsCreated++;
      } catch (err) {
        result.errors.push({
          themeId: theme.id,
          themeName: theme.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    result.totalTokensUsed = aiService.getUsage().totalTokens;
    return result;
  },
};
```

### 4. Implement RICE calculation as a pure function

The RICE formula must be deterministic and reusable (called during generation and during manual score edits).

```typescript
/**
 * Calculate RICE score: (Reach x Impact x Confidence) / Effort
 * All inputs are integers 1-10.
 * Returns a float. Higher = higher priority.
 *
 * Example: Reach=8, Impact=7, Confidence=6, Effort=3 → (8×7×6)/3 = 112.0
 * Example: Reach=3, Impact=4, Confidence=5, Effort=8 → (3×4×5)/8 = 7.5
 */
export function calculateRICE(
  reach: number,
  impact: number,
  confidence: number,
  effort: number,
): number {
  if (effort === 0) {
    throw new AppError(400, 'Effort score cannot be zero');
  }
  return (reach * impact * confidence) / effort;
}
```

### 5. Implement AI output sanitization

LLM output is inherently unreliable. Every field must be validated and clamped to expected ranges.

```typescript
function sanitizeProposal(raw: unknown): GeneratedProposal {
  const obj = raw as Record<string, unknown>;

  return {
    title: sanitizeString(obj.title, 'Untitled Proposal', 150),
    problem: sanitizeString(obj.problem, 'No problem statement generated.', 2000),
    solution: sanitizeString(obj.solution, 'No solution generated.', 2000),
    impactScore: clampScore(obj.impactScore),
    effortScore: clampScore(obj.effortScore, 5), // Default effort to 5 (medium)
    confidenceScore: clampScore(obj.confidenceScore),
    reachScore: clampScore(obj.reachScore),
  };
}

function sanitizeString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }
  return value.trim().slice(0, maxLength);
}

function clampScore(value: unknown, fallback: number = 5): number {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return fallback;
  return Math.max(1, Math.min(10, Math.round(num)));
}
```

### 6. Parse theme pain points from database

The Theme model stores pain points as part of the description or as a JSON string. Handle both formats.

```typescript
function parsePainPoints(theme: { description: string; category: string | null }): string[] {
  // Pain points may be stored as JSON array string or as a plain field
  // In Phase 3, themes are created with pain points embedded
  // For safety, handle both formats
  try {
    // If the theme was created by Phase 3 theme extraction, painPoints is a JSON field
    const raw = (theme as any).painPoints;
    if (Array.isArray(raw)) return raw.map(String).slice(0, 5);
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).slice(0, 5);
    }
  } catch {
    // Fall through to empty
  }
  return [];
}
```

### 7. Fetch top sample feedback for a theme

Retrieve the most representative feedback items to include in the LLM prompt. These are ordered by the `confidence` (similarity score) on FeedbackThemeLink.

```typescript
async function getSampleFeedback(themeId: string, limit: number = 5): Promise<string[]> {
  const links = await prisma.feedbackThemeLink.findMany({
    where: { themeId },
    orderBy: { confidence: 'desc' },
    take: limit,
    include: { feedback: { select: { content: true } } },
  });
  return links.map((link) => link.feedback.content);
}
```

### 8. Handle regeneration safely

When the user clicks "Generate Proposals" again, the service must:

1. Preserve proposals with status `approved`, `rejected`, or `shipped`
2. Delete proposals with status `proposed` for themes that will be regenerated
3. Delete associated ProposalEvidence records for deleted proposals
4. Generate fresh proposals for themes that have no protected proposals

This is handled in step 3 of the `generateFromThemes` function above. The deletion uses a transaction-safe pattern: evidence is deleted first (child), then proposals (parent).

### 9. Error handling per theme

If the LLM fails for one theme (malformed output, rate limit exhaustion, timeout), the service:

1. Logs the error with theme context
2. Records the error in the result object
3. Continues to the next theme
4. Returns partial results with error summary

This ensures that a single bad theme does not abort the entire generation run.

```typescript
// In the catch block of the generation loop:
catch (err) {
  const message = err instanceof AppError
    ? `AI error: ${err.message}`
    : err instanceof Error
      ? err.message
      : 'Unknown error during proposal generation';

  console.error(`[ProposalService] Failed to generate for theme "${theme.name}":`, message);

  result.errors.push({
    themeId: theme.id,
    themeName: theme.name,
    error: message,
  });
  // Continue to next theme — do not throw
}
```

## Acceptance Criteria

- [ ] `proposalService.generateFromThemes(N)` fetches top N themes by opportunity score
- [ ] For each theme, builds a prompt using `buildProposalPrompt()` with theme name, description, pain points, sample feedback, and aggregate scores
- [ ] Calls `aiService.chatJSON()` with the proposal prompt and system prompt
- [ ] Parses LLM response into GeneratedProposal with title, problem, solution, and 4 scores
- [ ] Sanitizes all fields: strings trimmed and capped, scores clamped to 1-10 integers
- [ ] Calculates RICE score as `(Reach x Impact x Confidence) / Effort`
- [ ] Creates Proposal record in database with status "proposed" and themeId link
- [ ] Skips themes that have existing approved or shipped proposals
- [ ] Deletes existing "proposed" proposals and their evidence before regeneration
- [ ] Continues to next theme on LLM failure (does not abort batch)
- [ ] Returns ProposalGenerationResult with created/skipped counts and error list
- [ ] Handles malformed AI output gracefully (defaults for missing/invalid fields)
- [ ] Effort score of 0 throws a 400 error (prevents division by zero)
- [ ] `calculateRICE()` is exported as a pure function for reuse in manual edits

## Complexity Estimate

**L (Large)** -- Multiple LLM calls (one per theme, up to 20), output sanitization with extensive edge-case handling, safe regeneration logic with cascading deletes, RICE calculation, and typed prompt building.

## Risk Factors & Mitigations

| Risk                                                         | Impact                              | Mitigation                                                                                              |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| LLM generates vague/generic proposals                        | Medium -- proposals not actionable  | System prompt explicitly requests specificity; include 5 real feedback samples for grounding            |
| LLM returns scores clustered around 7-8 (no differentiation) | Medium -- RICE ranking is useless   | System prompt instructs conservative scoring; users can override manually                               |
| Rate limiting on 20 sequential LLM calls                     | Medium -- generation takes too long | Sequential processing with built-in retry/backoff from aiService; 20 calls is within gpt-4o-mini limits |
| Malformed JSON from LLM despite json_object mode             | Low -- parse failure                | aiService.chatJSON already handles; sanitizeProposal provides fallback defaults                         |
| Regeneration deletes proposals user was reviewing            | Medium -- lost context              | Only delete "proposed" status; approved/shipped are preserved; add confirmation in UI                   |
| Theme has no feedback items (edge case)                      | Low -- empty prompt                 | Skip themes with feedbackCount < 2; include guard in generation loop                                    |
