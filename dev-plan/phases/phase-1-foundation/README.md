# Phase 1: Foundation

> **Timeline:** Days 1-3
> **Goal:** Establish a rock-solid monorepo foundation with tooling, shared types, database, backend architecture, frontend shell, Docker dev environment, and testing infrastructure. Every subsequent phase builds on the patterns set here.

---

## Dependency Graph

```
01-monorepo-tooling ─────┬──> 02-core-shared-package ──┬──> 05-frontend-scaffold
                         │                              │
                         ├──> 03-database-migrations ───┤
                         │                              │
                         ├──> 04-backend-foundation ────┼──> 07-testing-infrastructure
                         │                              │
                         └──> 06-docker-dev-environment ┘

Parallelizable:
  - 02, 03, 04, 06 can start simultaneously after 01 completes
  - 05 depends on 02 (shared types) and 04 (API to connect to)
  - 07 depends on 03 (DB) and 04 (backend to test)
```

---

## Tasks Overview

| #   | Task                         | Complexity | Dependencies | Est.  |
| --- | ---------------------------- | ---------- | ------------ | ----- |
| 01  | Monorepo & Tooling Setup     | M          | None         | 0.5d  |
| 02  | Core Shared Package          | M          | 01           | 0.5d  |
| 03  | Database Schema & Migrations | M          | 01           | 0.5d  |
| 04  | Backend Foundation           | XL         | 01           | 1.5d  |
| 05  | Frontend Scaffold            | XL         | 02, 04       | 1.5d  |
| 06  | Docker Dev Environment       | S          | 01           | 0.25d |
| 07  | Testing Infrastructure       | L          | 03, 04       | 0.5d  |

---

## Key Architectural Decisions

1. **Service Layer Pattern** — All business logic lives in service functions, routes are thin HTTP adapters. This is non-negotiable and must be established in 04 before any feature work begins.

2. **Shared Types via Core Package** — `packages/core` provides the canonical TypeScript types that both frontend and backend import. This prevents type drift between the API contract and UI expectations.

3. **Design System as Code** — Tailwind config encodes the entire color palette, typography, and spacing system from Section 4 of the product plan. No hardcoded hex values in components.

4. **Test Database Isolation** — Tests run against a separate PostgreSQL database to prevent data corruption. Cleanup happens before each test, not after (ensures clean state even if tests crash).

---

## Exit Criteria

Before moving to Phase 2, ALL of the following must be true:

- [ ] `npm run lint` passes with zero errors across all packages
- [ ] `npm run build` succeeds for api, web, and core packages
- [ ] `docker compose up` starts postgres, redis, api, and web without errors
- [ ] `GET /api/health` returns `{ status: "ok", db: "connected", redis: "connected" }`
- [ ] Frontend renders at `http://localhost:3000` with sidebar, topbar, and empty page content
- [ ] Navigating between all 6 routes works (Dashboard, Feedback, Themes, Proposals, Specs, Settings)
- [ ] `npm test` runs at least one passing integration test (health check)
- [ ] All shared types in `@shipscope/core` are importable from both `@shipscope/api` and `@shipscope/web`
- [ ] Prisma migration has been applied and `npx prisma studio` shows all 7 tables
