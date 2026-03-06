# 04 — Documentation

## Objective

Write comprehensive documentation that enables three audiences: (1) users who want to self-host ShipScope, (2) developers integrating via the API, and (3) contributors who want to improve the codebase. All documentation is Markdown-based, lives in the repository, and stays in sync with the code through concrete examples derived from the actual implementation.

## Dependencies

- Phase 7, Task 01: Production Docker (Docker Compose commands referenced in self-hosting guide)
- Phase 6: All features complete (API endpoints exist to document)
- Phase 1: Project structure (architecture to describe)

## Files to Create

| File                    | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `docs/self-hosting.md`  | Step-by-step self-hosting guide with Docker |
| `docs/api-reference.md` | Complete API reference for all endpoints    |
| `docs/architecture.md`  | System architecture overview with diagrams  |

## Files to Modify

| File              | Changes                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `README.md`       | Add project overview, screenshots, quickstart, architecture summary, badges |
| `CONTRIBUTING.md` | Add setup guide, coding standards, PR process, testing requirements         |

## Detailed Sub-Tasks

### 1. Write self-hosting guide (`docs/self-hosting.md`)

````markdown
# Self-Hosting ShipScope

This guide walks you through deploying ShipScope on your own infrastructure using Docker.

## Prerequisites

- **Docker** >= 24.0 and **Docker Compose** >= 2.20
- **OpenAI API Key** with access to `gpt-4o-mini` and `text-embedding-3-small`
- At least **2GB RAM** and **10GB disk space** available
- A domain name (optional, but recommended for HTTPS)

## Quick Start (5 minutes)

### 1. Clone the repository

```bash
git clone https://github.com/Ship-Scope/Ship-Scope.git
cd Ship-Scope
```
````

### 2. Create environment file

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and fill in the required values:

```env
POSTGRES_PASSWORD=<generate-a-strong-random-password>
REDIS_PASSWORD=<generate-another-strong-random-password>
OPENAI_API_KEY=sk-your-openai-api-key
API_KEY_HASH_SECRET=<64-character-hex-string>
CORS_ORIGIN=https://your-domain.com
VITE_API_URL=https://your-domain.com/api
```

To generate secure random values:

```bash
# Generate a strong password
openssl rand -base64 32

# Generate a 64-char hex string for API_KEY_HASH_SECRET
openssl rand -hex 32
```

### 3. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### 4. Verify

```bash
# Check all services are running
docker compose -f docker-compose.prod.yml ps

# Check API health
curl http://localhost:4000/api/health

# Open the web UI
open http://localhost:3000
```

### 5. Seed demo data (optional)

```bash
docker compose -f docker-compose.prod.yml exec api \
  npx prisma db seed --schema=packages/api/prisma/schema.prisma
```

## Configuration Reference

| Variable              | Required | Default                 | Description                               |
| --------------------- | -------- | ----------------------- | ----------------------------------------- |
| `POSTGRES_USER`       | No       | `shipscope`             | PostgreSQL username                       |
| `POSTGRES_PASSWORD`   | **Yes**  | —                       | PostgreSQL password                       |
| `POSTGRES_DB`         | No       | `shipscope`             | PostgreSQL database name                  |
| `REDIS_PASSWORD`      | **Yes**  | —                       | Redis password                            |
| `OPENAI_API_KEY`      | **Yes**  | —                       | OpenAI API key (sk-...)                   |
| `API_KEY_HASH_SECRET` | **Yes**  | —                       | Secret for hashing API keys (64-char hex) |
| `CORS_ORIGIN`         | No       | `http://localhost:3000` | Allowed CORS origins (comma-separated)    |
| `VITE_API_URL`        | No       | `http://localhost:4000` | API URL accessible from the browser       |
| `API_PORT`            | No       | `4000`                  | Host port for the API                     |
| `WEB_PORT`            | No       | `3000`                  | Host port for the web UI                  |
| `LOG_LEVEL`           | No       | `info`                  | Log level: debug, info, warn, error       |

## Updating

```bash
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Database migrations run automatically on API container startup.

## Backup & Restore

### Create backup

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U shipscope shipscope > backup-$(date +%Y%m%d).sql
```

