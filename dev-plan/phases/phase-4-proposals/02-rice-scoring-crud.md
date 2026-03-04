# 02 — RICE Scoring, CRUD & Status Management

## Objective

Implement full CRUD operations for proposals with Zod-validated endpoints, a robust status workflow engine (proposed -> approved/rejected -> shipped), manual score editing with automatic RICE recalculation, and all API routes following the thin-handler pattern established in Phase 2. This task produces the complete REST API surface for proposals.

## Dependencies

- 01-proposal-generation (proposal.service.ts exists, Proposal model populated)
- Phase 2 patterns: validate middleware, error handler, service-layer architecture
- Phase 1: Prisma client, AppError class, shared types

## Files to Create

| File                                          | Purpose                                                    |
| --------------------------------------------- | ---------------------------------------------------------- |
| `packages/api/src/routes/proposals.ts`        | Express route handlers for all proposal endpoints          |
| `packages/api/src/schemas/proposal.schema.ts` | Zod validation schemas for request bodies and query params |

## Files to Modify

| File                                            | Changes                                                         |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `packages/api/src/services/proposal.service.ts` | Add CRUD methods, status transition logic, manual score editing |
| `packages/api/src/index.ts`                     | Register `/api/proposals` route                                 |
| `packages/core/src/types/proposal.ts`           | Add query/filter types if needed                                |

## Detailed Sub-Tasks

### 1. Create Zod validation schemas (`packages/api/src/schemas/proposal.schema.ts`)

Define strict schemas for every endpoint. All scores are integers 1-10. Status values are enumerated. Query parameters use coerced types for URL parsing.

```typescript
import { z } from 'zod';

// ─── Generate ────────────────────────────────────────────
export const generateProposalsSchema = z.object({
  topN: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── List Query ──────────────────────────────────────────
export const proposalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['proposed', 'approved', 'rejected', 'shipped']).optional(),
  themeId: z.string().cuid().optional(),
  sortBy: z
    .enum(['riceScore', 'createdAt', 'updatedAt', 'impactScore', 'effortScore'])
    .default('riceScore'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(200).optional(),
});

// ─── Update (PATCH) ─────────────────────────────────────
export const updateProposalSchema = z
  .object({
    title: z.string().min(3).max(150).optional(),
    problem: z.string().min(10).max(5000).optional(),
    solution: z.string().min(10).max(5000).optional(),
    description: z.string().min(10).max(5000).optional(),
    status: z.enum(['proposed', 'approved', 'rejected', 'shipped']).optional(),
    impactScore: z.coerce.number().int().min(1).max(10).optional(),
    effortScore: z.coerce.number().int().min(1).max(10).optional(),
    confidenceScore: z.coerce.number().int().min(1).max(10).optional(),
    reachScore: z.coerce.number().int().min(1).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// ─── ID Param ────────────────────────────────────────────
export const proposalIdSchema = z.object({
  id: z.string().cuid(),
});

export type GenerateProposalsInput = z.infer<typeof generateProposalsSchema>;
export type ProposalQueryInput = z.infer<typeof proposalQuerySchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
```

### 2. Add CRUD methods to proposal service (`packages/api/src/services/proposal.service.ts`)

Extend the service created in task 01 with list, findById, update, and delete operations.

**Function: `list(params: ProposalQueryInput)`**

```typescript
async list(params: ProposalQueryInput) {
  const { page, pageSize, status, themeId, sortBy, sortOrder, search } = params;

  const where: Prisma.ProposalWhereInput = {};

  if (status) where.status = status;
  if (themeId) where.themeId = themeId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { problem: { contains: search, mode: 'insensitive' } },
      { solution: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.proposal.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        theme: { select: { id: true, name: true, category: true } },
        _count: { select: { evidence: true } },
      },
    }),
    prisma.proposal.count({ where }),
  ]);

  return {
    data: data.map(p => ({
      ...p,
      evidenceCount: p._count.evidence,
      _count: undefined,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
},
```

**Function: `findById(id: string)`**

```typescript
async findById(id: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      theme: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          feedbackCount: true,
          avgSentiment: true,
          avgUrgency: true,
        },
      },
      evidence: {
        include: {
          feedback: {
            select: {
              id: true,
              content: true,
              author: true,
              channel: true,
              sentiment: true,
              urgency: true,
              createdAt: true,
            },
          },
        },
        orderBy: { relevance: 'desc' },
      },
    },
  });

  if (!proposal) {
    throw new AppError(404, 'Proposal not found');
  }

  return proposal;
},
```

**Function: `update(id: string, input: UpdateProposalInput)`**

