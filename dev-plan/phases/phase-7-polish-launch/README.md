# Phase 7: Polish & Launch Prep

> **Timeline:** Days 18-21
> **Goal:** Harden ShipScope for production deployment. Optimize Docker builds for minimal image size, tune performance to meet load-time targets, close all security gaps, write comprehensive documentation, and execute a final launch checklist. After this phase, ShipScope is deployable, documented, and ready for public release.

---

## Dependency Graph

```
Phase 6 (Complete) ──┐
                     │
                     ├──> 01-production-docker ──┬──> 05-launch-checklist
                     │                           │
                     ├──> 02-performance ─────────┤
                     │                           │
                     ├──> 03-security-audit ──────┤
                     │                           │
                     └──> 04-documentation ───────┘

Parallelizable:
  - 01, 02, 03, 04 can all start simultaneously (no cross-dependencies)
  - 05 depends on ALL of 01-04 being complete (launch gate)
```

---

## Tasks Overview

| #   | Task                     | Complexity | Dependencies     | Est.  |
| --- | ------------------------ | ---------- | ---------------- | ----- |
| 01  | Production Docker Build  | L          | Phase 6 complete | 1.0d  |
| 02  | Performance Optimization | L          | Phase 6 complete | 1.0d  |
| 03  | Security Audit           | M          | Phase 6 complete | 0.75d |
| 04  | Documentation            | L          | Phase 6 complete | 1.0d  |
| 05  | Launch Checklist         | M          | 01, 02, 03, 04   | 0.5d  |

---

## Key Architectural Decisions

1. **Multi-Stage Docker Builds** — Every Dockerfile uses at least two stages: a `builder` stage with all dev dependencies for compilation, and a `production` stage with only the runtime. This keeps API images under 200MB and Web images under 30MB, compared to 1GB+ with naive builds.

2. **Nginx for Static Assets** — The React SPA is served via `nginx:alpine` rather than a Node.js static server. Nginx handles gzip, caching headers, and SPA fallback routing with near-zero memory overhead compared to serving from Express.

3. **Route-Level Code Splitting** — `React.lazy()` + `Suspense` boundaries are applied at the route level, not the component level. This gives the best balance of initial load speed and code-splitting granularity without over-fragmenting the bundle.

4. **Security-by-Default Configuration** — Helmet CSP headers, CORS whitelist, and rate limiting are configured in the production Docker environment, not left as opt-in. The default deployment is secure; developers must explicitly relax restrictions for local development.

5. **Structured JSON Logging** — Production logs are JSON to stdout/stderr. No file-based logging, no external logging service dependency. This is compatible with any container orchestrator (Docker, K8s, ECS) that captures stdout.

6. **Documentation-as-Code** — API reference is generated from route definitions and Zod schemas. Architecture diagrams are Mermaid-in-Markdown, not binary image files. Everything stays in sync with the codebase.

---

## Exit Criteria

Before declaring ShipScope v1.0 launch-ready, ALL of the following must be true:

- [ ] `docker compose -f docker-compose.prod.yml up` starts all 4 services and passes health checks
- [ ] API Docker image is under 200MB, Web Docker image is under 30MB
- [ ] Lighthouse performance score >= 80 on the Dashboard page
- [ ] Page load time < 2s on a cold start (no cache)
- [ ] All list API endpoints respond in < 500ms with 1000 records
- [ ] `npm audit` shows zero critical or high vulnerabilities
- [ ] All OWASP Top 10 web risks reviewed and mitigated (where applicable)
- [ ] Helmet security headers present on all responses (verified via curl)
- [ ] CORS rejects requests from non-whitelisted origins
- [ ] Rate limiting active on all public endpoints (verified via load test)
- [ ] Self-hosting guide tested end-to-end on a fresh machine (or fresh Docker environment)
- [ ] API reference documents every endpoint with request/response examples
- [ ] README includes project description, screenshots, quickstart, and architecture overview
- [ ] Seed data produces at least 3 themes and 2 proposals on a fresh database
- [ ] `pg_dump` backup script runs successfully and produces a restorable dump
- [ ] All 6 routes render correctly in production build (no console errors)
- [ ] Error responses use structured JSON format with correlation IDs
- [ ] AGPL-3.0 license file present and referenced in package.json
