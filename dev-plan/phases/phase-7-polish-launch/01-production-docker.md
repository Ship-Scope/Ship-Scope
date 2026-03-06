# 01 — Production Docker Build

## Objective

Create production-grade Docker images for the API and Web packages using multi-stage builds. Configure nginx for SPA routing, create a production Docker Compose profile that orchestrates all four services (PostgreSQL, Redis, API, Web), and implement health checks, environment variable management, and image size optimization. The result is a single `docker compose -f docker-compose.prod.yml up` command that launches a fully functional ShipScope instance.

## Dependencies

- Phase 6: Complete (all features implemented and tested)
- Phase 1: Docker dev environment (`docker-compose.yml` exists as reference)
- Phase 1: Backend foundation (Express app with health endpoint)

## Files to Create

| File                      | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `packages/api/Dockerfile` | Multi-stage production Dockerfile for API server |
| `packages/web/Dockerfile` | Multi-stage production Dockerfile for React SPA  |
| `packages/web/nginx.conf` | Nginx configuration for SPA routing + caching    |
| `docker-compose.prod.yml` | Production Docker Compose with all 4 services    |
| `.env.production.example` | Template for production environment variables    |
| `.dockerignore`           | Exclude unnecessary files from Docker context    |

## Files to Modify

| File                                | Changes                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `packages/api/src/routes/health.ts` | Enhance health endpoint with detailed checks for Docker |
| `package.json` (root)               | Add `docker:prod:up` and `docker:prod:down` scripts     |

## Detailed Sub-Tasks

### 1. Create `.dockerignore` at repository root

This file prevents unnecessary files from being copied into the Docker build context, significantly reducing build time and image size.

```dockerignore
node_modules
dist
build
.git
.github
.env
.env.*
!.env.production.example
*.md
!README.md
coverage
.nyc_output
.vscode
.idea
dev-plan
docs
*.log
```

### 2. Create API Dockerfile (`packages/api/Dockerfile`)

Multi-stage build: Stage 1 compiles TypeScript and installs all dependencies. Stage 2 copies only compiled output and production dependencies onto a slim base image.

```dockerfile
# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files for npm workspaces resolution
COPY package.json package-lock.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci --workspace=packages/core --workspace=packages/api --include-workspace-root

# Copy source code for core (shared types) and api
COPY packages/core/ ./packages/core/
COPY packages/api/ ./packages/api/

# Build core first (api depends on it), then api
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=packages/api

# Generate Prisma client for production
RUN npx prisma generate --schema=packages/api/prisma/schema.prisma

# ============================================================
# Stage 2: Production
# ============================================================
FROM node:20-slim AS production

# Install OpenSSL for Prisma (required by node:20-slim)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/

# Install production dependencies only
RUN npm ci --workspace=packages/core --workspace=packages/api \
    --include-workspace-root --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Copy Prisma schema and generated client
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy migration files for runtime migration
COPY --from=builder /app/packages/api/prisma/migrations ./packages/api/prisma/migrations

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 shipscope && \
    chown -R shipscope:nodejs /app
USER shipscope

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Health check: hit the health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

# Run Prisma migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/api/prisma/schema.prisma && node packages/api/dist/index.js"]
```

**Key design decisions:**

- `node:20-alpine` for build (smaller download), `node:20-slim` for production (glibc-based, better Prisma compatibility)
- `npm ci` with `--omit=dev` in production stage strips ~60% of node_modules weight
- Non-root user `shipscope` for security
- `prisma migrate deploy` runs at container startup, ensuring schema is current
- Health check uses Node.js `fetch` (available in Node 20+) to avoid installing curl

### 3. Create Web Dockerfile (`packages/web/Dockerfile`)

Multi-stage build: Stage 1 compiles the React app with Vite. Stage 2 serves static files via nginx:alpine.

