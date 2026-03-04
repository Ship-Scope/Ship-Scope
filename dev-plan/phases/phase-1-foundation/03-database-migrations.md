# 03 — Database Schema & Migrations

## Objective

Validate the existing Prisma schema, generate the initial migration, enable the pgvector extension, and create a comprehensive seed script that populates the database with 200 realistic feedback items for development and demos.

## Dependencies

- 01-monorepo-tooling (for package structure)
- Docker must be running (Postgres + Redis from docker-compose.yml)

## Files to Create

| File                              | Purpose                                         |
| --------------------------------- | ----------------------------------------------- |
| `packages/api/prisma/migrations/` | Auto-generated migration directory              |
| `packages/api/prisma/seed.ts`     | Seed script with 200 realistic feedback items   |
| `packages/api/.env`               | Local environment variables (from .env.example) |
| `packages/api/.env.test`          | Test database environment variables             |

## Files to Modify

| File                                | Changes                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `packages/api/prisma/schema.prisma` | Validate and add any missing indexes, pgvector extension |
| `packages/api/package.json`         | Add prisma seed config and db scripts                    |

## Detailed Sub-Tasks

### 1. Validate existing Prisma schema against product-plan.md

Review `packages/api/prisma/schema.prisma` and ensure all 7 models match the specification:

**FeedbackSource:**

- `id` (UUID, default cuid), `name`, `type` (enum: csv/json/api/webhook/manual)
- `filename` (optional), `rowCount` (Int), `metadata` (Json)
- `createdAt`, timestamps
- Relation: `feedbackItems` → FeedbackItem[]

**FeedbackItem:**

- `id`, `content` (Text), `author` (optional), `email` (optional)
- `channel` (enum: support_ticket/interview/survey/slack/app_review/manual/other)
- `sourceId` → FeedbackSource
- `sentiment` (Float, optional), `urgency` (Float, optional)
- `embedding` (Unsupported("vector(1536)"), optional) — pgvector
- `embeddedAt`, `processedAt` (DateTime, optional)
- `metadata` (Json), `createdAt`, `updatedAt`
- Indexes: `sourceId`, `channel`, `createdAt`, `processedAt`

**Theme:**

- `id`, `name`, `description`, `category` (enum)
- `painPoints` (String[]), `feedbackCount` (Int), `avgSentiment` (Float), `avgUrgency` (Float)
- `opportunityScore` (Float)
- `createdAt`, `updatedAt`

**FeedbackThemeLink:**

- `id`, `feedbackItemId` → FeedbackItem, `themeId` → Theme
- `similarityScore` (Float) — how close to centroid
- Unique constraint: `[feedbackItemId, themeId]`

**Proposal:**

- `id`, `title`, `problem` (Text), `solution` (Text)
- `status` (enum: proposed/approved/rejected/shipped)
- `reachScore`, `impactScore`, `confidenceScore`, `effortScore` (Int, 1-10)
- `riceScore` (Float) — calculated
- `themeId` → Theme
- `createdAt`, `updatedAt`

**ProposalEvidence:**

- `id`, `proposalId` → Proposal, `feedbackItemId` → FeedbackItem
- `quote` (Text), `relevanceScore` (Float)

**Spec:**

- `id`, `proposalId` → Proposal (unique)
- `prdMarkdown` (Text), `agentPrompt` (Text)
- `version` (Int, default 1)
- `createdAt`, `updatedAt`

