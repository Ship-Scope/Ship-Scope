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
