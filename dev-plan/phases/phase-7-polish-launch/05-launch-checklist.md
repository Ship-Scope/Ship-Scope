# 05 — Launch Checklist

## Objective

Execute the final launch gate: a systematic checklist that verifies every feature works end-to-end on a fresh database, demo data produces meaningful AI outputs, the README is polished with screenshots, the GitHub repository is configured for public release, error monitoring is functional, backup procedures work, performance baselines are documented, and AGPL-3.0 compliance is verified. Nothing ships until every item on this list is checked.

## Dependencies

- Phase 7, Task 01: Production Docker (deployable containers)
- Phase 7, Task 02: Performance Optimization (performance targets met)
- Phase 7, Task 03: Security Audit (security hardening complete)
- Phase 7, Task 04: Documentation (all docs written)

## Files to Create

| File                                        | Purpose                               |
| ------------------------------------------- | ------------------------------------- |
| `scripts/backup.sh`                         | Automated PostgreSQL backup script    |
| `scripts/healthcheck.sh`                    | Production health verification script |
| `.github/ISSUE_TEMPLATE/bug_report.md`      | GitHub bug report template            |
| `.github/ISSUE_TEMPLATE/feature_request.md` | GitHub feature request template       |
| `.github/pull_request_template.md`          | GitHub PR template                    |
| `BENCHMARKS.md`                             | Documented performance baselines      |

## Files to Modify

| File                             | Changes                                          |
| -------------------------------- | ------------------------------------------------ |
| `README.md`                      | Add screenshots/GIFs, badges, final polish       |
| `packages/api/src/lib/logger.ts` | Ensure structured JSON logging for production    |
| `packages/api/prisma/seed.ts`    | Verify seed data produces good synthesis results |
| `package.json`                   | Add backup and healthcheck scripts               |

## Detailed Sub-Tasks

### 1. Final QA pass — every feature end-to-end on a fresh database

Perform a complete walkthrough on a freshly built Docker environment with an empty database. This catches issues that only appear on first run (missing migrations, empty states, seed data assumptions).

**QA Script (execute in order):**

```bash
# 1. Clean start
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 2. Wait for all services to be healthy
echo "Waiting for services..."
sleep 30
docker compose -f docker-compose.prod.yml ps
# Verify: all 4 services show "healthy"

# 3. API health
curl -s http://localhost:4000/api/health | jq .
# Verify: status "ok", db "connected", redis "connected"

# 4. Web loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Verify: 200

# 5. Empty state renders (no crash on zero data)
# Open browser to each route and verify no console errors:
#   http://localhost:3000/           (Dashboard — empty state)
#   http://localhost:3000/feedback   (Feedback — "No feedback yet" message)
#   http://localhost:3000/themes     (Themes — empty state)
#   http://localhost:3000/proposals  (Proposals — empty state)
#   http://localhost:3000/specs      (Specs — empty state)
#   http://localhost:3000/settings   (Settings — default config)

# 6. Manual feedback creation
curl -X POST http://localhost:4000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"content": "The onboarding flow is really confusing", "source": "manual"}'
# Verify: 201 with id

# 7. CSV import
curl -X POST http://localhost:4000/api/feedback/import \
  -F "file=@test-data/sample-feedback.csv" \
  -F "source=csv"
# Verify: 200 with imported count > 0

# 8. Feedback list
curl -s http://localhost:4000/api/feedback | jq '.total'
# Verify: count matches imported + manual

# 9. Run synthesis
curl -X POST http://localhost:4000/api/synthesis/run \
  -H "Content-Type: application/json" \
  -d '{"projectId": "default"}'
# Verify: 202 with jobId

# 10. Wait for synthesis to complete
sleep 60
curl -s http://localhost:4000/api/synthesis/status/<jobId> | jq .
# Verify: status "completed"

# 11. Themes generated
curl -s http://localhost:4000/api/themes | jq '.total'
# Verify: >= 3 themes

# 12. Proposals generated
curl -s http://localhost:4000/api/proposals | jq '.total'
# Verify: >= 2 proposals

# 13. Settings page
curl -s http://localhost:4000/api/settings | jq .
# Verify: returns settings object

# 14. API key generation
curl -X POST http://localhost:4000/api/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name": "test-key"}'
# Verify: returns key starting with sk_live_

# 15. Webhook with API key
curl -X POST http://localhost:4000/api/webhook/feedback \
  -H "X-API-Key: <key-from-step-14>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Webhook test feedback", "source": "webhook"}'
# Verify: 201

# 16. Browser console check
# Open DevTools on every page — ZERO console errors allowed
```

