# 02 -- Agent-Ready Prompt Export

## Objective

Build the `buildAgentPrompt()` function that takes a generated PRD, proposal metadata, and a target format (Cursor or Claude Code) and produces a structured, copy-pasteable development prompt. This prompt is designed to be dropped directly into an AI coding agent's context, giving it everything needed to implement the feature: task description, requirements, data model changes, API endpoints, UI specs, edge cases, and test expectations. The function is purely deterministic (no LLM call) and lives in the shared `packages/core` package so both backend and frontend can reference the format logic.

## Dependencies

- 01 (PRD Generation) complete -- needs the Spec record with `prd` field populated
- `packages/core/src/types/proposal.ts` (ProposalWithEvidence)
- `packages/core/src/types/spec.ts` (AgentPromptFormat)

## Files to Create

| File                                      | Purpose |
| ----------------------------------------- | ------- |
| (none -- all code goes in existing files) |         |

## Files to Modify

| File                                 | Changes                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `packages/core/src/prompts/specs.ts` | Add `buildAgentPrompt()`, `buildCursorPrompt()`, `buildClaudeCodePrompt()`, and section extraction helpers |
| `packages/core/src/types/spec.ts`    | Add `AgentPromptSection` interface if not already present                                                  |

## Detailed Sub-Tasks

### 1. Define the agent prompt section structure

The agent prompt is assembled from discrete sections, each extracted from the PRD markdown or the proposal metadata. Define the intermediate structure.

```typescript
// packages/core/src/types/spec.ts (additions)

export interface AgentPromptSection {
  heading: string;
  content: string;
}

export interface AgentPromptContext {
  title: string;
  problem: string;
  solution: string;
  acceptanceCriteria: string;
  dataModelChanges: string;
  apiChanges: string;
  uiRequirements: string;
  edgeCases: string;
  testCases: string;
  outOfScope: string;
  userStories: string;
  themeName: string | null;
  riceScore: number | null;
  evidenceCount: number;
}
```

### 2. Build the PRD section extractor

Extract individual sections from the full PRD markdown. This is the same regex-based approach used in `parsePRDSections()` from 01, but exposed as a reusable utility in the core package.

```typescript
// packages/core/src/prompts/specs.ts

/**
 * Extract a section from markdown by its ## heading.
 * Returns the content between the heading and the next ## heading (or end of string).
 */
export function extractSection(markdown: string, sectionName: string): string {
  const regex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = markdown.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Build the full context object from PRD markdown + proposal data.
 */
export function buildPromptContext(
  prdMarkdown: string,
  proposal: ProposalWithEvidence,
): AgentPromptContext {
  return {
    title: proposal.title,
    problem: proposal.problem,
    solution: proposal.solution,
    acceptanceCriteria: extractSection(prdMarkdown, 'Acceptance Criteria'),
    dataModelChanges: extractSection(prdMarkdown, 'Data Model Changes'),
    apiChanges: extractSection(prdMarkdown, 'API Changes'),
    uiRequirements: extractSection(prdMarkdown, 'UI/UX Requirements'),
    edgeCases: extractSection(prdMarkdown, 'Edge Cases'),
    testCases: deriveTestCases(prdMarkdown),
    outOfScope: extractSection(prdMarkdown, 'Out of Scope'),
    userStories: extractSection(prdMarkdown, 'User Stories'),
    themeName: proposal.theme?.name ?? null,
    riceScore: proposal.riceScore,
    evidenceCount: proposal.evidence.length,
  };
}

/**
 * Derive test case descriptions from acceptance criteria and edge cases.
 * This produces a list of "should ..." statements suitable for test file skeletons.
 */
function deriveTestCases(prdMarkdown: string): string {
  const ac = extractSection(prdMarkdown, 'Acceptance Criteria');
  const edge = extractSection(prdMarkdown, 'Edge Cases');

  const lines: string[] = [];

  // Convert acceptance criteria to test descriptions
  const acItems = ac.split('\n').filter((l) => l.trim().length > 0);
  acItems.forEach((item) => {
    const cleaned = item.replace(/^[\s]*[-*\d.]+\s*/, '').trim();
    if (cleaned.length > 0) {
      lines.push(`- should ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`);
    }
  });

  // Convert edge cases to test descriptions
  const edgeItems = edge.split('\n').filter((l) => l.trim().length > 0);
  edgeItems.forEach((item) => {
    const cleaned = item.replace(/^[\s]*[-*\d.]+\s*/, '').trim();
    if (cleaned.length > 0) {
      lines.push(
        `- should handle edge case: ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`,
      );
    }
  });

  return lines.join('\n');
}
```