This is the most nuanced method. It handles three distinct update paths:

1. **Status change** -- validate transition legality
2. **Score change** -- recalculate RICE automatically
3. **Text change** -- simple field update

```typescript
async update(id: string, input: UpdateProposalInput) {
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Proposal not found');
  }

  // ─── Status transition validation ───────────────────
  if (input.status) {
    validateStatusTransition(existing.status, input.status);
  }

  // ─── Build update data ─────────────────────────────
  const updateData: Prisma.ProposalUpdateInput = {};

  // Text fields
  if (input.title !== undefined) updateData.title = input.title;
  if (input.problem !== undefined) updateData.problem = input.problem;
  if (input.solution !== undefined) updateData.solution = input.solution;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.status !== undefined) updateData.status = input.status;

  // Score fields — if any score changes, recalculate RICE
  const scoreFields = ['impactScore', 'effortScore', 'confidenceScore', 'reachScore'] as const;
  let scoreChanged = false;

  for (const field of scoreFields) {
    if (input[field] !== undefined) {
      updateData[field] = input[field];
      scoreChanged = true;
    }
  }

  if (scoreChanged) {
    const reach = input.reachScore ?? existing.reachScore;
    const impact = input.impactScore ?? existing.impactScore;
    const confidence = input.confidenceScore ?? existing.confidenceScore;
    const effort = input.effortScore ?? existing.effortScore;

    // Only recalculate if all scores are present
    if (reach != null && impact != null && confidence != null && effort != null) {
      updateData.riceScore = calculateRICE(
        reach as number,
        impact as number,
        confidence as number,
        effort as number,
      );
    }
  }

  return prisma.proposal.update({
    where: { id },
    data: updateData,
    include: {
      theme: { select: { id: true, name: true, category: true } },
      _count: { select: { evidence: true } },
    },
  });
},
```

**Function: `delete(id: string)`**

```typescript
async delete(id: string) {
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Proposal not found');
  }

  // Cascade delete: evidence first, then proposal
  await prisma.$transaction([
    prisma.proposalEvidence.deleteMany({ where: { proposalId: id } }),
    prisma.spec.deleteMany({ where: { proposalId: id } }),
    prisma.proposal.delete({ where: { id } }),
  ]);

  return existing;
},
```

### 3. Implement status transition validation

Status transitions follow a strict directed graph. Invalid transitions are rejected with a 400 error.

```
  proposed ──> approved ──> shipped
     │
     └──────> rejected
```

Allowed transitions:

- `proposed` -> `approved`
- `proposed` -> `rejected`
- `approved` -> `shipped`
- `rejected` -> `proposed` (allow re-opening rejected proposals)

Disallowed transitions (examples):

- `shipped` -> anything (shipped is terminal)
- `approved` -> `rejected` (must ship or re-propose, not directly reject)
- `approved` -> `proposed` (no downgrade)

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  proposed: ['approved', 'rejected'],
  approved: ['shipped'],
  rejected: ['proposed'],
  shipped: [], // Terminal state
};