**Every step above must pass.** If any step fails, fix the issue and restart the QA pass from the beginning.

### 2. Demo data verification

Verify that the seed data produces meaningful AI synthesis output:

```bash
# Seed the database
docker compose -f docker-compose.prod.yml exec api \
  npx prisma db seed --schema=packages/api/prisma/schema.prisma

# Run synthesis on seed data
curl -X POST http://localhost:4000/api/synthesis/run \
  -H "Content-Type: application/json" \
  -d '{"projectId": "default"}'

# Wait for completion, then verify:
```

**Verification criteria for seed data synthesis:**

| Check                           | Minimum           | Why                                         |
| ------------------------------- | ----------------- | ------------------------------------------- |
| Themes generated                | >= 3              | Proves clustering and theme extraction work |
| Proposals generated             | >= 2              | Proves proposal generation works            |
| Theme titles are human-readable | Manual check      | Not just "Cluster 1", "Cluster 2"           |
| Proposals have RICE scores > 0  | All proposals     | Scoring pipeline is functioning             |
| Evidence links exist            | >= 1 per proposal | Linking pipeline works                      |
| Sentiment distribution is mixed | Not all "neutral" | Sentiment analysis is functioning           |

If seed data produces poor themes (too vague, too many, duplicate), adjust the seed data in `packages/api/prisma/seed.ts` to include more varied and realistic feedback content. The seed data should represent a realistic product with at least 3 distinct problem areas.

### 3. README with screenshots/GIFs

Capture screenshots of key workflows in the production build:

**Screenshots to capture:**

| Screenshot         | Page          | State                           | Filename                             |
| ------------------ | ------------- | ------------------------------- | ------------------------------------ |
| Dashboard overview | `/`           | With seed data populated        | `docs/screenshots/dashboard.png`     |
| Feedback list      | `/feedback`   | With 50+ items, filters visible | `docs/screenshots/feedback-list.png` |
| Theme detail       | `/themes/:id` | Showing linked feedback         | `docs/screenshots/theme-detail.png`  |
| Proposals ranked   | `/proposals`  | Sorted by RICE score            | `docs/screenshots/proposals.png`     |
| Import modal       | `/feedback`   | Import modal open               | `docs/screenshots/import-modal.png`  |

**Capture process:**

```bash
# 1. Start production environment with seed data
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml exec api npx prisma db seed

# 2. Open browser to each page at 1280x800 viewport
# 3. Capture using browser DevTools > Device Toggle > Screenshot
# 4. Save to docs/screenshots/ (create directory)
# 5. Optimize file size: each screenshot should be < 500KB
```

Compress screenshots:

```bash
# Using sips on macOS
mkdir -p docs/screenshots
for f in docs/screenshots/*.png; do
  sips -Z 1280 "$f" --out "$f"
done
```

Add to README.md:

```markdown
## Screenshots

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="ShipScope Dashboard" width="800" />
</p>

<details>
<summary>More screenshots</summary>

|                  Feedback List                  |                 Theme Detail                 |
| :---------------------------------------------: | :------------------------------------------: |
| ![Feedback](docs/screenshots/feedback-list.png) | ![Themes](docs/screenshots/theme-detail.png) |

|                  Proposals                   |                 Import Modal                 |
| :------------------------------------------: | :------------------------------------------: |
| ![Proposals](docs/screenshots/proposals.png) | ![Import](docs/screenshots/import-modal.png) |

</details>
```

