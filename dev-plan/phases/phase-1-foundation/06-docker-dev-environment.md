# 06 — Docker Dev Environment

## Objective

Verify and enhance the existing docker-compose.yml to ensure a one-command development environment: `docker compose up` starts PostgreSQL with pgvector, Redis, and provides a reliable foundation for backend and frontend development.

## Dependencies

- 01-monorepo-tooling (package structure)
- Docker Desktop installed and running

## Files to Create

| File                  | Purpose                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| `scripts/setup.sh`    | First-time setup script (install deps, copy env, start docker, run migration, seed) |
| `scripts/reset-db.sh` | Reset development database (drop, recreate, migrate, seed)                          |

## Files to Modify

| File                  | Changes                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`  | Verify healthchecks, volumes, environment variables; remove api/web services for now (dev runs locally) |
| `package.json` (root) | Add docker convenience scripts                                                                          |
| `.env.example`        | Ensure all required variables documented                                                                |

## Detailed Sub-Tasks

### 1. Simplify docker-compose.yml for development

For local development, only run infrastructure services (Postgres + Redis). The API and Web run natively with `npm run dev` for hot-reload. Remove or comment out the `api` and `web` services for now (they'll be needed for production in Phase 7).

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: shipscope-postgres
    environment:
      POSTGRES_USER: shipscope
      POSTGRES_PASSWORD: shipscope
      POSTGRES_DB: shipscope
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U shipscope']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: shipscope-redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### 2. Create setup script (`scripts/setup.sh`)

```bash
#!/bin/bash
set -e

echo "=== ShipScope Development Setup ==="

# 1. Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required"; exit 1; }

# 2. Install dependencies
echo "Installing dependencies..."
npm install

# 3. Copy environment files
if [ ! -f packages/api/.env ]; then
  cp .env.example packages/api/.env
  echo "Created packages/api/.env — please update with your API keys"
fi

# 4. Start infrastructure
echo "Starting PostgreSQL and Redis..."
docker compose up -d
echo "Waiting for services to be healthy..."
sleep 5

# 5. Create test database
docker exec shipscope-postgres psql -U shipscope -c "CREATE DATABASE shipscope_test;" 2>/dev/null || true

# 6. Run migrations
echo "Running database migrations..."
cd packages/api && npx prisma migrate dev --name init && cd ../..

# 7. Seed database
echo "Seeding development data..."
cd packages/api && npx prisma db seed && cd ../..

echo ""
echo "=== Setup Complete ==="
echo "Run 'npm run dev' to start the development servers"
```

### 3. Create database reset script (`scripts/reset-db.sh`)

```bash
#!/bin/bash
set -e
echo "Resetting development database..."
docker exec shipscope-postgres psql -U shipscope -c "DROP DATABASE IF EXISTS shipscope;"
docker exec shipscope-postgres psql -U shipscope -c "CREATE DATABASE shipscope;"
cd packages/api
npx prisma migrate dev
npx prisma db seed
echo "Database reset complete."
```

### 4. Add convenience scripts to root package.json

```json
{
  "scripts": {
    "setup": "bash scripts/setup.sh",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:reset": "docker compose down -v && docker compose up -d",
    "db:migrate": "cd packages/api && npx prisma migrate dev",
    "db:seed": "cd packages/api && npx prisma db seed",
    "db:studio": "cd packages/api && npx prisma studio",
    "db:reset": "bash scripts/reset-db.sh"
  }
}
```

### 5. Verify complete workflow

```bash
# From clean state:
docker compose down -v         # Remove all data
docker compose up -d           # Start fresh
npm run db:migrate             # Apply schema
npm run db:seed                # Load sample data
npm run dev                    # Start api + web
# Visit http://localhost:4000/api/health — should return { status: "ok" }
# Visit http://localhost:3000 — should show frontend
```

## Acceptance Criteria

- [ ] `docker compose up -d` starts Postgres and Redis within 30 seconds
- [ ] `docker compose ps` shows both services as "healthy"
- [ ] PostgreSQL accepts connections at `localhost:5432` with user `shipscope`
- [ ] pgvector extension is available (`SELECT * FROM pg_extension WHERE extname = 'vector'` after migration)
- [ ] Redis accepts connections at `localhost:6379` and responds to PING
- [ ] `scripts/setup.sh` runs end-to-end on a clean machine (with prerequisites)
- [ ] `scripts/reset-db.sh` drops and recreates the database with fresh seed data
- [ ] All convenience scripts in root package.json work correctly
- [ ] Data persists between `docker compose stop` and `docker compose start` (volumes)
- [ ] `docker compose down -v` cleanly removes all data

## Complexity Estimate

**S (Small)** — docker-compose.yml mostly exists. Main work is scripts and verification.

## Risk Factors & Mitigations

| Risk                                                | Impact                          | Mitigation                                                                         |
| --------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| Port conflict (5432 or 6379 in use)                 | Medium — containers won't start | Document in README; provide `POSTGRES_PORT` and `REDIS_PORT` env vars for override |
| pgvector image not available on ARM (Apple Silicon) | High — dev can't start          | `pgvector/pgvector:pg16` supports both amd64 and arm64; verify with `docker pull`  |
| Docker Desktop not running                          | Low — clear error message       | setup.sh checks for docker command availability                                    |
| Seed script fails mid-way                           | Medium — partial data           | Seed script wraps in transaction; setup.sh can re-run safely                       |