### 2. Add pgvector extension to schema

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}
```

### 3. Add performance indexes

```prisma
@@index([sourceId])
@@index([channel])
@@index([createdAt])
@@index([processedAt])
@@index([sentiment])
@@index([urgency])
// On Theme:
@@index([category])
@@index([opportunityScore])
// On Proposal:
@@index([status])
@@index([riceScore])
```

### 4. Create local .env file

```env
DATABASE_URL="postgresql://shipscope:shipscope@localhost:5432/shipscope?schema=public"
REDIS_URL="redis://localhost:6379"
OPENAI_API_KEY="sk-your-key-here"
AI_MODEL="gpt-4o-mini"
EMBEDDING_MODEL="text-embedding-3-small"
PORT=4000
NODE_ENV="development"
```

### 5. Create .env.test file

```env
DATABASE_URL="postgresql://shipscope:shipscope@localhost:5432/shipscope_test?schema=public"
REDIS_URL="redis://localhost:6379/1"
NODE_ENV="test"
```

### 6. Run initial migration

```bash
cd packages/api
npx prisma migrate dev --name init
```

Verify: `prisma/migrations/` directory created with SQL migration file.

### 7. Create test database

```bash
createdb -U shipscope shipscope_test
# Or via psql:
psql -U shipscope -c "CREATE DATABASE shipscope_test;"
# Apply migration to test DB:
DATABASE_URL="postgresql://shipscope:shipscope@localhost:5432/shipscope_test" npx prisma migrate deploy
```

### 8. Build seed script (`packages/api/prisma/seed.ts`)

Create 200 realistic feedback items for a fictional B2B project management tool called "TaskFlow":

**Sources to create:**

- "Intercom Export Q4 2024" (csv, 80 items)
- "User Interviews Batch 3" (csv, 40 items)
- "NPS Survey Dec 2024" (csv, 30 items)
- "Slack #product-feedback" (api, 30 items)
- "App Store Reviews" (csv, 20 items)

**Feedback themes to cover (per product plan Section 9):**

1. **Bulk export functionality** (~30 items) — "Can't export more than 100 rows", "Need CSV export for reports", etc.
2. **Real-time notifications** (~25 items) — "Don't know when tasks change", "Need push notifications", etc.
3. **Mobile app performance** (~25 items) — "App crashes on Android", "Loading takes forever", etc.
4. **Custom dashboard widgets** (~25 items) — "Want to add my own charts", "Dashboard is too rigid", etc.
5. **API rate limiting issues** (~20 items) — "Getting 429 errors constantly", "Rate limits too low", etc.
6. **Onboarding flow confusion** (~25 items) — "Didn't know where to start", "Setup wizard skips steps", etc.
7. **Pricing tier complaints** (~25 items) — "Pro plan too expensive", "Features locked behind enterprise", etc.
8. **Dark mode request** (~25 items) — "Please add dark mode", "Bright UI hurts my eyes", etc.

**Each feedback item should:**

- Have realistic, varied language (not template-y)
- Vary in length (1-5 sentences)
- Include appropriate channel assignment
- Include author names (mix of real-sounding names and anonymous)
- Include emails for some (not all)
- Have realistic timestamps spread over 3 months

### 9. Configure prisma seed in package.json

Add to `packages/api/package.json`:

```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

### 10. Run and verify seed

```bash
npx prisma db seed
npx prisma studio  # Verify data in browser
```

## Acceptance Criteria

- [ ] `npx prisma migrate dev` succeeds without errors
- [ ] All 7 tables created in PostgreSQL with correct columns and types
- [ ] pgvector extension enabled (`SELECT * FROM pg_extension WHERE extname = 'vector'`)
- [ ] All indexes created (verify in Prisma Studio or psql)
- [ ] `npx prisma db seed` populates 200 feedback items across 5 sources
- [ ] Feedback items cover all 8 theme areas with realistic content
- [ ] Each source has correct rowCount matching its feedback items
- [ ] Test database (`shipscope_test`) created and migration applied
- [ ] `npx prisma studio` shows all data correctly
- [ ] `.env` and `.env.test` are in `.gitignore` (sensitive data)

## Complexity Estimate

**M (Medium)** — Schema already exists, main work is validation, migration, and writing 200 realistic seed items.

## Risk Factors & Mitigations

| Risk                                             | Impact                                | Mitigation                                                                        |
| ------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------- |
| pgvector extension not available in Docker image | Critical — embeddings can't be stored | Use `pgvector/pgvector:pg16` Docker image (already in compose)                    |
| Migration fails on existing database             | Medium — blocks development           | Drop and recreate DB if needed during dev; never in production                    |
| Seed data too uniform (AI-detectable patterns)   | Low — demo quality suffers            | Write seed data manually with varied language patterns, not from a template loop  |
| Test DB not isolated from dev DB                 | High — test cleanup destroys dev data | Separate DATABASE_URL in .env.test, verify before each test run                   |
| Prisma client version mismatch                   | Medium — runtime errors               | Pin Prisma version in package.json, run `prisma generate` after any schema change |