### 4. GitHub repository setup

#### 4a. Bug report template (`.github/ISSUE_TEMPLATE/bug_report.md`)

```markdown
---
name: Bug Report
about: Report a bug in ShipScope
title: '[Bug] '
labels: bug
assignees: ''
---

## Description

A clear description of the bug.

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior

What should have happened.

## Actual Behavior

What actually happened.

## Environment

- ShipScope version: [e.g., v1.0.0]
- Deployment: [Docker / Development]
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS 14, Ubuntu 22.04]

## Screenshots

If applicable, add screenshots.

## Logs
```

Paste relevant logs from `docker compose logs api`

```

```

#### 4b. Feature request template (`.github/ISSUE_TEMPLATE/feature_request.md`)

```markdown
---
name: Feature Request
about: Suggest a feature for ShipScope
title: '[Feature] '
labels: enhancement
assignees: ''
---

## Problem

What problem does this feature solve?

## Proposed Solution

Describe the feature you'd like.

## Alternatives Considered

Any alternative solutions you've considered.

## Additional Context

Any other context, mockups, or references.
```

#### 4c. Pull request template (`.github/pull_request_template.md`)

```markdown
## Summary

Brief description of changes.

## Type

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation
- [ ] Other: \_\_\_

## Changes

- Change 1
- Change 2

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] No `console.log` in committed code
- [ ] Documentation updated (if applicable)
```

#### 4d. GitHub repository configuration

Execute via GitHub CLI or web UI:

```bash
# Create labels
gh label create "priority:critical" --color "B60205" --description "Must fix immediately"
gh label create "priority:high" --color "D93F0B" --description "Fix before next release"
gh label create "priority:medium" --color "FBCA04" --description "Fix when possible"
gh label create "priority:low" --color "0E8A16" --description "Nice to have"
gh label create "area:api" --color "1D76DB" --description "Backend / API"
gh label create "area:web" --color "5319E7" --description "Frontend / Web"
gh label create "area:ai" --color "F9D0C4" --description "AI / ML pipeline"
gh label create "area:infra" --color "C5DEF5" --description "Infrastructure / Docker"
gh label create "good first issue" --color "7057FF" --description "Good for newcomers"

# Branch protection (main)
gh api repos/{owner}/{repo}/branches/main/protection -X PUT \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "typecheck", "test", "build"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF
```

### 5. Error monitoring — structured JSON logging

Update `packages/api/src/lib/logger.ts` to output structured JSON in production:

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  correlationId?: string;
  duration?: number;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'shipscope-api',
    ...meta,
  };

  if (process.env.NODE_ENV === 'production') {
    // Structured JSON for production (parseable by log aggregators)
    return JSON.stringify(entry);
  }

  // Human-readable for development
  const prefix = `[${entry.timestamp}] ${level.toUpperCase().padEnd(5)}`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('debug')) console.debug(formatEntry('debug', message, meta));
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('info')) console.info(formatEntry('info', message, meta));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('warn')) console.warn(formatEntry('warn', message, meta));
  },
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
    if (shouldLog('error')) {
      const errorMeta = error
        ? {
            error: {
              message: error.message,
              code: (error as any).code,
              // Include stack in development, omit in production
              ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
            },
            ...meta,
          }
        : meta;
      console.error(formatEntry('error', message, errorMeta));
    }
  },
};
```

**Production log output example:**

```json
{"level":"info","message":"Server started","timestamp":"2024-01-15T10:00:00.000Z","service":"shipscope-api","port":4000}
{"level":"info","message":"Request completed","timestamp":"2024-01-15T10:00:01.000Z","service":"shipscope-api","method":"GET","path":"/api/feedback","statusCode":200,"duration":45}
{"level":"error","message":"Synthesis failed","timestamp":"2024-01-15T10:00:02.000Z","service":"shipscope-api","error":{"message":"OpenAI rate limit exceeded","code":"RATE_LIMIT"}}
```

### 6. Backup strategy

#### 6a. Create backup script (`scripts/backup.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ShipScope Database Backup Script
# Usage: ./scripts/backup.sh [backup-dir]
# ============================================================

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/shipscope_${TIMESTAMP}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup..."

