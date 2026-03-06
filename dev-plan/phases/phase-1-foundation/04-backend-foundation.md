# 04 — Backend Foundation

## Objective

Build the complete backend architectural foundation: service layer pattern, error handling middleware, Zod validation middleware, rate limiting, Prisma singleton, Redis connection, OpenAI client singleton, BullMQ queue definitions, and logger. Every API feature in Phases 2-5 will build on these patterns.

## Dependencies

- 01-monorepo-tooling (ESLint, TypeScript config)
- 02-core-shared-package (shared types)
- 03-database-migrations (Prisma schema, database running)

## Files to Create

| File                                             | Purpose                                           |
| ------------------------------------------------ | ------------------------------------------------- |
| `packages/api/src/lib/prisma.ts`                 | Prisma client singleton                           |
| `packages/api/src/lib/redis.ts`                  | Redis connection singleton                        |
| `packages/api/src/lib/openai.ts`                 | OpenAI client singleton with retry config         |
| `packages/api/src/lib/queue.ts`                  | BullMQ queue definitions (embedding, synthesis)   |
| `packages/api/src/lib/logger.ts`                 | Structured logger (pino or console-based)         |
| `packages/api/src/lib/errors.ts`                 | AppError class + error codes                      |
| `packages/api/src/middleware/errorHandler.ts`    | Global error handler middleware                   |
| `packages/api/src/middleware/validate.ts`        | Zod validation middleware                         |
| `packages/api/src/middleware/rateLimit.ts`       | Rate limiting middleware (Redis-backed)           |
| `packages/api/src/middleware/requestLogger.ts`   | HTTP request logging middleware                   |
| `packages/api/src/services/feedback.service.ts`  | Feedback service (placeholder, built in Phase 2)  |
| `packages/api/src/services/synthesis.service.ts` | Synthesis service (placeholder, built in Phase 3) |
| `packages/api/src/services/proposal.service.ts`  | Proposal service (placeholder, built in Phase 4)  |
| `packages/api/src/services/spec.service.ts`      | Spec service (placeholder, built in Phase 5)      |
| `packages/api/src/services/ai.service.ts`        | AI service wrapping OpenAI calls                  |

## Files to Modify

| File                                | Changes                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `packages/api/src/index.ts`         | Register all middleware, import service singletons, graceful shutdown |
| `packages/api/src/routes/health.ts` | Use Prisma and Redis singletons for health checks                     |
| `packages/api/package.json`         | Add any missing dependencies (pino, express-rate-limit)               |

## Detailed Sub-Tasks

### 1. Create Prisma singleton (`packages/api/src/lib/prisma.ts`)

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- Hot-reload safe (stores on globalThis)
- Query logging in development only
- Error-only logging in production

### 2. Create Redis connection (`packages/api/src/lib/redis.ts`)

```typescript
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: false,
});

redis.on('error', (err) => {
  /* log error, don't crash */
});
redis.on('connect', () => {
  /* log connected */
});
```

- Exponential backoff retry strategy
- Error events logged but don't crash the process
- Lazy connect disabled — connects immediately

### 3. Create OpenAI client singleton (`packages/api/src/lib/openai.ts`)

```typescript
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set — AI features will be unavailable');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  maxRetries: 3,
  timeout: 60_000, // 60 second timeout
});

export const AI_CONFIG = {
  chatModel: process.env.AI_MODEL || 'gpt-4o-mini',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  embeddingDimensions: 1536,
  maxTokens: 4096,
} as const;
```

- Graceful degradation when API key not set
- Built-in retry with exponential backoff
- Centralized config for model names

### 4. Create BullMQ queue definitions (`packages/api/src/lib/queue.ts`)

```typescript
import { Queue } from 'bullmq';
import { redis } from './redis';

const defaultOpts = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 100 }, // keep last 100 or 1 hour
    removeOnFail: { age: 86400, count: 500 }, // keep failures for 24h
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
};

export const embeddingQueue = new Queue('embedding', defaultOpts);
export const synthesisQueue = new Queue('synthesis', defaultOpts);
export const importQueue = new Queue('import', defaultOpts);
```

- Three queues: embedding (vector generation), synthesis (clustering + themes), import (CSV processing)
- Auto-cleanup of completed jobs
- 3 retry attempts with exponential backoff

### 5. Create logger (`packages/api/src/lib/logger.ts`)

```typescript
// Simple structured logger — can be replaced with pino later
export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test')
      console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date().toISOString() }));
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test')
      console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: new Date().toISOString() }));
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() }));
  },
};
```

- JSON structured output for easy parsing
- Silent in test environment (except errors)
- Replaceable with pino if needed later

### 6. Create AppError class (`packages/api/src/lib/errors.ts`)

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Common error factories
export const NotFound = (resource: string) =>
  new AppError(404, `${resource} not found`, 'NOT_FOUND');
export const BadRequest = (msg: string, details?: Record<string, unknown>) =>
  new AppError(400, msg, 'BAD_REQUEST', details);
