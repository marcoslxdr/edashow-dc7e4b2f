#!/usr/bin/env bash
# Finaliza migração jqpb via terminal (psql + npm). Sem MCP. Logs em /tmp/migrate-cli.log
#
# Uso (credenciais só no shell, não commitar):
#   export MIGRATE_DEST_DATABASE_URI='postgresql://postgres.jqpbqrhlslgitifuliqa:...@...:5432/postgres'
#   export SUPABASE_SERVICE_ROLE_KEY='eyJ...'   # ref jqpb no JWT
#   npm run migrate:cli:complete
#
# Ou: npm run migrate:cli:complete -- --env-file .env.jqpb
set -euo pipefail
cd "$(dirname "$0")/.."

DEST_REF="jqpbqrhlslgitifuliqa"
LOG="/tmp/migrate-cli.log"
exec > >(tee -a "$LOG") 2>&1

ENV_FILE=".env.local"
if [[ "${1:-}" == "--env-file" && -n "${2:-}" ]]; then
  ENV_FILE="$2"
  shift 2
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
fi

fail() { echo "❌ $*" >&2; exit 1; }

uri="${MIGRATE_DEST_DATABASE_URI:-}"
if [[ -z "$uri" && "${DATABASE_URI:-}" == *"$DEST_REF"* ]]; then
  uri="${DATABASE_URI}"
fi
[[ -n "$uri" ]] || fail "export MIGRATE_DEST_DATABASE_URI (Session :5432, ref $DEST_REF). DATABASE_URI antigo não serve."

if [[ "$uri" != *"$DEST_REF"* ]]; then
  fail "DATABASE_URI aponta para outro projeto. Use Session URI do $DEST_REF no Dashboard."
fi

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  ref=$(node -e "
    const k=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
    const p=k.split('.')[1];
    if(!p){process.exit(1)}
    const j=JSON.parse(Buffer.from(p,'base64url').toString());
    process.stdout.write(j.ref||'');
  " 2>/dev/null || true)
  if [[ -n "$ref" && "$ref" != "$DEST_REF" ]]; then
    fail "SUPABASE_SERVICE_ROLE_KEY é do projeto '$ref', não $DEST_REF"
  fi
fi

echo ">>> 1/4 Schema (supabase/migrations/*.sql)"
npm run migrate:supabase-sql

echo ">>> 2/4 Dados SQL (data/supabase-migration/mcp-import/)"
npm run migrate:supabase:import-sql

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo ">>> 2b/4 Cache invoke (.cache/mcp_invoke/)"
  npm run migrate:mcp:apply-cache
fi

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo ">>> 3/4 Auth + storage (migrate:supabase)"
  npm run migrate:supabase
else
  echo ">>> 3/4 Pulando auth/storage (sem SUPABASE_SERVICE_ROLE_KEY do $DEST_REF)"
fi

echo ">>> 4/4 Verificação"
psql "$uri" -v ON_ERROR_STOP=1 -c "
SELECT 'posts' AS t, count(*)::int AS n FROM posts
UNION ALL SELECT 'categories', count(*)::int FROM categories
UNION ALL SELECT 'media', count(*)::int FROM media
UNION ALL SELECT 'sponsors', count(*)::int FROM sponsors
UNION ALL SELECT 'user_roles', count(*)::int FROM user_roles
UNION ALL SELECT 'auth.users', count(*)::int FROM auth.users;
"
npm run test:db 2>&1 | tail -20

echo ""
echo "✅ CLI concluído. Atualize Vercel com URL/keys do $DEST_REF."