### Restore from backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U shipscope shipscope < backup-20240101.sql
```

## Reverse Proxy (HTTPS)

ShipScope does not handle TLS directly. Use a reverse proxy like Caddy, nginx, or Traefik for HTTPS.

### Caddy (recommended — auto-HTTPS)

```
shipscope.example.com {
    handle /api/* {
        reverse_proxy localhost:4000
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name shipscope.example.com;

    ssl_certificate /etc/ssl/certs/shipscope.pem;
    ssl_certificate_key /etc/ssl/private/shipscope.key;

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

| Symptom                                   | Cause                    | Fix                                                              |
| ----------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| API health returns `"db": "disconnected"` | PostgreSQL not ready     | Wait 30s for health check; check `docker logs shipscope-db-prod` |
| Web shows blank page                      | `VITE_API_URL` incorrect | Rebuild web container with correct `VITE_API_URL`                |
| AI features return 502                    | Invalid OpenAI API key   | Verify key at https://platform.openai.com/api-keys               |
| Rate limit errors (429)                   | Too many requests        | Wait 15 minutes; adjust rate limits via env vars                 |
| "Query engine not found"                  | Prisma binary mismatch   | Rebuild API container: `docker compose build api --no-cache`     |

````

### 2. Write API reference (`docs/api-reference.md`)

Document every endpoint with method, path, request schema, response schema, and curl example. Structure:

```markdown
# ShipScope API Reference

Base URL: `http://localhost:4000/api`

All endpoints return JSON. Errors follow this format:
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "statusCode": 400
}
````

## Authentication

Most endpoints do not require authentication (single-tenant deployment).
Webhook endpoints require an API key via the `X-API-Key` header.

---

## Health

### GET /api/health

Check API and dependency status.

**Response 200:**

```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "db": { "status": "connected", "latencyMs": 2 },
    "redis": { "status": "connected", "latencyMs": 1 }
  }
}
```

---

## Feedback

### GET /api/feedback

List feedback items with pagination and filtering.

**Query Parameters:**

| Param       | Type   | Default     | Description                                              |
| ----------- | ------ | ----------- | -------------------------------------------------------- |
| `limit`     | number | 50          | Items per page (max 100)                                 |
| `offset`    | number | 0           | Pagination offset                                        |
| `source`    | string | —           | Filter by source (csv, json, manual, webhook)            |
| `sentiment` | string | —           | Filter by sentiment (positive, negative, neutral, mixed) |
| `search`    | string | —           | Full-text search in content                              |
| `sort`      | string | `createdAt` | Sort field                                               |
| `order`     | string | `desc`      | Sort order (asc, desc)                                   |

**Response 200:**

```json
{
  "data": [
    {
      "id": "clx...",
      "content": "The onboarding flow is confusing",
      "source": "csv",
      "sentiment": "negative",
      "urgency": 0.8,
      "status": "processed",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Example:**

```bash
curl "http://localhost:4000/api/feedback?limit=10&sentiment=negative&sort=urgency&order=desc"
```

### POST /api/feedback

Create a single feedback item.

**Request Body:**

```json
{
  "content": "I wish there was a dark mode option",
  "source": "manual",
  "metadata": {
    "customer": "user@example.com",
    "plan": "pro"
  }
}
```

**Response 201:**

```json
{
  "id": "clx...",
  "content": "I wish there was a dark mode option",
  "source": "manual",
  "sentiment": null,
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### POST /api/feedback/import

Import feedback from CSV or JSON file upload.

**Request:** `multipart/form-data`

| Field    | Type   | Description                 |
| -------- | ------ | --------------------------- |
| `file`   | File   | CSV or JSON file (max 10MB) |
| `source` | string | Import source label         |

**Response 200:**

```json
{
  "imported": 150,
  "skipped": 3,
  "errors": ["Row 42: missing content field"]
}
```

---

## Themes

### GET /api/themes

List AI-generated themes sorted by feedback count.

**Response 200:**

```json
{
  "data": [
    {
      "id": "clx...",
      "title": "Onboarding Friction",
      "description": "Users report confusion during initial setup...",
      "feedbackCount": 23,
      "sentiment": "negative",
      "createdAt": "2024-01-15T12:00:00.000Z"
    }
  ],
  "total": 8
}
```

### GET /api/themes/:id

Get a single theme with linked feedback items.

**Response 200:**

```json
{
  "id": "clx...",
  "title": "Onboarding Friction",
  "description": "...",
  "feedbackCount": 23,
  "feedbackItems": [{ "id": "clx...", "content": "...", "sentiment": "negative" }]
}
```

---

## Proposals

### GET /api/proposals

List feature proposals sorted by RICE score.

**Response 200:**

```json
{
  "data": [
    {
      "id": "clx...",
      "title": "Simplify onboarding wizard",
      "description": "...",
      "riceScore": 85.5,
      "reach": 90,
      "impact": 3,
      "confidence": 80,
      "effort": 2,
      "status": "proposed",
      "themeId": "clx...",
      "createdAt": "2024-01-15T13:00:00.000Z"
    }
  ],
  "total": 5
}
```

### PATCH /api/proposals/:id

Update a proposal's RICE scores or status.

**Request Body:**

```json
{
  "reach": 95,
  "impact": 3,
  "confidence": 85,
  "effort": 2,
  "status": "accepted"
}
```

---

## Synthesis

### POST /api/synthesis/run

Trigger AI synthesis pipeline (embedding, clustering, theme extraction, proposals).

**Request Body:**

```json
{
  "projectId": "default"
}
```

**Response 202:**

```json
{
  "jobId": "bull-job-123",
  "status": "queued",
  "message": "Synthesis pipeline started"
}
```

**Rate Limit:** 5 requests per hour per project.

### GET /api/synthesis/status/:jobId

Check synthesis job progress.

**Response 200:**

```json
{
  "jobId": "bull-job-123",
  "status": "completed",
  "progress": 100,
  "result": {
    "feedbackProcessed": 150,
    "themesGenerated": 8,
    "proposalsGenerated": 5
  }
}
```

---

## Webhook

### POST /api/webhook/feedback

Ingest feedback via webhook (requires API key).

**Headers:**

```
X-API-Key: sk_live_your_api_key_here
Content-Type: application/json
```

**Request Body:**

```json
{
  "content": "Your product is amazing but needs better docs",
  "source": "intercom",
  "metadata": { "ticket_id": "12345" }
}
```

**Response 201:**

```json
{
  "id": "clx...",
  "status": "pending"
}
```

---

## Settings

### GET /api/settings

Get current project settings.

### PUT /api/settings

Update project settings.

### POST /api/api-keys

Generate a new API key (returned once, then only the hash is stored).

### DELETE /api/api-keys/:id

Revoke an API key.

````

### 3. Write architecture overview (`docs/architecture.md`)

```markdown
# ShipScope Architecture

## System Overview

ShipScope is a monorepo with three packages:

````

shipscope/
├── packages/
│ ├── core/ # Shared TypeScript types and Zod schemas
│ ├── api/ # Express REST API + BullMQ workers
│ └── web/ # React SPA (Vite + Tailwind)

````

## Architecture Diagram

```mermaid
graph TB
    subgraph "Browser"
        WEB[React SPA<br/>React 18 + Vite + Tailwind]
    end

    subgraph "API Server"
        EXPRESS[Express API<br/>Routes + Middleware]
        SERVICES[Service Layer<br/>Business Logic]
        WORKERS[BullMQ Workers<br/>Background Jobs]
    end

    subgraph "AI Layer"
        OPENAI[OpenAI API<br/>gpt-4o-mini + text-embedding-3-small]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL 16<br/>+ pgvector)]
        REDIS[(Redis 7<br/>Queue + Cache)]
    end

    WEB -->|REST API| EXPRESS
    EXPRESS --> SERVICES
    SERVICES --> PG
    SERVICES --> REDIS
    SERVICES -->|Enqueue jobs| REDIS
    WORKERS -->|Process jobs| REDIS
    WORKERS --> OPENAI
    WORKERS --> PG
````

## Data Flow

### 1. Feedback Ingestion

```
User Upload/Webhook → Express Route → Zod Validation → Sanitization
  → Feedback Service → Prisma INSERT → PostgreSQL
  → Enqueue embedding job → Redis/BullMQ
```

### 2. AI Synthesis Pipeline

```
Synthesis Trigger → BullMQ Job Queue → Worker picks up job
  → Step 1: Generate embeddings (OpenAI text-embedding-3-small)
  → Step 2: Store embeddings in pgvector
  → Step 3: Cluster similar feedback (cosine similarity)
  → Step 4: Extract themes (OpenAI gpt-4o-mini)
  → Step 5: Generate proposals with RICE scores (OpenAI gpt-4o-mini)
  → Step 6: Store results in PostgreSQL
```

### 3. Dashboard Data Flow

```
React Component mounts → TanStack Query fetches /api/stats
  → Express Route → Stats Service → Check Redis cache
    → Cache HIT: return cached data (< 5ms)
    → Cache MISS: query PostgreSQL → cache result (60s TTL) → return
  → React Query caches in browser → Re-render with data
```

## Component Responsibilities

| Component        | Responsibility                                  | Does NOT do                                  |
| ---------------- | ----------------------------------------------- | -------------------------------------------- |
| `packages/core`  | TypeScript types, Zod schemas, shared constants | Business logic, I/O, database access         |
| Express Routes   | HTTP parsing, validation, response formatting   | Business logic, direct DB queries            |
| Service Layer    | Business logic, orchestration, caching          | HTTP concerns, direct Prisma calls in routes |
| Prisma ORM       | Database queries, migrations, type-safe access  | Business logic, HTTP concerns                |
| BullMQ Workers   | Background job processing, AI pipeline          | Serving HTTP requests                        |
| React Components | UI rendering, user interaction                  | Direct API calls (uses TanStack Query)       |
| TanStack Query   | API data fetching, caching, sync                | UI rendering, business logic                 |

## Database Schema (simplified)

```
Feedback ──< FeedbackTheme >── Theme ──< Proposal ── Spec
    │                            │
    └── embedding (pgvector)     └── feedbackCount (denormalized)
```

Key tables: Feedback, Theme, Proposal, Spec, ApiKey, Settings, SynthesisJob

````

### 4. Update root `README.md`

The README should follow this structure:

```markdown
# ShipScope

> Know what to build, not just how.

ShipScope is an open-source AI-powered tool that analyzes customer feedback
and tells you what to build next. Import feedback from any source, let AI
identify themes and patterns, and get prioritized feature proposals with
RICE scoring.

[Screenshot: Dashboard overview — to be captured during launch checklist]

## Features

- **Feedback Ingestion** — Import from CSV, JSON, manual entry, or webhooks
- **AI Theme Discovery** — Automatically clusters similar feedback into themes
- **Smart Proposals** — AI-generated feature proposals with RICE prioritization
- **Evidence Linking** — Every proposal is backed by real customer feedback
- **Spec Generation** — Generate PRDs from accepted proposals
- **Dashboard** — Overview of feedback volume, sentiment trends, and top themes

## Quick Start

### Prerequisites
- Docker >= 24.0 and Docker Compose >= 2.20
- OpenAI API key

### Run with Docker

```bash
git clone https://github.com/Ship-Scope/Ship-Scope.git
cd Ship-Scope
cp .env.production.example .env.production
# Edit .env.production with your values
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
````

Open http://localhost:3000

### Run for Development

```bash
git clone https://github.com/Ship-Scope/Ship-Scope.git
cd Ship-Scope
npm install
docker compose up -d  # Start PostgreSQL + Redis
npm run db:migrate
npm run dev           # Start API + Web dev servers
```

## Architecture

```
packages/
├── core/    → Shared TypeScript types and schemas
├── api/     → Express + Prisma + BullMQ backend
└── web/     → React 18 + Vite + Tailwind frontend
```

See [docs/architecture.md](docs/architecture.md) for the full system design.

## Documentation

- [Self-Hosting Guide](docs/self-hosting.md) — Deploy ShipScope on your infrastructure
- [API Reference](docs/api-reference.md) — Complete REST API documentation
- [Architecture](docs/architecture.md) — System design and data flow
- [Contributing](CONTRIBUTING.md) — How to contribute to ShipScope

## Tech Stack

| Layer          | Technology                                            |
| -------------- | ----------------------------------------------------- |
| Frontend       | React 18, TypeScript, Vite, Tailwind CSS              |
| Backend        | Express, Prisma, PostgreSQL (pgvector), Redis, BullMQ |
| AI             | OpenAI (gpt-4o-mini, text-embedding-3-small)          |
| Infrastructure | Docker, Docker Compose                                |

## License

[AGPL-3.0](LICENSE) — Free to use, modify, and self-host. Network use requires
source code disclosure.

````

### 5. Update `CONTRIBUTING.md`

The contributing guide should cover:

```markdown
# Contributing to ShipScope

Thank you for your interest in contributing to ShipScope! This guide covers
everything you need to get started.

## Development Setup

### Prerequisites
- Node.js >= 20.0.0
- Docker and Docker Compose (for PostgreSQL + Redis)
- npm (comes with Node.js)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/Ship-Scope/Ship-Scope.git
cd Ship-Scope

# Install dependencies (all packages)
npm install

# Start PostgreSQL and Redis
docker compose up -d

# Run database migrations
npm run db:migrate

# Seed demo data (optional)
npm run db:seed

# Start development servers (API + Web)
npm run dev
````

The API runs at http://localhost:4000 and the web UI at http://localhost:3000.

## Project Structure

```
packages/
├── core/src/          # Shared types (imported by both api and web)
│   ├── types/         # TypeScript interfaces
│   └── schemas/       # Zod validation schemas
├── api/src/
│   ├── routes/        # Express route handlers (thin HTTP layer)
│   ├── services/      # Business logic (where the real work happens)
│   ├── middleware/     # Express middleware
│   ├── lib/           # Utilities (OpenAI client, Redis, etc.)
│   ├── workers/       # BullMQ background job processors
│   └── __tests__/     # Test files (co-located)
└── web/src/
    ├── components/    # React components
    │   └── ui/        # Base UI primitives
    ├── pages/         # Route-level page components
    ├── hooks/         # Custom React hooks
    ├── lib/           # Utility functions
    └── api/           # API client functions
```

## Coding Standards

### TypeScript

- **No `any` types** — ESLint enforces this. Use `unknown` and narrow with type guards.
- **Use `import type {}`** for type-only imports (enforced by ESLint).
- **All functions must be typed** — parameters and return types explicit.

### Service Layer Pattern

All business logic goes in service functions (`packages/api/src/services/`).
Route handlers are thin HTTP adapters that:

1. Extract and validate input (Zod)
2. Call a service function
3. Format and return the response

```typescript
// GOOD: Route calls service
router.get('/feedback', async (req, res) => {
  const params = feedbackQuerySchema.parse(req.query);
  const result = await feedbackService.list(params);
  res.json(result);
});

// BAD: Route contains business logic
router.get('/feedback', async (req, res) => {
  const feedback = await prisma.feedback.findMany({ ... });  // Don't do this
  res.json(feedback);
});
```

### React Components

- Functional components only (no class components)
- Use TanStack Query for all API data fetching
- Co-locate related files: `FeedbackList.tsx` alongside `useFeedbackList.ts`
- Page components use `export default` (required for React.lazy code splitting)

### Styling

- Tailwind CSS utility classes only — no custom CSS files
- Follow the design system defined in `tailwind.config.ts`
- No hardcoded hex colors — use Tailwind theme tokens

## Pull Request Process

### Before Opening a PR

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the coding standards above.

3. **Run the full check suite:**

   ```bash
   npm run lint          # Zero errors required
   npm run typecheck     # TypeScript compilation check
   npm test              # All tests must pass
   npm run build         # Production build must succeed
   ```

4. **Write tests** for new functionality:
   - Service functions: unit tests with mocked dependencies
   - API routes: integration tests with Supertest
   - React components: use React Testing Library for user-facing behavior

### PR Requirements

- [ ] Title follows conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- [ ] Description explains the "why" not just the "what"
- [ ] All CI checks pass (lint, typecheck, test, build)
- [ ] New endpoints have integration tests
- [ ] No `console.log` in committed code (use the logger)
- [ ] No secrets or `.env` files committed

### Review Process

1. At least 1 approving review required
2. All CI checks must pass
3. Squash merge into `main`

## Testing

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --run           # Run once (no watch mode)
npm test -- feedback        # Run tests matching "feedback"
npm run test:coverage       # Generate coverage report
```

### Test Conventions

- Test files live next to the code they test: `feedback.service.ts` / `feedback.service.test.ts`
- Use `describe` blocks to group by function or feature
- Use `it` with descriptive names: `it('should return 400 when content is empty')`
- Mock external services (OpenAI, file system) but use real database for integration tests

## Getting Help

- Open a [GitHub Issue](https://github.com/Ship-Scope/Ship-Scope/issues) for bugs or feature requests
- Use the `question` label for questions about the codebase

````

### 6. Verify documentation accuracy

After writing all documentation, verify every command and code example actually works:

```bash
# Test self-hosting guide commands
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
curl http://localhost:4000/api/health
docker compose -f docker-compose.prod.yml down -v

# Test contributing guide commands
npm install
npm run lint
npm run typecheck
npm test -- --run
npm run build

# Test API reference examples
curl "http://localhost:4000/api/feedback?limit=10"
curl -X POST http://localhost:4000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"content": "Test feedback", "source": "manual"}'
````

**Every curl example in the API reference must be copy-pasteable and return the documented response shape.** If any example fails, fix the documentation to match the actual behavior — never the other way around.

## Acceptance Criteria

- [ ] `docs/self-hosting.md` covers prerequisites, quick start, config reference, backup, reverse proxy, and troubleshooting
- [ ] Self-hosting guide tested end-to-end from `git clone` to working instance on a clean environment
- [ ] `docs/api-reference.md` documents every public API endpoint with method, path, parameters, request body, response body, and curl example
- [ ] Every curl example in the API reference returns the documented response shape when tested
- [ ] `docs/architecture.md` includes system diagram (Mermaid), data flow descriptions, and component responsibility matrix
- [ ] Architecture diagram matches the actual system (all services, data stores, and connections represented)
- [ ] `README.md` includes project description, feature list, quick start (Docker and dev), architecture summary, docs links, tech stack table, and license
- [ ] `CONTRIBUTING.md` covers dev setup, project structure, coding standards, PR process, and testing conventions
- [ ] All Markdown files render correctly on GitHub (no broken links, no formatting issues)
- [ ] No placeholder text (e.g., "TODO", "TBD", "coming soon") in any published documentation
- [ ] All internal links between docs are valid and resolve correctly
- [ ] Code examples in CONTRIBUTING.md follow the actual coding standards enforced by ESLint

## Complexity Estimate

**L (Large)** — Documentation is deceptively time-consuming. The self-hosting guide requires testing every step on a clean environment. The API reference requires documenting ~15 endpoints with accurate request/response schemas. The architecture overview requires diagramming the full system. Every code example must be verified against the real implementation.

## Risk Factors & Mitigations

| Risk                                                     | Impact                                            | Mitigation                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Documentation drifts from code over time                 | High — users hit errors following outdated guides | Keep docs minimal and link to source code where possible; add a "last verified" date to each doc                        |
| Self-hosting guide fails on different OS/Docker versions | Medium — frustrating first experience             | Test on both macOS and Linux (GitHub Actions CI); specify minimum Docker version                                        |
| API reference missing undocumented endpoints             | Medium — incomplete integration guide             | Generate endpoint list from Express router programmatically; cross-reference with route files                           |
| Architecture diagram becomes stale after refactoring     | Low — misleading system overview                  | Use Mermaid (text-based, diffable) instead of binary images; review diagram in PRs that change architecture             |
| README screenshots become outdated after UI changes      | Low — confusing first impression                  | Capture screenshots as late as possible (during launch checklist); use specific page states that are unlikely to change |
| Curl examples break when API validation changes          | Medium — copy-paste fails for users               | Integration test that runs every curl example from the API reference (future CI improvement)                            |
