# 02 — Performance Optimization

## Objective

Optimize ShipScope to meet two hard performance targets: **< 2 second page load** (Lighthouse First Contentful Paint on a cold cache) and **< 500ms API response time** for all list endpoints with 1000 records. This involves frontend code splitting, bundle size reduction, database query tuning, API compression, and Redis caching for frequently-accessed data.

## Dependencies

- Phase 6: Complete (all features built, can be measured)
- Phase 1: Redis setup (caching infrastructure available)
- Phase 3: Prisma models and queries (database layer to optimize)

## Files to Create

| File                                              | Purpose                                         |
| ------------------------------------------------- | ----------------------------------------------- |
| `packages/api/src/middleware/compression.ts`      | Express compression middleware setup            |
| `packages/api/src/lib/cache.ts`                   | Redis caching utility with TTL and invalidation |
| `packages/web/src/components/LoadingFallback.tsx` | Suspense fallback component for lazy routes     |

## Files to Modify

| File                                            | Changes                                             |
| ----------------------------------------------- | --------------------------------------------------- |
| `packages/web/vite.config.ts`                   | Add bundle analyzer plugin, configure manual chunks |
| `packages/web/src/App.tsx`                      | Replace static imports with React.lazy() + Suspense |
| `packages/api/src/index.ts`                     | Add compression middleware                          |
| `packages/api/src/services/feedback.service.ts` | Optimize queries with select, pagination            |
| `packages/api/src/services/theme.service.ts`    | Add Redis caching for theme list                    |
| `packages/api/src/services/stats.service.ts`    | Cache dashboard stats in Redis                      |
| `packages/api/prisma/schema.prisma`             | Add database indexes for slow queries               |

## Detailed Sub-Tasks

### 1. Install performance dependencies

```bash
# Frontend: bundle analysis
npm install -D vite-plugin-visualizer --workspace=packages/web

# Backend: response compression
npm install compression --workspace=packages/api
npm install -D @types/compression --workspace=packages/api
```

### 2. Implement route-level code splitting with React.lazy()

Update `packages/web/src/App.tsx` to lazy-load all page components:

```typescript
import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingFallback } from './components/LoadingFallback';

// Route-level code splitting — each page is a separate chunk
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const ThemesPage = lazy(() => import('./pages/ThemesPage'));
const ProposalsPage = lazy(() => import('./pages/ProposalsPage'));
const SpecsPage = lazy(() => import('./pages/SpecsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export function App() {
  return (
    <AppLayout>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/themes" element={<ThemesPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/specs" element={<SpecsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}
```

**Important:** Each page component must use `export default` for `React.lazy()` to work. Verify that all page files have a default export.

### 3. Create loading fallback component

`packages/web/src/components/LoadingFallback.tsx`:

```typescript
export function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  );
}
```

**Why a custom spinner:** Avoids a layout shift when the chunk loads. The spinner is inline CSS (no external dependencies) so it renders instantly before any chunk arrives.

### 4. Configure Vite bundle analysis and manual chunking

Update `packages/web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'vite-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Generate bundle analysis report (only in analysis mode)
    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: 'dist/bundle-report.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',

    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks: split large libraries into separate cached chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'], // If used on dashboard
          'vendor-utils': ['axios', 'zod', 'date-fns'],
        },
      },
    },

    // Report compressed sizes in build output
    reportCompressedSize: true,

    // Warn if any chunk exceeds 250KB (gzipped)
    chunkSizeWarningLimit: 250,
  },
});
```

**Running bundle analysis:**

```bash
ANALYZE=true npm run build --workspace=packages/web
# Opens bundle-report.html showing every module's contribution to bundle size
```

**What to look for in the report:**

- Any single chunk > 200KB gzipped: consider splitting or finding a lighter alternative
- Duplicate dependencies included in multiple chunks: configure `manualChunks` to deduplicate
- Large icon libraries (e.g., all of lucide-react): switch to tree-shakeable named imports

### 5. Add API response compression middleware

`packages/api/src/middleware/compression.ts`:

```typescript
import compression from 'compression';
import type { Request, Response } from 'express';

/**
 * Compress all responses > 1KB.
 * Skip compression for:
 *   - Server-Sent Events (SSE) streams
 *   - Already-compressed responses (images, fonts)
 */
export const compressionMiddleware = compression({
  level: 6, // Balanced speed vs compression ratio
  threshold: 1024, // Only compress responses > 1KB
  filter: (req: Request, res: Response) => {
    // Don't compress SSE streams
    if (req.headers.accept === 'text/event-stream') {
      return false;
    }
    // Use compression's default filter for everything else
    return compression.filter(req, res);
  },
});
```

