#!/usr/bin/env bash
# Pede senha DB jqpb no terminal e roda migração completa. Nada pesado no contexto do agente.
set -euo pipefail
cd "$(dirname "$0")/.."

DEST_REF="jqpbqrhlslgitifuliqa"
POOLER_HOST="${MIGRATE_POOLER_HOST:-aws-0-sa-east-1.pooler.supabase.com}"

echo "Migração CLI → $DEST_REF"
echo "Dashboard: https://supabase.com/dashboard/project/$DEST_REF/settings/database"
echo ""

if [[ -z "${MIGRATE_DEST_DATABASE_URI:-}" ]]; then
  read -r -s -p "Senha Postgres do projeto $DEST_REF: " DB_PASS
  echo ""
  export MIGRATE_DEST_DATABASE_URI="postgresql://postgres.${DEST_REF}:${DB_PASS}@${POOLER_HOST}:5432/postgres?sslmode=require"
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Cole service_role (jqpb) e Enter:"
  read -r SUPABASE_SERVICE_ROLE_KEY
  export SUPABASE_SERVICE_ROLE_KEY
fi

export MIGRATE_DEST_DATABASE_URI
exec bash scripts/complete-migration-cli.sh
