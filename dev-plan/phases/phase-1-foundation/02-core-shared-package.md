# 02 — Core Shared Package

## Objective

Create the `packages/core` package containing all shared TypeScript types/interfaces and AI prompt template functions that both the API and web packages will import. This is the single source of truth for the data contract between frontend and backend.

## Dependencies

- 01-monorepo-tooling (for tsconfig, ESLint, package structure)

## Files to Create

| File                                     | Purpose                                                         |
| ---------------------------------------- | --------------------------------------------------------------- |
| `packages/core/package.json`             | Package manifest with proper exports                            |
| `packages/core/tsconfig.json`            | TypeScript config for library compilation                       |
| `packages/core/src/index.ts`             | Barrel export for all types and prompts                         |
| `packages/core/src/types/feedback.ts`    | FeedbackItem, FeedbackSource, FeedbackChannel types             |
| `packages/core/src/types/theme.ts`       | Theme, ThemeCategory, ThemeWithEvidence types                   |
| `packages/core/src/types/proposal.ts`    | Proposal, ProposalStatus, RICEScore, ProposalWithEvidence types |
| `packages/core/src/types/spec.ts`        | Spec, PRDSection, AgentPromptFormat types                       |
| `packages/core/src/types/common.ts`      | PaginatedResponse, SortOrder, DateRange, ApiError shared types  |
| `packages/core/src/types/index.ts`       | Barrel export for all types                                     |
| `packages/core/src/prompts/synthesis.ts` | buildScoringPrompt, buildThemeExtractionPrompt                  |
| `packages/core/src/prompts/proposals.ts` | buildProposalPrompt                                             |
| `packages/core/src/prompts/specs.ts`     | buildPRDPrompt, buildAgentPrompt                                |
| `packages/core/src/prompts/index.ts`     | Barrel export for all prompts                                   |

## Files to Modify

| File                  | Changes                                       |
| --------------------- | --------------------------------------------- |
| `package.json` (root) | Ensure `packages/core` is in workspaces array |

## Detailed Sub-Tasks

### 1. Create `packages/core/package.json`

```json
{
  "name": "@shipscope/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./prompts": "./src/prompts/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint 'src/**/*.ts'"
  }
}
```

### 2. Create `packages/core/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

### 3. Define feedback types (`packages/core/src/types/feedback.ts`)

```typescript
export type FeedbackChannel =
  | 'support_ticket'
  | 'interview'
  | 'survey'
  | 'slack'
  | 'app_review'
  | 'manual'
  | 'other';

export type FeedbackSourceType = 'csv' | 'json' | 'api' | 'webhook' | 'manual';

export interface FeedbackSource {
  id: string;
  name: string;
  type: FeedbackSourceType;
  filename: string | null;
  rowCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  content: string;
  author: string | null;
  email: string | null;
  channel: FeedbackChannel;
  sourceId: string;
  sentiment: number | null; // -1.0 to 1.0
  urgency: number | null; // 0.0 to 1.0
  embeddedAt: string | null; // ISO timestamp
  processedAt: string | null; // ISO timestamp
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeedbackInput {
  content: string;
  author?: string;
  email?: string;
  channel?: FeedbackChannel;
  metadata?: Record<string, unknown>;
}

export interface FeedbackFilters {
  search?: string;
  channel?: FeedbackChannel;
  sourceId?: string;
  processed?: boolean;
  sentimentMin?: number;
  sentimentMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface FeedbackStats {
  total: number;
  processed: number;
  unprocessed: number;
  byChannel: Record<FeedbackChannel, number>;
  avgSentiment: number;
  avgUrgency: number;
}

export interface ImportJobStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number; // 0-100
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: string[];
}

export interface CSVColumnMapping {
  content: string; // required — column name for feedback text
  author?: string;
  email?: string;
  channel?: string;
  date?: string;
}
```

### 4. Define theme types (`packages/core/src/types/theme.ts`)

```typescript
export type ThemeCategory =
  | 'bug'
  | 'feature_request'
  | 'ux_issue'
  | 'performance'
  | 'documentation'
  | 'pricing'
  | 'other';

export interface Theme {
  id: string;
  name: string;
  description: string;
  category: ThemeCategory;
  painPoints: string[];
  feedbackCount: number;
  avgSentiment: number;
  avgUrgency: number;
  opportunityScore: number; // Calculated: feedbackCount * avgUrgency * (1 - avgSentiment)
  createdAt: string;
  updatedAt: string;
}

export interface ThemeWithFeedback extends Theme {
  feedbackItems: FeedbackItem[];
}

export interface ThemeWithEvidence extends Theme {
  sampleFeedback: string[]; // Top 5-10 representative feedback texts
}

export interface SynthesisStatus {
  jobId: string;
  status: 'idle' | 'embedding' | 'scoring' | 'clustering' | 'naming' | 'completed' | 'failed';
  progress: number;
  stage: string;
  totalItems: number;
  processedItems: number;
  themesFound: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}
```