```dockerfile
# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN npm ci --workspace=packages/core --workspace=packages/web --include-workspace-root

# Copy source
COPY packages/core/ ./packages/core/
COPY packages/web/ ./packages/web/

# Build core first (web imports shared types), then web
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=packages/web

# ============================================================
# Stage 2: Production (nginx)
# ============================================================
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY packages/web/nginx.conf /etc/nginx/conf.d/shipscope.conf

# Copy built assets from builder stage
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Run nginx as non-root (nginx:alpine supports this)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

EXPOSE 80

# Health check: verify nginx is serving
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**Key design decisions:**

- Final image is nginx:alpine (~40MB base) instead of a Node.js server (~200MB)
- Static files are pre-built with all environment variables baked in at build time via Vite's `import.meta.env`
- `VITE_API_URL` must be passed as a build arg (see Docker Compose below)

### 4. Create nginx configuration (`packages/web/nginx.conf`)

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # ── Gzip Compression ──────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml
        application/rss+xml
        application/atom+xml
        image/svg+xml;

    # ── Static Asset Caching ──────────────────────────────────
    # Vite adds content hashes to filenames, so we can cache aggressively
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ── Favicon & Static Files ────────────────────────────────
    location ~* \.(ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }

    # ── SPA Fallback ──────────────────────────────────────────
    # All routes that don't match a file fall back to index.html
    # This is required for React Router client-side routing
    location / {
        try_files $uri $uri/ /index.html;

        # No caching for index.html (it references hashed assets)
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # ── Security Headers ──────────────────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── Disable Server Tokens ─────────────────────────────────
    server_tokens off;

    # ── Error Pages ───────────────────────────────────────────
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

**Key design decisions:**

- SPA fallback via `try_files $uri $uri/ /index.html` ensures React Router works for all routes
- Vite hashed assets (`/assets/`) get 1-year immutable caching; index.html is never cached
- Gzip enabled for all text-based content types
- Security headers set at the nginx level (defense in depth with Helmet on API)

### 5. Create production Docker Compose (`docker-compose.prod.yml`)

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: shipscope-db-prod
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-shipscope}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: ${POSTGRES_DB:-shipscope}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-shipscope}']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    # No ports exposed to host — only accessible within Docker network
    networks:
      - shipscope-net

  redis:
    image: redis:7-alpine
    container_name: shipscope-redis-prod
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD is required} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', '-a', '${REDIS_PASSWORD}', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - shipscope-net

  api:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
    container_name: shipscope-api-prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: postgresql://${POSTGRES_USER:-shipscope}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-shipscope}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY:?OPENAI_API_KEY is required}
      API_KEY_HASH_SECRET: ${API_KEY_HASH_SECRET:?API_KEY_HASH_SECRET is required}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - '${API_PORT:-4000}:4000'
    networks:
      - shipscope-net
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'

  web:
    build:
      context: .
      dockerfile: packages/web/Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL:-http://localhost:4000}
    container_name: shipscope-web-prod
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    ports:
      - '${WEB_PORT:-3000}:80'
    networks:
      - shipscope-net
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: '0.5'

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  shipscope-net:
    driver: bridge
```

**Key differences from dev `docker-compose.yml`:**

- PostgreSQL and Redis ports are NOT exposed to the host (only accessible within Docker network)
- Redis requires a password (`--requirepass`) with memory limits and eviction policy
- `POSTGRES_PASSWORD` and other secrets use `:?` syntax to fail fast if not set
- Resource limits prevent any single container from consuming all host resources
- `restart: unless-stopped` ensures containers auto-recover from crashes
- All services on an isolated bridge network
- Web build receives `VITE_API_URL` as a build arg for Vite's compile-time env injection

### 6. Create environment variable template (`.env.production.example`)

```env
# ============================================================
# ShipScope Production Environment Variables
# ============================================================
# Copy this file to .env.production and fill in all values.
# Variables marked REQUIRED will cause startup failure if missing.
#
# Usage: docker compose -f docker-compose.prod.yml --env-file .env.production up -d
# ============================================================

# ── Database (REQUIRED) ──────────────────────────────────────
POSTGRES_USER=shipscope
POSTGRES_PASSWORD=        # REQUIRED: strong random password
POSTGRES_DB=shipscope

# ── Redis (REQUIRED) ─────────────────────────────────────────
REDIS_PASSWORD=           # REQUIRED: strong random password

# ── OpenAI (REQUIRED) ────────────────────────────────────────
OPENAI_API_KEY=           # REQUIRED: sk-... API key from OpenAI

# ── API Security (REQUIRED) ──────────────────────────────────
API_KEY_HASH_SECRET=      # REQUIRED: random 64-char hex string for hashing API keys

# ── CORS ──────────────────────────────────────────────────────
CORS_ORIGIN=http://localhost:3000   # Comma-separated origins allowed

# ── Ports ─────────────────────────────────────────────────────
API_PORT=4000
WEB_PORT=3000

# ── Frontend Build ────────────────────────────────────────────
VITE_API_URL=http://localhost:4000  # URL where the API is reachable from browser

# ── Logging ───────────────────────────────────────────────────
LOG_LEVEL=info             # Options: debug, info, warn, error
```

### 7. Enhance health endpoint for Docker health checks

Update `packages/api/src/routes/health.ts` to return granular status with timing information:

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const router = Router();

router.get('/health', async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { status: 'connected', latencyMs: Date.now() - dbStart };
  } catch {
    checks.db = { status: 'disconnected', latencyMs: Date.now() - dbStart };
  }

  // Redis check
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'connected', latencyMs: Date.now() - redisStart };
  } catch {
    checks.redis = { status: 'disconnected', latencyMs: Date.now() - redisStart };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'connected');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