Register in `packages/api/src/index.ts` **before** routes:

```typescript
import { compressionMiddleware } from './middleware/compression';

// Apply compression early in the middleware chain
app.use(compressionMiddleware);
```

**Why level 6:** Gzip levels 1-9 trade speed for compression ratio. Level 6 is the sweet spot: ~90% of max compression at ~50% of max CPU cost. Level 9 gives only ~2% better compression at 3x CPU.

### 6. Database query optimization

#### 6a. Add missing indexes to Prisma schema

```prisma
model Feedback {
  // ... existing fields ...

  @@index([projectId, createdAt(sort: Desc)])  // List feedback by project, sorted by date
  @@index([projectId, sentiment])              // Filter by sentiment
  @@index([projectId, source])                 // Filter by source
  @@index([status])                            // Filter by processing status
}

model Theme {
  // ... existing fields ...

  @@index([projectId, createdAt(sort: Desc)])  // List themes by project, sorted by date
  @@index([projectId, feedbackCount(sort: Desc)])  // Sort by popularity
}

model Proposal {
  // ... existing fields ...

  @@index([projectId, riceScore(sort: Desc)])  // Sort proposals by RICE score
  @@index([projectId, status])                 // Filter by status
}
```

Generate and apply migration:

```bash
npx prisma migrate dev --name add_performance_indexes --schema=packages/api/prisma/schema.prisma
```

#### 6b. Audit slow queries with EXPLAIN ANALYZE

For every list endpoint, run the underlying query with `EXPLAIN ANALYZE` to verify index usage:

```sql
-- Example: Feedback list query (should use projectId + createdAt index)
EXPLAIN ANALYZE
SELECT id, content, source, sentiment, "createdAt"
FROM "Feedback"
WHERE "projectId" = 'test-project-id'
ORDER BY "createdAt" DESC
LIMIT 50 OFFSET 0;

-- Look for:
--   "Index Scan" or "Index Only Scan" (GOOD)
--   "Seq Scan" (BAD — missing index)
--   Execution time < 10ms for 1000 records (GOOD)
```

Run this for all list endpoints:

- `GET /api/feedback` (paginated, filterable)
- `GET /api/themes` (sorted by feedbackCount)
- `GET /api/proposals` (sorted by riceScore)
- `GET /api/specs` (by proposal)

#### 6c. Optimize Prisma select to avoid over-fetching

Before (fetches all columns including embeddings):

```typescript
const feedback = await prisma.feedback.findMany({
  where: { projectId },
  orderBy: { createdAt: 'desc' },
  take: limit,
  skip: offset,
});
```

After (select only needed fields, exclude large vector columns):

```typescript
const feedback = await prisma.feedback.findMany({
  where: { projectId },
  orderBy: { createdAt: 'desc' },
  take: limit,
  skip: offset,
  select: {
    id: true,
    content: true,
    source: true,
    sentiment: true,
    urgency: true,
    status: true,
    createdAt: true,
    // Explicitly EXCLUDE: embedding (1536 floats = ~6KB per row)
  },
});
```

**Impact:** Excluding the `embedding` vector field from list queries reduces response payload by ~6KB per row. For 50 rows, that is ~300KB saved per request.

#### 6d. Fix N+1 query patterns

Identify and fix any N+1 patterns where Prisma loads related records in a loop:

Before (N+1):

```typescript
const themes = await prisma.theme.findMany({ where: { projectId } });
for (const theme of themes) {
  theme.feedbackItems = await prisma.feedback.findMany({
    where: { themeId: theme.id },
  });
}
```

After (single query with includes):

```typescript
const themes = await prisma.theme.findMany({
  where: { projectId },
  include: {
    feedbackItems: {
      select: { id: true, content: true, sentiment: true },
      take: 5, // Only load top 5 feedback per theme for the list view
    },
    _count: { select: { feedbackItems: true } },
  },
});
```

### 7. Implement Redis caching layer

`packages/api/src/lib/cache.ts`:

