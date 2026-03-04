# 01 — Feedback Service Layer

## Objective

Extract all business logic from the existing `feedback.ts` route file into a dedicated `feedback.service.ts` service. Implement full CRUD operations, duplicate detection, bulk operations, pagination, search, filtering, sorting, and aggregate statistics — all as pure functions that receive a Prisma client and return typed results.

## Dependencies

- Phase 1 complete (backend foundation, Prisma singleton, error classes, shared types)

## Files to Create

| File                                            | Purpose                                       |
| ----------------------------------------------- | --------------------------------------------- |
| `packages/api/src/services/feedback.service.ts` | All feedback business logic                   |
| `packages/api/src/schemas/feedback.schema.ts`   | Zod validation schemas for feedback endpoints |

## Files to Modify

| File                                  | Changes                                            |
| ------------------------------------- | -------------------------------------------------- |
| `packages/api/src/routes/feedback.ts` | Refactor to thin route layer delegating to service |

## Detailed Sub-Tasks

### 1. Create Zod validation schemas (`packages/api/src/schemas/feedback.schema.ts`)

```typescript
import { z } from 'zod';

export const createFeedbackSchema = z.object({
  content: z.string().min(10, 'Content must be at least 10 characters').max(10000),
  author: z.string().max(200).optional(),
  email: z.string().email('Invalid email format').optional(),
  channel: z
    .enum(['support_ticket', 'interview', 'survey', 'slack', 'app_review', 'manual', 'other'])
    .default('manual'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const feedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  channel: z
    .enum(['support_ticket', 'interview', 'survey', 'slack', 'app_review', 'manual', 'other'])
    .optional(),
  sourceId: z.string().uuid().optional(),
  processed: z.enum(['true', 'false']).optional(),
  sentimentMin: z.coerce.number().min(-1).max(1).optional(),
  sentimentMax: z.coerce.number().min(-1).max(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'sentiment', 'urgency']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(500),
});
```

### 2. Implement feedback service (`packages/api/src/services/feedback.service.ts`)

**Function: `create(input)`**

- Validate input against schema
- Trim whitespace from content
- Create FeedbackSource of type 'manual' if not exists (one shared "Manual Entry" source)
- Create FeedbackItem with sourceId
- Return created item

**Function: `findById(id)`**

- Fetch by ID with source relation included
- Throw `NotFound('Feedback item')` if not exists
- Return item with linked themes (via FeedbackThemeLink)

**Function: `list(params)`**

- Build Prisma `where` clause from filters:
  - `search`: Use Prisma full-text search on `content` field OR `contains` with `mode: 'insensitive'`
  - `channel`: Exact match
  - `sourceId`: Exact match
  - `processed`: Check if `processedAt` is null or not null
  - `sentimentMin/Max`: Range filter on `sentiment`
  - `dateFrom/dateTo`: Range filter on `createdAt`
- Apply pagination: `skip: (page - 1) * pageSize`, `take: pageSize`
- Apply sorting: `orderBy: { [sortBy]: sortOrder }`
- Execute count query in parallel with data query (`Promise.all`)
- Return `PaginatedResponse<FeedbackItem>`

**Function: `delete(id)`**

- Verify item exists (throw NotFound if not)
- Delete associated FeedbackThemeLinks first
- Delete the FeedbackItem
- Return deleted item

**Function: `bulkDelete(ids)`**

- Delete FeedbackThemeLinks for all IDs
- Delete ProposalEvidence for all IDs
- Delete all FeedbackItems with `id in ids`
- Return count of deleted items

**Function: `getStats()`**

- Total feedback count
- Processed count (where processedAt is not null)
- Unprocessed count
- Group by channel with counts
- Average sentiment (where sentiment is not null)
- Average urgency (where urgency is not null)
- Return typed `FeedbackStats` object

**Function: `checkDuplicate(content, author, sourceId)`**

- Query for existing item with same content + author + sourceId
- Return boolean

**Function: `markAsProcessed(ids)`**

- Update all items with IDs: set `processedAt` to current timestamp
- Return count of updated items

### 3. Refactor routes to thin layer

```typescript
// packages/api/src/routes/feedback.ts
import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  createFeedbackSchema,
  feedbackQuerySchema,
  bulkDeleteSchema,
} from '../schemas/feedback.schema';
import { feedbackService } from '../services/feedback.service';

const router = Router();

router.post('/', validate(createFeedbackSchema), async (req, res, next) => {
  try {
    const item = await feedbackService.create(req.body);
    res.status(201).json({ data: item });
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(feedbackQuerySchema, 'query'), async (req, res, next) => {
  try {
    const result = await feedbackService.list(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const stats = await feedbackService.getStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await feedbackService.findById(req.params.id);
    res.json({ data: item });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await feedbackService.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-delete', validate(bulkDeleteSchema), async (req, res, next) => {
  try {
    const count = await feedbackService.bulkDelete(req.body.ids);
    res.json({ data: { deleted: count } });
  } catch (err) {
    next(err);
  }
});

export default router;
```

### 4. Handle async errors properly

Either:

- Install `express-async-errors` and import it at the top of index.ts (auto-catches async rejections), OR
- Wrap each route in try/catch as shown above

Prefer `express-async-errors` for less boilerplate.

## Acceptance Criteria

- [ ] `feedbackService.create()` creates an item and returns it with all fields
- [ ] `feedbackService.create()` rejects content shorter than 10 characters (Zod validation at route level)
- [ ] `feedbackService.create()` trims whitespace from content
- [ ] `feedbackService.findById()` returns item with source and theme links
- [ ] `feedbackService.findById()` throws NotFound for non-existent ID
- [ ] `feedbackService.list()` returns paginated results with correct total count
- [ ] `feedbackService.list()` supports search filtering (case-insensitive content search)
- [ ] `feedbackService.list()` supports channel, source, processed, sentiment, date filters
- [ ] `feedbackService.list()` supports sorting by createdAt, sentiment, urgency
- [ ] `feedbackService.delete()` removes item and associated links
- [ ] `feedbackService.bulkDelete()` removes multiple items in one operation
- [ ] `feedbackService.getStats()` returns correct aggregate numbers
- [ ] `feedbackService.checkDuplicate()` detects existing duplicates
- [ ] Routes are thin — no business logic in route handlers
- [ ] All Zod schemas validate input correctly with proper error messages

## Complexity Estimate

**L (Large)** — Core service with many functions. Establishes the service pattern for the entire project. Must handle edge cases like empty results, concurrent access, and proper error propagation.

## Risk Factors & Mitigations

| Risk                                          | Impact                                           | Mitigation                                                                                |
| --------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Full-text search not configured in PostgreSQL | Medium — search falls back to LIKE which is slow | Use `contains` with `mode: 'insensitive'` for V1; add pg_trgm index later for performance |
| Bulk delete cascading to unexpected relations | High — orphaned data                             | Delete in correct order (evidence → links → items); wrap in transaction                   |
| Pagination count query slow on large datasets | Medium — UI feels sluggish                       | Run count and data queries in `Promise.all`; add index on common filter columns           |
| Zod coercion of query params fails            | Medium — 400 errors on valid requests            | Test all query param combinations; use `z.coerce` for numeric params from query string    |
