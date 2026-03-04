#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ShipScope Database Backup Script
# Usage: ./scripts/backup.sh [backup-dir]
# ============================================================

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/shipscope_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Starting backup..."

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-shipscope}" "${POSTGRES_DB:-shipscope}" \
  --format=custom \
  --compress=9 \
  > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file is empty!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

cd "$BACKUP_DIR"
ls -t shipscope_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm
echo "Old backups pruned (keeping last 30)"