```typescript
import { redis } from './redis';

interface CacheOptions {
  ttlSeconds: number; // Time-to-live in seconds
  prefix?: string; // Key namespace prefix
}

const DEFAULT_PREFIX = 'shipscope:cache';

/**
 * Generic cache-aside pattern implementation.
 * Checks Redis first; on miss, calls the loader function and caches the result.
 */
export async function cacheable<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  const fullKey = `${options.prefix || DEFAULT_PREFIX}:${key}`;

  // Try cache first
  const cached = await redis.get(fullKey);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  // Cache miss — load from source
  const data = await loader();

  // Store in cache (non-blocking — don't await)
  redis.set(fullKey, JSON.stringify(data), 'EX', options.ttlSeconds).catch((err) => {
    console.error('Cache write failed:', err);
  });

  return data;
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string, prefix?: string): Promise<void> {
  const fullKey = `${prefix || DEFAULT_PREFIX}:${key}`;
  await redis.del(fullKey);
}

/**
 * Invalidate all cache keys matching a pattern.
 * Use sparingly — SCAN is O(N) on the keyspace.
 */
export async function invalidateCachePattern(pattern: string, prefix?: string): Promise<void> {
  const fullPattern = `${prefix || DEFAULT_PREFIX}:${pattern}`;
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}
```

### 8. Apply caching to high-traffic endpoints

#### 8a. Cache dashboard stats (TTL: 60 seconds)

```typescript
// packages/api/src/services/stats.service.ts
import { cacheable, invalidateCachePattern } from '../lib/cache';

export async function getDashboardStats(projectId: string) {
  return cacheable(
    `stats:${projectId}`,
    async () => {
      const [feedbackCount, themeCount, proposalCount, recentFeedback] = await Promise.all([
        prisma.feedback.count({ where: { projectId } }),
        prisma.theme.count({ where: { projectId } }),
        prisma.proposal.count({ where: { projectId } }),
        prisma.feedback.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, content: true, sentiment: true, createdAt: true },
        }),
      ]);

      return { feedbackCount, themeCount, proposalCount, recentFeedback };
    },
    { ttlSeconds: 60 },
  );
}
```

**Why 60s TTL:** Dashboard stats are read-heavy but change only when new feedback is ingested or synthesis runs. A 60-second cache means at most a 1-minute delay in stat updates, which is acceptable for a dashboard view. The cache is invalidated when new feedback is created or synthesis completes.

#### 8b. Cache theme list (TTL: 120 seconds)

```typescript
// packages/api/src/services/theme.service.ts
import { cacheable, invalidateCache } from '../lib/cache';

export async function listThemes(projectId: string) {
  return cacheable(
    `themes:${projectId}`,
    async () => {
      return prisma.theme.findMany({
        where: { projectId },
        orderBy: { feedbackCount: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          feedbackCount: true,
          sentiment: true,
          createdAt: true,
        },
      });
    },
    { ttlSeconds: 120 },
  );
}
```

#### 8c. Invalidate cache on data mutations

Every service function that creates, updates, or deletes data must invalidate relevant caches:

```typescript
// After creating new feedback:
await invalidateCachePattern('stats:*');

// After running synthesis:
await invalidateCachePattern('themes:*');
await invalidateCachePattern('stats:*');

// After updating a proposal:
await invalidateCache(`proposals:${projectId}`);
await invalidateCachePattern('stats:*');
```

### 9. Frontend asset optimization

#### 9a. Configure Vite asset pipeline

Vite already handles most asset optimization by default. Verify these settings in `vite.config.ts`:

```typescript
build: {
  // Inline assets smaller than 4KB as base64
  assetsInlineLimit: 4096,

  // Use content-hash filenames for cache busting
  // (Vite does this by default, but verify)
  rollupOptions: {
    output: {
      assetFileNames: 'assets/[name]-[hash][extname]',
      chunkFileNames: 'assets/[name]-[hash].js',
      entryFileNames: 'assets/[name]-[hash].js',
    },
  },
}
```

#### 9b. Font optimization

If using Google Fonts or custom fonts:

