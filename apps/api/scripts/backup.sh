#!/usr/bin/env bash
# =============================================================================
# JonisFlow — backup noturno do PostgreSQL
# pg_dump → gzip → upload S3/R2 (retenção 30d) + retenção local.
# Agende com cron/systemd timer (não dependa só do job interno da API):
#   0 2 * * *  /app/scripts/backup.sh  >> /var/log/jonisflow-backup.log 2>&1
# =============================================================================
set -euo pipefail

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="${BACKUP_DIR}/jonisflow-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
echo "[$(date)] backup iniciado"

# 1) pg_dump + gzip (base completo; --clean --if-exists habilita restore simple)
pg_dump "$DATABASE_URL" --clean --if-exists | gzip -9 > "$FILE"
echo "[$(date)] dump criado: $FILE ($(du -h "$FILE" | cut -f1))"

# 2) Upload para S3/R2 (compatível S3; R2 usa endpoint custom + region auto)
if [ -n "${S3_BUCKET:-}" ] && [ -n "${S3_ACCESS_KEY_ID:-}" ]; then
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="${S3_REGION:-auto}"
  AWS="aws --endpoint-url ${S3_ENDPOINT:-} --region ${S3_REGION:-auto}"
  $AWS s3 cp "$FILE" "s3://${S3_BUCKET}/backups/$(basename "$FILE")"
  echo "[$(date)] upload concluído: s3://${S3_BUCKET}/backups/$(basename "$FILE")"
else
  echo "[$(date)] WARNING: S3 não configurado — backup permanece só local"
fi

# 3) Retenção (local + remoto)
find "$BACKUP_DIR" -name 'jonisflow-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
if [ -n "${S3_BUCKET:-}" ]; then
  $AWS s3 ls "s3://${S3_BUCKET}/backups/" | awk '{print $NF}' | grep '^jonisflow-' || true
fi
echo "[$(date)] backup concluído"