# Dump database and compress
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-shipscope}" "${POSTGRES_DB:-shipscope}" \
  --format=custom \
  --compress=9 \
  > "$BACKUP_FILE"

# Verify backup file is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file is empty!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Retain only the last 30 backups
cd "$BACKUP_DIR"
ls -t shipscope_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm
echo "Old backups pruned (keeping last 30)"
```

Make executable:

```bash
chmod +x scripts/backup.sh
```

#### 6b. Add data export endpoint

Add a lightweight JSON export endpoint for non-Docker backup scenarios:

```typescript
// packages/api/src/routes/export.ts
router.get('/export', async (_req, res) => {
  const [feedback, themes, proposals] = await Promise.all([
    prisma.feedback.findMany({
      select: { id: true, content: true, source: true, sentiment: true, createdAt: true },
    }),
    prisma.theme.findMany({
      select: { id: true, title: true, description: true, feedbackCount: true },
    }),
    prisma.proposal.findMany({
      select: { id: true, title: true, description: true, riceScore: true, status: true },
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: { feedback, themes, proposals },
  };

  res.setHeader('Content-Disposition', `attachment; filename=shipscope-export-${Date.now()}.json`);
  res.json(exportData);
});
```

### 7. Performance benchmarks documentation

Create `BENCHMARKS.md` documenting baseline metrics:

```markdown
# ShipScope Performance Benchmarks

Baseline metrics captured on [DATE] with [HARDWARE SPECS].

## Environment

- Docker Desktop [VERSION]
- Host: [CPU, RAM]
- Database: PostgreSQL 16, 1000 feedback items seeded
- Node.js 20

## Frontend Metrics (Lighthouse, Chrome, Desktop)

| Metric                   | Score/Value | Target  |
| ------------------------ | ----------- | ------- |
| Performance Score        | [XX]/100    | >= 80   |
| First Contentful Paint   | [X.X]s      | < 1.5s  |
| Largest Contentful Paint | [X.X]s      | < 2.0s  |
| Total Blocking Time      | [XXX]ms     | < 200ms |
| Cumulative Layout Shift  | [X.XX]      | < 0.1   |
| Speed Index              | [X.X]s      | < 2.5s  |

## Bundle Size

| Chunk           | Size (gzip) | Target      |
| --------------- | ----------- | ----------- |
| Entry (main)    | [XX]KB      | < 50KB      |
| vendor-react    | [XX]KB      | < 50KB      |
| vendor-query    | [XX]KB      | < 20KB      |
| vendor-utils    | [XX]KB      | < 20KB      |
| Page: Dashboard | [XX]KB      | < 30KB      |
| Page: Feedback  | [XX]KB      | < 30KB      |
| **Total JS**    | **[XXX]KB** | **< 200KB** |

## API Response Times (1000 feedback items, cold cache)

| Endpoint                            | P50    | P95    | Target  |
| ----------------------------------- | ------ | ------ | ------- |
| GET /api/health                     | [X]ms  | [X]ms  | < 50ms  |
| GET /api/feedback?limit=50          | [XX]ms | [XX]ms | < 500ms |
| GET /api/themes                     | [XX]ms | [XX]ms | < 500ms |
| GET /api/proposals                  | [XX]ms | [XX]ms | < 500ms |
| GET /api/feedback?limit=50 (cached) | [X]ms  | [X]ms  | < 50ms  |
| POST /api/feedback                  | [XX]ms | [XX]ms | < 200ms |

## Docker Image Sizes

| Image         | Size    | Target  |
| ------------- | ------- | ------- |
| shipscope-api | [XXX]MB | < 200MB |
| shipscope-web | [XX]MB  | < 30MB  |

## Database

| Query                     | Execution Time | Index Used                   |
| ------------------------- | -------------- | ---------------------------- |
| Feedback list (paginated) | [X]ms          | Yes: projectId_createdAt     |
| Themes by feedbackCount   | [X]ms          | Yes: projectId_feedbackCount |
| Proposals by riceScore    | [X]ms          | Yes: projectId_riceScore     |
```

**How to fill in benchmarks:**

```bash
# Lighthouse
lighthouse http://localhost:3000 --output=json | jq '.audits | {fcp: .["first-contentful-paint"].numericValue, lcp: .["largest-contentful-paint"].numericValue, tbt: .["total-blocking-time"].numericValue, cls: .["cumulative-layout-shift"].numericValue}'

# Bundle sizes
npm run build --workspace=packages/web 2>&1 | tail -20

# API response times (10 iterations, take P50 and P95)
for i in {1..10}; do
  curl -o /dev/null -s -w "%{time_total}\n" http://localhost:4000/api/feedback?limit=50
done | sort -n

# Docker image sizes
docker images --format "{{.Repository}}\t{{.Size}}" | grep shipscope

# Database query times
docker compose exec postgres psql -U shipscope -c "EXPLAIN ANALYZE SELECT id, content FROM \"Feedback\" WHERE \"projectId\" = 'default' ORDER BY \"createdAt\" DESC LIMIT 50;"
```

### 8. License verification — AGPL-3.0 compliance

```bash
# Verify LICENSE file exists and contains AGPL-3.0
head -1 LICENSE
# Should contain: "GNU AFFERO GENERAL PUBLIC LICENSE"

# Verify package.json references the license
grep '"license"' package.json
# Should contain: "AGPL-3.0"

# Verify no MIT/Apache-licensed dependencies conflict with AGPL
npx license-checker --summary
# Review: all dependencies must be compatible with AGPL-3.0
# Compatible: MIT, BSD-2, BSD-3, ISC, Apache-2.0, Unlicense
# Incompatible: GPL-2.0-only (without "or later"), proprietary

# Verify license header recommendation in CONTRIBUTING.md
# (AGPL-3.0 does not require per-file headers, but it is best practice)
```

### 9. Create production health verification script (`scripts/healthcheck.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ShipScope Production Health Check
# Usage: ./scripts/healthcheck.sh
# Returns: exit 0 if all checks pass, exit 1 otherwise
# ============================================================

API_URL="${API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
FAILED=0

check() {
  local name="$1"
  local url="$2"
  local expected="$3"

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [ "$response" = "$expected" ]; then
    echo "PASS  $name ($response)"
  else
    echo "FAIL  $name (expected $expected, got $response)"
    FAILED=1
  fi
}

echo "ShipScope Health Check"
echo "======================"
echo ""

# API checks
check "API Health"          "$API_URL/api/health"    "200"
check "API Feedback List"   "$API_URL/api/feedback"  "200"
check "API Themes List"     "$API_URL/api/themes"    "200"
check "API Proposals List"  "$API_URL/api/proposals"  "200"
check "API Settings"        "$API_URL/api/settings"  "200"

# Web checks
check "Web Home"            "$WEB_URL/"              "200"
check "Web SPA Route"       "$WEB_URL/feedback"      "200"
check "Web SPA Route"       "$WEB_URL/themes"        "200"

# Security checks
powered_by=$(curl -s -I "$API_URL/api/health" | grep -i "x-powered-by" || true)
if [ -z "$powered_by" ]; then
  echo "PASS  X-Powered-By hidden"
else
  echo "FAIL  X-Powered-By exposed: $powered_by"
  FAILED=1
fi

csp=$(curl -s -I "$API_URL/api/health" | grep -i "content-security-policy" || true)
if [ -n "$csp" ]; then
  echo "PASS  CSP header present"
else
  echo "FAIL  CSP header missing"
  FAILED=1
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "Some checks failed!"
  exit 1
fi
```

### 10. Final README badges

Add status badges to the top of `README.md`:

```markdown
<div align="center">

# ShipScope

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](docker-compose.prod.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](tsconfig.json)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](package.json)

**Know what to build, not just how.**

[Quick Start](#quick-start) | [Self-Hosting](docs/self-hosting.md) | [API Reference](docs/api-reference.md) | [Contributing](CONTRIBUTING.md)

</div>
```

## Acceptance Criteria

- [ ] Full QA pass completed on a fresh database — all 16 steps pass without errors
- [ ] Zero console errors in browser DevTools across all 6 routes (production build)
- [ ] Empty states render correctly on all pages (no crashes on zero data)
- [ ] Seed data produces >= 3 themes and >= 2 proposals after synthesis
- [ ] Theme titles from seed data are human-readable (not "Cluster 1")
- [ ] All proposals from seed data have RICE scores > 0
- [ ] README includes at least 3 screenshots of key workflows
- [ ] All screenshots are < 500KB each and render correctly on GitHub
- [ ] Bug report and feature request issue templates created in `.github/ISSUE_TEMPLATE/`
- [ ] PR template created in `.github/pull_request_template.md`
- [ ] GitHub labels created for priority and area categorization
- [ ] Branch protection configured on `main` (requires PR review + CI checks)
- [ ] Logger outputs structured JSON in production mode
- [ ] Logger outputs human-readable format in development mode
- [ ] No stack traces in production log output (only error messages and codes)
- [ ] `scripts/backup.sh` produces a valid, non-empty PostgreSQL dump file
- [ ] Backup script retains only last 30 backups (auto-prune)
- [ ] Data export endpoint returns JSON with all feedback, themes, and proposals
- [ ] `BENCHMARKS.md` has all fields filled in with actual measured values
- [ ] All API response times under 500ms target (verified in benchmarks)
- [ ] Lighthouse performance score >= 80 (verified in benchmarks)
- [ ] Docker image sizes under target (verified in benchmarks)
- [ ] `LICENSE` file contains AGPL-3.0 full text
- [ ] `package.json` "license" field is "AGPL-3.0"
- [ ] No AGPL-incompatible dependencies found by license checker
- [ ] `scripts/healthcheck.sh` exits 0 on a healthy production deployment
- [ ] Health check script verifies security headers (CSP, no X-Powered-By)

## Complexity Estimate

**M (Medium)** — Most items are verification and scripting rather than new feature development. The complexity is in the thoroughness: the QA pass must cover every feature, benchmarks must use real measurements, and the seed data must produce quality AI output. The GitHub setup is straightforward but has many small steps.

## Risk Factors & Mitigations

| Risk                                         | Impact                          | Mitigation                                                                                                              |
| -------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| QA pass reveals bugs in earlier phases       | High — delays launch            | Budget 1 day for bug fixes discovered during QA; track as separate issues                                               |
| Seed data produces poor AI themes            | Medium — bad first impression   | Curate seed data with diverse, realistic feedback covering 3-5 distinct topics; test synthesis multiple times           |
| Screenshots become outdated quickly          | Low — misleading README         | Capture screenshots last, after all UI changes are complete; use stable page states                                     |
| Branch protection blocks emergency fixes     | Low — delayed hotfix            | Admin bypass available; document hotfix process in CONTRIBUTING.md                                                      |
| License checker flags false positives        | Low — unnecessary concern       | Manually review flagged packages; many "unknown" licenses are actually MIT with non-standard format                     |
| Benchmark numbers vary across machines       | Low — misleading expectations   | Document exact hardware and environment; note that results will vary; focus on "meets target" rather than exact numbers |
| Backup script fails silently in cron         | Medium — no backups when needed | Script uses `set -euo pipefail` and checks for empty output; recommend monitoring exit code in cron setup               |
| OpenAI API changes break synthesis during QA | High — synthesis fails          | Pin OpenAI SDK version; test synthesis on seed data before starting QA pass; have fallback model configured             |
