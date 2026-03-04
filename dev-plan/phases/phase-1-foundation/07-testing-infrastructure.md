# 07 — Testing Infrastructure

## Objective

Set up the complete testing infrastructure: Vitest configuration, test database lifecycle management, Prisma mock setup with vitest-mock-extended, test factories for creating test data, and the first passing integration test (health check endpoint). This establishes the testing patterns that all feature tests in Phases 2-7 will follow.

## Dependencies

- 03-database-migrations (test database exists, schema applied)
- 04-backend-foundation (Express app, middleware, Prisma singleton)
- 06-docker-dev-environment (Postgres and Redis running)

## Files to Create

| File                                                   | Purpose                                    |
| ------------------------------------------------------ | ------------------------------------------ |
| `packages/api/vitest.config.ts`                        | Vitest configuration for API package       |
| `packages/api/tests/setup.ts`                          | Global test setup: DB connection, cleanup  |
| `packages/api/tests/helpers/prisma-mock.ts`            | Prisma mock singleton for unit tests       |
| `packages/api/tests/helpers/test-app.ts`               | Express app instance for integration tests |
| `packages/api/tests/helpers/factories.ts`              | Test data factory functions                |
| `packages/api/tests/unit/.gitkeep`                     | Placeholder for unit test directory        |
| `packages/api/tests/integration/health.routes.test.ts` | First integration test                     |
| `vitest.config.ts` (root)                              | Root Vitest config (references API config) |

## Files to Modify

| File                         | Changes                 |
| ---------------------------- | ----------------------- |
| `packages/api/package.json`  | Add test scripts        |
| `package.json` (root)        | Add root test script    |
| `packages/api/tsconfig.json` | Include tests directory |

## Detailed Sub-Tasks

