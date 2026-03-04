#!/bin/bash
set -e
echo "Resetting development database..."
docker exec shipscope-postgres psql -U shipscope -c "DROP DATABASE IF EXISTS shipscope;"
docker exec shipscope-postgres psql -U shipscope -c "CREATE DATABASE shipscope;"
cd packages/api
npx prisma migrate dev
npx prisma db seed
echo "Database reset complete."
