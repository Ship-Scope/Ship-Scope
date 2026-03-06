# 03 — Manual Entry & Webhook API

## Objective

Implement the manual feedback entry endpoint (single item creation via form) and the webhook API endpoint (external systems pushing feedback in real-time with API key authentication and rate limiting).

## Dependencies

- 01-feedback-service (service layer for creating items)
- Phase 1: Rate limiting middleware, error handling, Zod validation

## Files to Create

| File                                           | Purpose                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| `packages/api/src/services/webhook.service.ts` | Webhook authentication, API key management            |
| `packages/api/src/schemas/webhook.schema.ts`   | Zod schemas for webhook payloads                      |
| `packages/api/src/routes/webhook.ts`           | Webhook route handler (separate from feedback routes) |

## Files to Modify

| File                                  | Changes                                     |
| ------------------------------------- | ------------------------------------------- |
| `packages/api/src/routes/feedback.ts` | Ensure POST / handles manual entry cleanly  |
| `packages/api/src/index.ts`           | Register webhook routes                     |
| `packages/api/prisma/schema.prisma`   | Add ApiKey model for webhook authentication |

## Detailed Sub-Tasks

### 1. Add ApiKey model to Prisma schema

```prisma
model ApiKey {
  id          String   @id @default(cuid())
  name        String   @default("Default")
  keyHash     String   @unique        // SHA-256 hash of the API key
  keyPrefix   String                   // First 8 chars for identification (e.g., "sk_live_abc...")
  lastUsedAt  DateTime?
  createdAt   DateTime @default(now())
  isActive    Boolean  @default(true)

  @@index([keyHash])
}
```

Run migration: `npx prisma migrate dev --name add-api-keys`

### 2. Build webhook service (`packages/api/src/services/webhook.service.ts`)

**Function: `generateApiKey()`**

- Generate 32-byte random key: `sk_live_` + crypto.randomBytes(32).toString('hex')
- Hash it: `SHA-256(key)` → store hash in database
- Store prefix: first 12 characters of the full key
- Return the full key to the user (only shown once)
- Store the hash and prefix in ApiKey model

**Function: `validateApiKey(key: string)`**

- Hash the provided key
- Look up by keyHash in database
- If found and isActive: update `lastUsedAt`, return true
- If not found or inactive: return false

**Function: `revokeApiKey(id: string)`**

- Set `isActive = false`
- Return updated record

**Function: `listApiKeys()`**

- Return all keys with: id, name, keyPrefix, lastUsedAt, createdAt, isActive
- NEVER return the full key or hash

### 3. Create webhook Zod schemas (`packages/api/src/schemas/webhook.schema.ts`)

```typescript
const webhookItemSchema = z.object({
  content: z.string().min(10).max(10000),
  author: z.string().max(200).optional(),
  email: z.string().email().optional(),
  channel: z
    .enum(['support_ticket', 'interview', 'survey', 'slack', 'app_review', 'manual', 'other'])
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const webhookPayloadSchema = z.union([
  webhookItemSchema, // Single item
  z.array(webhookItemSchema).min(1).max(100), // Array of items (max 100 per request)
]);
```

### 4. Build webhook route (`packages/api/src/routes/webhook.ts`)

```typescript
import { Router } from 'express';
import { webhookRateLimit } from '../middleware/rateLimit';
import { webhookService } from '../services/webhook.service';
import { feedbackService } from '../services/feedback.service';

const router = Router();

// Middleware: authenticate via X-API-Key header
async function authenticateWebhook(req, res, next) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) return res.status(401).json({ error: 'Missing X-API-Key header' });

  const valid = await webhookService.validateApiKey(apiKey);
  if (!valid) return res.status(401).json({ error: 'Invalid API key' });

  next();
}

// POST /api/feedback/webhook — Receive feedback from external systems
router.post(
  '/',
  webhookRateLimit,
  authenticateWebhook,
  validate(webhookPayloadSchema),
  async (req, res, next) => {
    try {
      const items = Array.isArray(req.body) ? req.body : [req.body];

      // Create source for this webhook batch
      const source = await prisma.feedbackSource.create({
        data: { name: 'Webhook', type: 'webhook', rowCount: items.length, metadata: {} },
      });

      const results = [];
      for (const item of items) {
        const created = await feedbackService.create({
          ...item,
          sourceId: source.id,
        });
        results.push(created.id);
      }

      res.status(201).json({ data: { ids: results, count: results.length } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
```

### 5. Ensure manual entry route is clean

The existing `POST /api/feedback` handles manual entry. Verify it:

- Creates a shared "Manual Entry" FeedbackSource (findOrCreate pattern)
- Validates all fields via Zod
- Returns 201 with created item
- Form clears on frontend after success (handled in UI layer)

### 6. Register webhook routes in app

```typescript
// packages/api/src/index.ts
import webhookRoutes from './routes/webhook';
app.use('/api/feedback/webhook', webhookRoutes);
```

### 7. Add webhook management to settings routes (prepare for Phase 6)

Create a basic settings route that exposes:

- `POST /api/settings/api-keys` — Generate new API key
- `GET /api/settings/api-keys` — List API keys (prefix only)
- `DELETE /api/settings/api-keys/:id` — Revoke API key

## Acceptance Criteria

- [ ] POST /api/feedback creates a single item from manual entry (201 response)
- [ ] POST /api/feedback validates: content min 10 chars, email format, channel enum
- [ ] POST /api/feedback/webhook accepts single item with valid API key → 201
- [ ] POST /api/feedback/webhook accepts array of items (up to 100) → 201
- [ ] POST /api/feedback/webhook without X-API-Key header → 401
- [ ] POST /api/feedback/webhook with invalid API key → 401
- [ ] POST /api/feedback/webhook exceeding rate limit → 429
- [ ] API key generation returns full key exactly once (never stored in plaintext)
- [ ] API key stored as SHA-256 hash in database
- [ ] API key validation checks hash match and isActive flag
- [ ] API key revocation prevents further webhook usage
- [ ] Rate limiting is per API key (not per IP)
- [ ] Webhook creates a FeedbackSource record per batch

## Complexity Estimate

**M (Medium)** — Webhook is straightforward HTTP endpoint with auth. API key management is the most nuanced part (hashing, prefix display, revocation).

## Risk Factors & Mitigations

| Risk                                                    | Impact                                 | Mitigation                                                                                |
| ------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| API key leaked in logs or responses                     | Critical — unauthorized access         | Never log full key, only prefix. Return full key only on generation. Hash before storage. |
| Rate limiter key collision between webhook consumers    | Medium — one consumer blocks another   | Key rate limiter on X-API-Key header value, not IP                                        |
| Webhook payload too large (100 items × 10KB each = 1MB) | Low — Express default limit handles it | Set `express.json({ limit: '5mb' })` for webhook routes                                   |
| API key timing attack on validation                     | Low — but possible                     | Use `crypto.timingSafeEqual` for hash comparison                                          |
| Webhook source records accumulate                       | Low — one per batch                    | Add periodic cleanup job or aggregate small batches                                       |
