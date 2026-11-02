#!/usr/bin/env bash
# =============================================================================
# JonisFlow — restore de backup (runbook testado)
# Teste mensal obrigatório em staging: restore deve completar em <= 30 min.
#
#   $ BACKUP_FILE=/path/to/jonisflow-20261101T020000Z.sql.gz bash scripts/restore.sh
# =============================================================================
set -euo pipefail

BACKUP_FILE="${1:?informe o arquivo de backup}"
TARGET_DB="${TARGET_DB:-$DATABASE_URL}"

echo "[$(date)] restore iniciado: $BACKUP_FILE → $TARGET_DB"

# 1) Download (se o arquivo está no S3/R2)
if [[ "$BACKUP_FILE" == s3://* ]]; then
  export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
  export AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"
  aws --endpoint-url "${S3_ENDPOINT}" --region "${S3_REGION}" s3 cp "$BACKUP_FILE" /tmp/restore.sql.gz
  BACKUP_FILE=/tmp/restore.sql.gz
fi

# 2) Restore (o dump foi feito com --clean: drop+create; para db existente,
#     prefera restore num schema temporário e trocar grava a pointer)
gunzip -c "$BACKUP_FILE" | psql "$TARGET_DB" -v ON_ERROR_STOP=1 -q
echo "[$(date)] restore concluído — valide: /api/health, login, busca de exemplo"