### 3. Build the Cursor format prompt

Cursor prompts use concise `##` headers, imperative tone, and focus on actionable file-level instructions. Cursor users typically paste the prompt into a new Composer session.

```typescript
// packages/core/src/prompts/specs.ts

function buildCursorPrompt(ctx: AgentPromptContext): string {
  const sections: string[] = [];

  sections.push(`## Task
Implement the following feature: ${ctx.title}`);

  sections.push(`## Context
${ctx.problem}

Proposed solution: ${ctx.solution}`);

  if (ctx.themeName) {
    sections.push(
      `This feature addresses the "${ctx.themeName}" theme identified from ${ctx.evidenceCount} pieces of user feedback.${ctx.riceScore ? ` RICE priority score: ${ctx.riceScore.toFixed(1)}.` : ''}`,
    );
  }

  if (ctx.userStories) {
    sections.push(`## User Stories
${ctx.userStories}`);
  }

  sections.push(`## Requirements
${ctx.acceptanceCriteria}`);

  if (ctx.dataModelChanges && ctx.dataModelChanges.toLowerCase() !== 'none') {
    sections.push(`## Data Model Changes
${ctx.dataModelChanges}`);
  }

  if (ctx.apiChanges && ctx.apiChanges.toLowerCase() !== 'none') {
    sections.push(`## API Endpoints
${ctx.apiChanges}`);
  }

  if (ctx.uiRequirements) {
    sections.push(`## UI Changes
${ctx.uiRequirements}`);
  }

  if (ctx.edgeCases) {
    sections.push(`## Edge Cases to Handle
${ctx.edgeCases}`);
  }

  if (ctx.outOfScope) {
    sections.push(`## Out of Scope
${ctx.outOfScope}`);
  }

  if (ctx.testCases) {
    sections.push(`## Tests to Write
${ctx.testCases}`);
  }

  return sections.join('\n\n');
}
```

### 4. Build the Claude Code format prompt

Claude Code prompts are more conversational and benefit from explicit file paths, step-by-step ordering, and a "think step by step" framing. Claude Code users paste into the REPL or provide as a task file.

```typescript
// packages/core/src/prompts/specs.ts

function buildClaudeCodePrompt(ctx: AgentPromptContext): string {
  const sections: string[] = [];

  sections.push(`# Feature Implementation: ${ctx.title}

## Overview
${ctx.problem}

**Proposed solution:** ${ctx.solution}`);

  if (ctx.themeName) {
    sections.push(
      `**Background:** This feature addresses the "${ctx.themeName}" theme, identified from analyzing ${ctx.evidenceCount} pieces of real user feedback.${ctx.riceScore ? ` The feature has a RICE priority score of ${ctx.riceScore.toFixed(1)}.` : ''}`,
    );
  }

  if (ctx.userStories) {
    sections.push(`## User Stories
${ctx.userStories}`);
  }

  sections.push(`## Acceptance Criteria
${ctx.acceptanceCriteria}

Implement each criterion. Mark them off as you complete them.`);

  const implementationSteps: string[] = [];
  let stepNum = 1;

  if (ctx.dataModelChanges && ctx.dataModelChanges.toLowerCase() !== 'none') {
    implementationSteps.push(`### Step ${stepNum}: Data Model Changes
${ctx.dataModelChanges}

Update the Prisma schema, generate a migration, and apply it.`);
    stepNum++;
  }

  if (ctx.apiChanges && ctx.apiChanges.toLowerCase() !== 'none') {
    implementationSteps.push(`### Step ${stepNum}: API Implementation
${ctx.apiChanges}

Create the service functions first, then the route handlers. Follow the thin-route pattern: routes handle HTTP concerns only, all business logic goes in service functions.`);
    stepNum++;
  }

  if (ctx.uiRequirements) {
    implementationSteps.push(`### Step ${stepNum}: UI Implementation
${ctx.uiRequirements}