```html
<!-- In packages/web/index.html -->
<!-- Preconnect to font origin -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

<!-- Load only the weights actually used (400, 500, 600, 700) -->
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

If using self-hosted fonts, subset with `unicode-range`:

```css
@font-face {
  font-family: 'Inter';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-400.woff2') format('woff2');
  unicode-range:
    U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
    U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

### 10. Performance measurement and verification

#### 10a. Lighthouse audit

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run against production build
lighthouse http://localhost:3000 --output=json --output=html --output-path=./perf-report

# Key metrics to verify:
#   First Contentful Paint (FCP): < 1.5s
#   Largest Contentful Paint (LCP): < 2.0s
#   Total Blocking Time (TBT): < 200ms
#   Cumulative Layout Shift (CLS): < 0.1
```

#### 10b. API response time benchmarking

```bash
# Seed database with 1000 feedback items first
npm run db:seed --workspace=packages/api

# Benchmark list endpoints (using curl with timing)
curl -o /dev/null -s -w "Total: %{time_total}s\n" http://localhost:4000/api/feedback?limit=50
curl -o /dev/null -s -w "Total: %{time_total}s\n" http://localhost:4000/api/themes
curl -o /dev/null -s -w "Total: %{time_total}s\n" http://localhost:4000/api/proposals

# All should be < 500ms. If any exceed target:
# 1. Check EXPLAIN ANALYZE for the query
# 2. Verify index is being used
# 3. Check if Redis cache is hitting (second request should be < 50ms)
```

#### 10c. Bundle size verification

```bash
# Build and check output sizes
npm run build --workspace=packages/web

# Check individual chunk sizes
ls -lah packages/web/dist/assets/*.js

# Target:
#   Main entry chunk: < 50KB gzipped
#   Vendor-react chunk: < 50KB gzipped
#   Each page chunk: < 30KB gzipped
#   Total JavaScript: < 200KB gzipped
```

## Acceptance Criteria

- [ ] All 6 pages use `React.lazy()` + `Suspense` (no static page imports in App.tsx)
- [ ] `LoadingFallback` component renders a spinner during chunk loading
- [ ] Bundle analysis report generated with `ANALYZE=true npm run build`
- [ ] Vendor libraries split into separate chunks (react, tanstack-query, utils)
- [ ] No single JavaScript chunk exceeds 250KB (pre-gzip)
- [ ] API responses are gzip-compressed (verified via `Content-Encoding: gzip` header)
- [ ] Compression middleware skips responses under 1KB and SSE streams
- [ ] All list queries use `select` to exclude embedding vectors
- [ ] No N+1 query patterns in any service (verified by Prisma query logging)
- [ ] Database indexes added for all sort/filter columns used by list endpoints
- [ ] `EXPLAIN ANALYZE` confirms index usage on all list queries
- [ ] Redis caching active for dashboard stats (60s TTL) and theme list (120s TTL)
- [ ] Cache invalidation fires on all relevant data mutations
- [ ] Lighthouse Performance score >= 80 on Dashboard page
- [ ] First Contentful Paint < 1.5s (Lighthouse)
- [ ] All list API endpoints respond in < 500ms with 1000 records in database
- [ ] Second request to cached endpoints responds in < 50ms (Redis hit)

## Complexity Estimate

**L (Large)** — Spans both frontend and backend. Code splitting requires restructuring imports and verifying every page has a default export. Database optimization requires profiling real queries with representative data. Redis caching requires careful invalidation logic to avoid stale data. Each optimization must be measured before and after to prove impact.

## Risk Factors & Mitigations

| Risk                                                      | Impact                                                | Mitigation                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| React.lazy() breaks named exports                         | High — page renders blank                             | Audit all page files for `export default`; add ESLint rule to enforce default exports on pages                            |
| manualChunks creates circular dependency splits           | Medium — build fails or chunks load in wrong order    | Test with `npm run build` after every manualChunks change; use Rollup's `experimentalMinChunkSize` if needed              |
| Redis cache serves stale data after mutations             | Medium — users see outdated stats/themes              | Every mutation service function has corresponding `invalidateCache` call; integration test verifies invalidation          |
| EXPLAIN ANALYZE shows different plan in production vs dev | Low — index not used with different data distribution | Run EXPLAIN with representative data volume (1000+ rows); use `SET enable_seqscan = off` to force index usage for testing |
| Compression CPU overhead on high-traffic endpoints        | Low — response time increases instead of decreasing   | Level 6 is balanced; monitor CPU during load test; disable compression for small payloads (< 1KB threshold)               |
| Font subsetting excludes needed characters                | Low — text renders with fallback font                 | Use `unicode-range` for latin subset only; fallback to `system-ui` in font stack                                          |
| Bundle size regression from new dependencies              | Medium — total JS exceeds 200KB target                | Add `chunkSizeWarningLimit: 250` to Vite config; CI check for bundle size in future                                       |