export const Unauthorized = (msg = 'Unauthorized') => new AppError(401, msg, 'UNAUTHORIZED');
export const Conflict = (msg: string) => new AppError(409, msg, 'CONFLICT');
export const TooLarge = (msg: string) => new AppError(413, msg, 'TOO_LARGE');
export const RateLimited = () => new AppError(429, 'Rate limit exceeded', 'RATE_LIMITED');
```

### 7. Create error handler middleware (`packages/api/src/middleware/errorHandler.ts`)

```typescript
import type { ErrorRequestHandler } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  // Prisma known errors
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Resource not found', code: 'NOT_FOUND' });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large', code: 'TOO_LARGE' });
  }

  // Unexpected errors
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
};
```

- Handles AppError with proper status codes
- Handles Prisma-specific errors
- Handles Multer file upload errors
- Never leaks stack traces in production

### 8. Create Zod validation middleware (`packages/api/src/middleware/validate.ts`)

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: result.error.flatten(),
      });
    }
    req[target] = result.data; // Replace with parsed data (coercion applied)
    next();
  };
}
```

- Supports validating body, query, or params
- Returns flattened Zod errors for clear client-side display
- Replaces req data with parsed result (applies defaults, coercion)

### 9. Create rate limit middleware (`packages/api/src/middleware/rateLimit.ts`)

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis';

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per window
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  message: { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
});

export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => (req.headers['x-api-key'] as string) || req.ip || 'unknown',
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  message: { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
});
```

- Redis-backed for distributed rate limiting
- General API limit: 100 req/min
- Webhook limit: 100 req/min per API key
- Standard headers for client visibility

### 10. Create request logger middleware (`packages/api/src/middleware/requestLogger.ts`)

```typescript
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });

  next();
}
```

### 11. Update Express app (`packages/api/src/index.ts`)

Restructure the main app entry to:

1. Import all middleware
2. Apply middleware in correct order: `requestLogger` → `helmet` → `cors` → `express.json()` → `apiRateLimit`
3. Register all route modules: `/api/health`, `/api/feedback`, `/api/synthesis`, `/api/proposals`, `/api/specs`
4. Apply error handler LAST (must be after routes)
5. Add graceful shutdown handler:

```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});
```

### 12. Create service placeholder files

Create minimal placeholder files for each service with exported function stubs. This establishes the pattern for Phase 2+ to fill in:

```typescript
// packages/api/src/services/feedback.service.ts
import { prisma } from '../lib/prisma';
import type { CreateFeedbackInput, FeedbackFilters, PaginationParams } from '@shipscope/core';

export const feedbackService = {
  // Will be implemented in Phase 2
};
```

Repeat for synthesis, proposal, spec, and ai services.

### 13. Update health check to use singletons

```typescript
// packages/api/src/routes/health.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const router = Router();

router.get('/', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redis.ping()]);

  res.json({
    status: dbOk.status === 'fulfilled' && redisOk.status === 'fulfilled' ? 'ok' : 'degraded',
    db: dbOk.status === 'fulfilled' ? 'connected' : 'disconnected',
    redis: redisOk.status === 'fulfilled' ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

## Acceptance Criteria

- [ ] Prisma singleton connects to PostgreSQL without error
- [ ] Redis singleton connects and responds to PING
- [ ] OpenAI client initializes (warns if no API key)
- [ ] All 3 BullMQ queues can be listed (`embeddingQueue.getJobCounts()`)
- [ ] `AppError` thrown in a route returns the correct HTTP status code and JSON body
- [ ] Zod validation middleware rejects invalid body and returns 400 with field errors
- [ ] Zod validation middleware passes valid body and replaces `req.body` with parsed data
- [ ] Rate limiter returns 429 after exceeding limit (verify with test)
- [ ] Request logger logs method, path, status code, and duration for every request
- [ ] `GET /api/health` returns `{ status: "ok", db: "connected", redis: "connected" }`
- [ ] Express graceful shutdown disconnects Prisma and Redis on SIGTERM
- [ ] All service placeholder files exist and are importable
- [ ] No `console.log` in production code (only logger)

## Complexity Estimate

**XL (Extra Large)** — This is the largest task in Phase 1. It establishes the patterns that every subsequent feature depends on. Must be done carefully and thoroughly.

## Risk Factors & Mitigations

| Risk                                                  | Impact                                       | Mitigation                                                                                     |
| ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Redis connection fails silently                       | High — queues and rate limiting break        | Add connection event handlers, health check includes Redis status                              |
| Rate limiter blocks legitimate requests in dev        | Medium — developer frustration               | Set high limits in development, use environment-based config                                   |
| Error handler doesn't catch async errors              | Critical — unhandled rejections crash server | Use `express-async-errors` package OR wrap all route handlers in try/catch; verify with test   |
| OpenAI client timeout causes request timeout          | Medium — user sees 502                       | Set explicit timeout (60s), return 503 to client if AI is unavailable                          |
| Middleware ordering bugs                              | High — CORS fails, body not parsed, etc.     | Follow exact ordering: logger → helmet → cors → bodyParser → rateLimit → routes → errorHandler |
| Graceful shutdown doesn't wait for in-flight requests | Medium — data loss on deploy                 | Use `server.close()` callback to wait for connections to drain                                 |