Use the existing design system. Dark theme: bg #07080A, surface #0D0F12, accent blue #3B82F6, text #E8ECF1. Use Tailwind classes, not inline styles.`);
    stepNum++;
  }

  implementationSteps.push(`### Step ${stepNum}: Edge Cases
Handle these edge cases explicitly:
${ctx.edgeCases}`);
  stepNum++;

  if (ctx.testCases) {
    implementationSteps.push(`### Step ${stepNum}: Tests
Write tests for the following:
${ctx.testCases}

Use Vitest for unit tests and Supertest for integration tests. Mock external services (OpenAI, etc.) in unit tests.`);
  }

  if (implementationSteps.length > 0) {
    sections.push(`## Implementation Plan

Follow these steps in order:\n\n${implementationSteps.join('\n\n')}`);
  }

  if (ctx.outOfScope) {
    sections.push(`## Out of Scope (Do NOT implement these)
${ctx.outOfScope}`);
  }

  return sections.join('\n\n');
}
```

### 5. Build the main `buildAgentPrompt()` dispatcher

The public function that routes to the correct format builder.

```typescript
// packages/core/src/prompts/specs.ts

import type { ProposalWithEvidence } from '../types/proposal';
import type { AgentPromptFormat, AgentPromptContext } from '../types/spec';

/**
 * Build a structured development prompt from a PRD and proposal data.
 * The prompt is formatted for the specified coding agent.
 *
 * @param prdMarkdown - The full PRD markdown from the Spec record
 * @param proposal - The source proposal with evidence
 * @param format - 'cursor' or 'claude-code'
 * @returns Formatted prompt string ready for copy/paste
 */
export function buildAgentPrompt(
  prdMarkdown: string,
  proposal: ProposalWithEvidence,
  format: AgentPromptFormat = 'cursor',
): string {
  const ctx = buildPromptContext(prdMarkdown, proposal);

  switch (format) {
    case 'cursor':
      return buildCursorPrompt(ctx);
    case 'claude-code':
      return buildClaudeCodePrompt(ctx);
    default:
      // Exhaustive check
      const _exhaustive: never = format;
      throw new Error(`Unknown agent prompt format: ${_exhaustive}`);
  }
}
```

### 6. Key differences between Cursor and Claude Code formats

| Aspect            | Cursor Format                | Claude Code Format                                                 |
| ----------------- | ---------------------------- | ------------------------------------------------------------------ |
| Top-level heading | `## Task` (H2)               | `# Feature Implementation: {title}` (H1)                           |
| Tone              | Imperative, terse            | Conversational, explanatory                                        |
| Structure         | Flat sections                | Numbered implementation steps                                      |
| Data model        | Raw section content          | "Update Prisma schema, generate migration" instruction             |
| API section       | `## API Endpoints`           | Step-numbered with thin-route pattern reminder                     |
| UI section        | `## UI Changes`              | Includes design system tokens (colors, theme)                      |
| Testing           | `## Tests to Write`          | Step-numbered with framework names (Vitest, Supertest)             |
| Out of scope      | `## Out of Scope`            | `## Out of Scope (Do NOT implement these)` -- explicit prohibition |
| Overall length    | Shorter, ~60% of Claude Code | Longer, more context-rich                                          |

### 7. Handle edge cases in section extraction

The PRD may have variations in heading format. Make extraction resilient.