### 5. Define proposal types (`packages/core/src/types/proposal.ts`)

```typescript
export type ProposalStatus = 'proposed' | 'approved' | 'rejected' | 'shipped';

export interface RICEScore {
  reach: number; // 1-10
  impact: number; // 1-10
  confidence: number; // 1-10
  effort: number; // 1-10
  total: number; // (R * I * C) / E
}

export interface Proposal {
  id: string;
  title: string;
  problem: string;
  solution: string;
  status: ProposalStatus;
  scores: RICEScore;
  themeId: string;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalEvidence {
  id: string;
  proposalId: string;
  feedbackItemId: string;
  quote: string; // Most relevant sentence from feedback
  relevanceScore: number; // 0-1 similarity to theme centroid
}

export interface ProposalWithEvidence extends Proposal {
  theme: Theme;
  evidence: ProposalEvidence[];
}

export interface UpdateProposalInput {
  title?: string;
  problem?: string;
  solution?: string;
  status?: ProposalStatus;
  scores?: Partial<Omit<RICEScore, 'total'>>; // total is always calculated
}
```

### 6. Define spec types (`packages/core/src/types/spec.ts`)

```typescript
export type AgentPromptFormat = 'cursor' | 'claude_code';

export interface Spec {
  id: string;
  proposalId: string;
  prdMarkdown: string;
  agentPrompt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpecWithProposal extends Spec {
  proposal: Proposal;
}

export interface GenerateSpecInput {
  proposalId: string;
}
```

### 7. Define common/shared types (`packages/core/src/types/common.ts`)

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface ApiError {
  error: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}
```

### 8. Create AI prompt templates

**`packages/core/src/prompts/synthesis.ts`** — Implement `buildScoringPrompt()` and `buildThemeExtractionPrompt()` exactly as defined in product-plan.md Section 8.1 and 8.2. Functions take typed inputs and return formatted prompt strings.

**`packages/core/src/prompts/proposals.ts`** — Implement `buildProposalPrompt()` as defined in Section 8.3.

**`packages/core/src/prompts/specs.ts`** — Implement `buildPRDPrompt()` and `buildAgentPrompt()` as defined in Section 8.4. The `buildAgentPrompt()` function accepts an `AgentPromptFormat` parameter to toggle between Cursor and Claude Code formatting.

### 9. Create barrel exports

**`packages/core/src/types/index.ts`:**

```typescript
export * from './feedback';
export * from './theme';
export * from './proposal';
export * from './spec';
export * from './common';
```

**`packages/core/src/prompts/index.ts`:**

```typescript
export { buildScoringPrompt, buildThemeExtractionPrompt } from './synthesis';
export { buildProposalPrompt } from './proposals';
export { buildPRDPrompt, buildAgentPrompt } from './specs';
```

**`packages/core/src/index.ts`:**

```typescript
export * from './types';
export * from './prompts';
```

### 10. Verify imports work from api and web packages

- Create a temporary test file in `packages/api/src/` that imports from `@shipscope/core`
- Verify TypeScript resolves the types correctly
- Verify the import works with both named imports and path-based imports

## Acceptance Criteria

- [ ] `packages/core` exists and is recognized by npm workspaces
- [ ] All type files compile without errors (`npm run typecheck` in core package)
- [ ] Types are importable as `import { FeedbackItem } from '@shipscope/core'`
- [ ] Types are importable as `import { FeedbackItem } from '@shipscope/core/types'`
- [ ] Prompt functions are importable as `import { buildScoringPrompt } from '@shipscope/core/prompts'`
- [ ] All types mirror the Prisma schema models (field names match)
- [ ] Prompt template functions return valid strings with all template variables substituted
- [ ] No `any` types used anywhere in the core package
- [ ] FeedbackChannel enum values match Prisma schema enum values exactly

## Complexity Estimate

**M (Medium)** — Defining types is straightforward but requires careful alignment with the Prisma schema. The prompt templates need exact formatting per the product plan.

## Risk Factors & Mitigations

| Risk                                               | Impact                                                                   | Mitigation                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Type drift between Prisma and core types           | High — runtime errors when API returns don't match frontend expectations | Generate core types from Prisma schema OR validate manually with a checklist; add a type test that maps Prisma output to core types |
| Prompt template changes breaking AI output parsing | Medium — LLM output format depends on prompt wording                     | Keep prompts in a single location (core/prompts), version them, test prompt output format in unit tests                             |
| Circular dependency between packages               | High — npm workspace resolution fails                                    | Core has ZERO dependencies on api or web; enforce this with ESLint `no-restricted-imports`                                          |
| Path alias not resolving in all toolchains         | Medium — works in tsc but not in Vite or test runner                     | Test imports in api (tsx), web (Vite), and test runner (Vitest) separately                                                          |