### 1. Create API Vitest configuration (`packages/api/vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks', // Use forks for DB isolation
    poolOptions: {
      forks: { singleFork: true }, // Single fork to share DB connection
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/services/**', 'src/middleware/**'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shipscope/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
```

### 2. Create test setup file (`packages/api/tests/setup.ts`)

```typescript
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Use test database
process.env.DATABASE_URL =
  process.env.DATABASE_URL?.replace('/shipscope?', '/shipscope_test?') ||
  'postgresql://shipscope:shipscope@localhost:5432/shipscope_test?schema=public';
process.env.NODE_ENV = 'test';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Ensure pgvector extension exists
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
});

beforeEach(async () => {
  // Clean all tables in dependency order (child tables first)
  await prisma.$transaction([
    prisma.proposalEvidence.deleteMany(),
    prisma.spec.deleteMany(),
    prisma.proposal.deleteMany(),
    prisma.feedbackThemeLink.deleteMany(),
    prisma.theme.deleteMany(),
    prisma.feedbackItem.deleteMany(),
    prisma.feedbackSource.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
```

### 3. Create Prisma mock for unit tests (`packages/api/tests/helpers/prisma-mock.ts`)

```typescript
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { beforeEach } from 'vitest';

export const prismaMock = mockDeep<PrismaClient>();

// Reset all mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
});

export type MockPrisma = DeepMockProxy<PrismaClient>;
```

### 4. Create test app helper (`packages/api/tests/helpers/test-app.ts`)

```typescript
import express from 'express';
import { createApp } from '../../src/index'; // Export app factory from index.ts

// Creates a fresh Express app instance for integration testing
// This avoids port conflicts and state leaking between test suites
export function createTestApp() {
  return createApp(); // Returns configured Express app without calling .listen()
}
```

**Note:** This requires refactoring `packages/api/src/index.ts` to export a `createApp()` function that configures the Express app WITHOUT calling `app.listen()`. The listen call moves to a separate entry point or is conditional.

### 5. Create test data factories (`packages/api/tests/helpers/factories.ts`)

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createFeedbackSource(overrides = {}) {
  return prisma.feedbackSource.create({
    data: {
      name: 'Test Source',
      type: 'csv',
      filename: 'test.csv',
      rowCount: 0,
      metadata: {},
      ...overrides,
    },
  });
}

export async function createFeedbackItem(sourceId: string, overrides = {}) {
  return prisma.feedbackItem.create({
    data: {
      content: 'Test feedback content that is at least 10 characters',
      channel: 'manual',
      sourceId,
      metadata: {},
      ...overrides,
    },
  });
}

export async function createTheme(overrides = {}) {
  return prisma.theme.create({
    data: {
      name: 'Test Theme',
      description: 'A test theme description',
      category: 'feature_request',
      painPoints: ['pain point 1'],
      feedbackCount: 0,
      avgSentiment: 0,
      avgUrgency: 0,
      opportunityScore: 0,
      ...overrides,
    },
  });
}

export async function createProposal(themeId: string, overrides = {}) {
  return prisma.proposal.create({
    data: {
      title: 'Test Proposal',
      problem: 'Test problem statement',
      solution: 'Test solution description',
      status: 'proposed',
      reachScore: 5,
      impactScore: 5,
      confidenceScore: 5,
      effortScore: 5,
      riceScore: 12.5,
      themeId,
      ...overrides,
    },
  });
}

// Create a full pipeline of test data
export async function createFullPipelineData() {
  const source = await createFeedbackSource();
  const items = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      createFeedbackItem(source.id, { content: `Feedback item ${i + 1} with enough content` }),
    ),
  );
  const theme = await createTheme({ feedbackCount: items.length });
  const proposal = await createProposal(theme.id);
  return { source, items, theme, proposal };
}
```

### 6. Write first integration test (`packages/api/tests/integration/health.routes.test.ts`)

```typescript
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
```

### 7. Refactor `index.ts` to export app factory

Split `packages/api/src/index.ts` into:

- `createApp()` function that configures and returns the Express app
- Conditional `app.listen()` that only runs when the file is the main entry point (not when imported by tests)

```typescript
export function createApp() {
  const app = express();
  // ... all middleware and routes ...
  app.use(errorHandler);
  return app;
}

// Only listen when run directly (not imported by tests)
if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(PORT, () => logger.info(`API server running on port ${PORT}`));
}
```

### 8. Add test scripts

In `packages/api/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration"
  }
}
```

In root `package.json`:

```json
{
  "scripts": {
    "test": "npm run test --workspace=packages/api",
    "test:coverage": "npm run test:coverage --workspace=packages/api"
  }
}
```

### 9. Run tests and verify

```bash
npm test  # Should show 1 test suite, 2 passing tests
```

## Acceptance Criteria

- [ ] `npm test` runs and passes with at least 2 green tests
- [ ] Tests run against `shipscope_test` database (NOT dev database)
- [ ] Database is cleaned before each test (no data leaks between tests)
- [ ] Prisma mock is available for unit tests via `vitest-mock-extended`
- [ ] Test factories can create all 5 entity types (Source, Item, Theme, Proposal, Spec)
- [ ] `createFullPipelineData()` factory creates a complete data graph
- [ ] Coverage report generates with `npm run test:coverage`
- [ ] `vitest --watch` mode works for development
- [ ] Test timeout is 30 seconds (sufficient for DB operations)
- [ ] Tests do not conflict with each other (can run in any order)
- [ ] Express app is testable via Supertest without starting a real server

## Complexity Estimate

**L (Large)** — Setting up test infrastructure correctly is critical. Requires refactoring index.ts, creating mock helpers, factories, and ensuring database isolation. Mistakes here cause flaky tests throughout the project.

## Risk Factors & Mitigations

| Risk                                              | Impact                            | Mitigation                                                                                                 |
| ------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tests hit development database instead of test DB | Critical — dev data destroyed     | Environment variable override in setup.ts, verify DB name in beforeAll                                     |
| Test database not created/migrated                | High — all integration tests fail | setup.sh creates test DB; add check in setup.ts with clear error message                                   |
| Prisma client cached between test runs            | Medium — stale schema, mock leaks | Use `mockReset` in beforeEach; generate fresh client for integration tests                                 |
| Test cleanup order wrong (foreign key violations) | Medium — beforeEach fails         | Delete in reverse dependency order: evidence → specs → proposals → links → themes → items → sources        |
| Supertest port conflicts                          | Medium — tests fail randomly      | Use `createTestApp()` without `.listen()`; Supertest handles this internally                               |
| Coverage thresholds too strict for Phase 1        | Low — CI fails prematurely        | Set initial thresholds at 80% statements; no services to test yet, threshold only applies when code exists |