function validateStatusTransition(currentStatus: string, newStatus: string): void {
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed) {
    throw new AppError(400, `Unknown current status: ${currentStatus}`);
  }

  if (!allowed.includes(newStatus)) {
    throw new AppError(
      400,
      `Invalid status transition: "${currentStatus}" → "${newStatus}". Allowed transitions from "${currentStatus}": ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
    );
  }
}
```

### 4. Build route handlers (`packages/api/src/routes/proposals.ts`)

All routes are thin adapters. Business logic is in the service.

```typescript
import { Router } from 'express';
import { validate } from '../middleware/validate';
import {
  generateProposalsSchema,
  proposalQuerySchema,
  updateProposalSchema,
  proposalIdSchema,
} from '../schemas/proposal.schema';
import { proposalService } from '../services/proposal.service';

const router = Router();

// ─── Generate proposals from themes ─────────────────────
router.post('/generate', validate(generateProposalsSchema), async (req, res, next) => {
  try {
    const result = await proposalService.generateFromThemes(req.body.topN);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// ─── List proposals ─────────────────────────────────────
router.get('/', validate(proposalQuerySchema, 'query'), async (req, res, next) => {
  try {
    const result = await proposalService.list(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Get single proposal ───────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const proposal = await proposalService.findById(req.params.id);
    res.json({ data: proposal });
  } catch (err) {
    next(err);
  }
});

// ─── Update proposal (scores, status, text) ────────────
router.patch('/:id', validate(updateProposalSchema), async (req, res, next) => {
  try {
    const updated = await proposalService.update(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── Delete proposal ───────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    await proposalService.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

### 5. Register routes in application (`packages/api/src/index.ts`)

```typescript
import proposalRoutes from './routes/proposals';

// ... existing route registrations ...
app.use('/api/proposals', proposalRoutes);
```

### 6. Response format conventions

All endpoints follow the project-wide response format:

**Single resource:**

```json
{
  "data": { ... }
}
```

**List with pagination:**

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 47,
    "totalPages": 3
  }
}
```

**Error:**

```json
{
  "error": {
    "message": "Proposal not found",
    "code": "NOT_FOUND",
    "statusCode": 404
  }
}
```

### 7. RICE recalculation on manual score edit

When a user changes any individual score via the PATCH endpoint, the RICE score must be recalculated using the merged scores (new + existing). This is handled in the `update` method (sub-task 2).

Key behavior:

- If only `impactScore` is sent, the other three scores come from the existing record
- If the existing record has null scores (edge case), RICE is only calculated when all four are present
- RICE is stored as a Float, not rounded, to preserve ranking precision

Example flow:

```
PATCH /api/proposals/abc123
Body: { "effortScore": 3 }

Service:
  existing.reachScore = 8
  existing.impactScore = 7
  existing.confidenceScore = 6
  existing.effortScore = 5 → overridden to 3
  newRICE = (8 × 7 × 6) / 3 = 112.0

Response:
  { data: { ...proposal, effortScore: 3, riceScore: 112.0 } }
```

## Acceptance Criteria

- [ ] `POST /api/proposals/generate` triggers generation and returns `{ proposalsCreated, proposalsSkipped, errors }`
- [ ] `POST /api/proposals/generate` accepts optional `topN` body parameter (default 20, validated 1-100)
- [ ] `GET /api/proposals` returns paginated list with default sort by riceScore desc
- [ ] `GET /api/proposals?status=approved` filters by status
- [ ] `GET /api/proposals?search=export` searches title, problem, and solution fields
- [ ] `GET /api/proposals?sortBy=createdAt&sortOrder=asc` sorts by creation date ascending
- [ ] `GET /api/proposals` response includes `evidenceCount` for each proposal
- [ ] `GET /api/proposals` response includes linked theme name and category
- [ ] `GET /api/proposals/:id` returns full proposal with evidence array and theme detail
- [ ] `GET /api/proposals/:id` returns 404 for non-existent ID
- [ ] `PATCH /api/proposals/:id` updates text fields (title, problem, solution)
- [ ] `PATCH /api/proposals/:id` updates individual scores and recalculates riceScore
- [ ] `PATCH /api/proposals/:id` with `{ status: "approved" }` transitions from proposed to approved
- [ ] `PATCH /api/proposals/:id` with `{ status: "shipped" }` from proposed returns 400 (invalid transition)
- [ ] `PATCH /api/proposals/:id` with empty body returns 400 (at least one field required)
- [ ] `DELETE /api/proposals/:id` removes proposal and cascades to ProposalEvidence and Spec
- [ ] `DELETE /api/proposals/:id` returns 204 No Content on success
- [ ] `DELETE /api/proposals/:id` returns 404 for non-existent ID
- [ ] Status transitions enforced: proposed->approved, proposed->rejected, approved->shipped, rejected->proposed
- [ ] Invalid status transitions return 400 with descriptive error message
- [ ] All Zod schemas validate input with proper error messages
- [ ] Score values outside 1-10 are rejected by Zod validation

## Complexity Estimate

**L (Large)** -- Five endpoints with full validation, status transition state machine, RICE recalculation on partial score updates, cascading delete with transactions, pagination with multi-field filtering/sorting, and strict Zod schemas.

## Risk Factors & Mitigations

| Risk                                                             | Impact                            | Mitigation                                                                    |
| ---------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Status transition logic too restrictive (blocks valid workflows) | Medium -- user frustration        | Allow rejected->proposed re-opening; document all transitions in API docs     |
| RICE recalculation with null scores produces NaN                 | High -- corrupt data              | Only calculate when all 4 scores present; guard with null check               |
| Cascading delete misses Spec records                             | Medium -- orphaned specs          | Include Spec deleteMany in transaction; test cascade thoroughly               |
| Search on text fields slow without index                         | Low -- only noticeable at scale   | Use `contains` with `insensitive` mode for V1; add pg_trgm index if needed    |
| Concurrent PATCH requests cause stale RICE score                 | Low -- unlikely in single-user V1 | Read-then-write in single Prisma call; add optimistic locking later if needed |
| Zod coercion of query params fails for edge cases                | Medium -- 400 on valid requests   | Use `z.coerce` for all numeric query params; test with string inputs          |