```

**Why latency in health checks:** Docker and orchestrators use health check response time as a signal. If the database round-trip is 500ms+, the health endpoint still returns 200 but operators can see the latency degradation.

### 8. Add convenience scripts to root `package.json`

```json
{
  "scripts": {
    "docker:prod:up": "docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build",
    "docker:prod:down": "docker compose -f docker-compose.prod.yml down",
    "docker:prod:logs": "docker compose -f docker-compose.prod.yml logs -f",
    "docker:prod:build": "docker compose -f docker-compose.prod.yml build --no-cache"
  }
}
```

### 9. Verify image sizes

After building, run the following to verify image sizes meet targets:

```bash
docker images | grep shipscope
# Expected:
#   shipscope-api     latest    <200MB
#   shipscope-web     latest    <30MB
```

If the API image exceeds 200MB, investigate with:

```bash
docker history shipscope-api --no-trunc
# Identify which layer is largest, typically node_modules
```

Common fixes:

- Ensure `.dockerignore` excludes `node_modules`, `.git`, `dev-plan`
- Verify `--omit=dev` is stripping devDependencies in production stage
- Check that Prisma engine binaries are not duplicated (only the Linux binary should be present)

### 10. End-to-end Docker verification

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Wait for health checks to pass
docker compose -f docker-compose.prod.yml ps
# All services should show "healthy"

# Verify API
curl http://localhost:4000/api/health
# Should return: {"status":"ok","checks":{"db":{"status":"connected"},"redis":{"status":"connected"}}}

# Verify Web
curl -I http://localhost:3000
# Should return 200 with security headers

# Verify SPA routing (deep link)
curl -I http://localhost:3000/feedback
# Should return 200 (nginx fallback to index.html)

# Verify no ports leaking
docker compose -f docker-compose.prod.yml port postgres 5432
# Should return empty (postgres not exposed to host)

# Teardown
docker compose -f docker-compose.prod.yml down -v
```

## Acceptance Criteria

- [ ] `docker compose -f docker-compose.prod.yml up` starts all 4 services without errors
- [ ] All services pass Docker health checks within 60 seconds
- [ ] `GET /api/health` returns `200` with db and redis status from within Docker
- [ ] Web app loads at `http://localhost:3000` in production mode
- [ ] Navigating to `/feedback`, `/themes`, `/proposals` works (SPA routing via nginx)
- [ ] API Docker image size < 200MB (`docker images` output)
- [ ] Web Docker image size < 30MB (`docker images` output)
- [ ] PostgreSQL and Redis ports are NOT exposed to the host in production compose
- [ ] Redis requires password authentication in production
- [ ] API runs as non-root user inside the container
- [ ] Missing required environment variables cause immediate startup failure (not silent fallback)
- [ ] `docker compose -f docker-compose.prod.yml down -v` cleanly removes all containers and volumes
- [ ] `.env.production.example` documents every required variable with descriptions
- [ ] Nginx returns `Cache-Control: public, immutable` for `/assets/*` and `no-cache` for `index.html`

## Complexity Estimate

**L (Large)** — Multiple Dockerfiles with multi-stage builds, nginx configuration, production Docker Compose with networking and security, health checks, and environment variable management. Each piece has sharp edges (Prisma binary compatibility, npm workspace hoisting, Vite build args) that require careful testing.

## Risk Factors & Mitigations

| Risk                                                         | Impact                                                      | Mitigation                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Prisma binary mismatch between build and production stages   | High — API crashes on startup with "Query engine not found" | Use same OS family (Debian) for both stages; copy `.prisma` from builder; test with `prisma migrate deploy` in container        |
| npm workspace hoisting puts deps in wrong node_modules       | High — production stage missing critical packages           | Use `npm ci` with explicit `--workspace` flags; verify with `node -e "require('express')"` in production stage                  |
| Vite env vars not baked in at build time                     | Medium — API URL undefined at runtime                       | Pass `VITE_API_URL` as Docker build arg; verify with `grep VITE dist/assets/*.js` after build                                   |
| nginx SPA fallback returns 200 for truly missing assets      | Low — broken images/fonts return HTML instead of 404        | `try_files` for `/assets/` returns 404 (not fallback); only non-asset routes fall through to index.html                         |
| Redis password in Docker Compose visible in `docker inspect` | Medium — credentials exposed to anyone with Docker access   | Document that production deployments should use Docker secrets or external secret management; `.env.production` in `.gitignore` |
| Large Docker build context slows CI builds                   | Low — minutes wasted per build                              | `.dockerignore` excludes `node_modules`, `.git`, `dev-plan`, `docs`; context should be < 5MB                                    |