```typescript
/**
 * Enhanced section extraction that handles common LLM formatting variations:
 * - "## UI/UX Requirements" vs "## UI Requirements" vs "## UI/UX"
 * - Extra whitespace or punctuation in headings
 * - Headings with trailing colons ("## Edge Cases:")
 */
export function extractSection(markdown: string, sectionName: string): string {
  // Try exact match first
  const exactRegex = new RegExp(
    `##\\s+${escapeRegex(sectionName)}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    'i',
  );
  const exactMatch = markdown.match(exactRegex);
  if (exactMatch) return exactMatch[1].trim();

  // Try fuzzy match (first word of section name)
  const firstWord = sectionName.split(/[\s/]+/)[0];
  const fuzzyRegex = new RegExp(
    `##\\s+${escapeRegex(firstWord)}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    'i',
  );
  const fuzzyMatch = markdown.match(fuzzyRegex);
  if (fuzzyMatch) return fuzzyMatch[1].trim();

  return '';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 8. Export the complete `specs.ts` module API

Ensure the module exports all public functions needed by the service and tests.

```typescript
// packages/core/src/prompts/specs.ts -- complete export list

export {
  buildPRDPrompt,
  buildPRDSystemPrompt,
  buildAgentPrompt,
  extractSection,
  buildPromptContext,
};

// Internal (not exported): buildCursorPrompt, buildClaudeCodePrompt, deriveTestCases, escapeRegex
```

### 9. Wire up the agent prompt endpoint in specs routes

The route handler was defined in 01 but the `format` query parameter needs to be validated and passed through.

```typescript
// Already implemented in 01-prd-generation.md, routes section.
// Verify this handler works end-to-end:

// GET /api/specs/:id/agent-prompt?format=cursor
// GET /api/specs/:id/agent-prompt?format=claude-code
// GET /api/specs/:id/agent-prompt  (defaults to cursor)

// Response: Content-Type: text/plain, body is the formatted prompt string
```

## Acceptance Criteria

- [ ] `buildAgentPrompt(prd, proposal, 'cursor')` returns a Cursor-formatted prompt with `##` section headers
- [ ] `buildAgentPrompt(prd, proposal, 'claude-code')` returns a Claude Code-formatted prompt with `#` heading and numbered steps
- [ ] Both formats include: Task/Overview, Context/Problem, Requirements/Acceptance Criteria, Edge Cases, Tests
- [ ] Data Model Changes section omitted when content is "None" or empty
- [ ] API Changes section omitted when content is "None" or empty
- [ ] Test cases derived from acceptance criteria and edge cases as "should ..." statements
- [ ] Cursor format is shorter and uses imperative tone
- [ ] Claude Code format includes design system tokens (colors, component patterns)
- [ ] Claude Code format includes explicit framework names (Vitest, Supertest, Prisma)
- [ ] Claude Code format includes numbered implementation steps in logical order (data model -> API -> UI -> edge cases -> tests)
- [ ] `extractSection()` handles exact heading matches
- [ ] `extractSection()` handles fuzzy matches (partial heading, trailing colons)
- [ ] `extractSection()` returns empty string for missing sections (does not throw)
- [ ] `buildPromptContext()` assembles all fields from PRD markdown and proposal metadata
- [ ] Theme name and RICE score included when available
- [ ] Evidence count included in context description
- [ ] Out of scope section marked with explicit "Do NOT implement" in Claude Code format
- [ ] No LLM call is made -- the function is purely deterministic string assembly
- [ ] Module exports `buildPRDPrompt`, `buildPRDSystemPrompt`, `buildAgentPrompt`, `extractSection`, `buildPromptContext`
- [ ] GET /api/specs/:id/agent-prompt?format=cursor returns Cursor prompt
- [ ] GET /api/specs/:id/agent-prompt?format=claude-code returns Claude Code prompt
- [ ] GET /api/specs/:id/agent-prompt (no format) defaults to Cursor

## Complexity Estimate

**M (Medium)** -- No LLM calls, no database writes. Entirely string manipulation and formatting logic. Main complexity is handling LLM output variations in section extraction and ensuring both prompt formats are comprehensive and well-structured.

## Risk Factors & Mitigations

| Risk                                                            | Impact                                        | Mitigation                                                                                                               |
| --------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| PRD section headings vary from expected format                  | Medium -- sections extracted as empty strings | Fuzzy regex matching with fallback to first-word match; tested against common variations                                 |
| Agent prompt becomes too long for coding agent context window   | Medium -- agent truncates context             | PRDs are typically 2-4K tokens; agent prompts are derived subsets (shorter); Cursor prompt is ~60% of Claude Code length |
| Test case derivation produces low-quality test descriptions     | Low -- tests not useful                       | Derivation is best-effort from acceptance criteria; developers will refine; provides a starting skeleton                 |
| New agent formats requested in future (Copilot, Windsurf, etc.) | Low -- requires code changes                  | Format is a simple switch/case; adding a new format requires only a new builder function                                 |
| Out of Scope section formatting confuses the agent              | Low -- agent implements excluded features     | Claude Code format uses explicit "Do NOT implement" language; Cursor format uses standard heading                        |
| Cursor format lacking design system context                     | Low -- UI implementation mismatches           | Cursor users typically have project context already; if needed, add design tokens to Cursor format later                 |
