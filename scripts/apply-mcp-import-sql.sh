#!/usr/bin/env bash
# Importa data/supabase-migration/mcp-import/*.sql no Postgres do projeto novo.
# Requer: DATABASE_URI ou MIGRATE_DEST_DATABASE_URI no .env.local (Session :5432)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

DEST_REF="jqpbqrhlslgitifuliqa"
URI="${MIGRATE_DEST_DATABASE_URI:-}"
if [ -z "$URI" ] && [[ "${DATABASE_URI:-}" == *"$DEST_REF"* ]]; then
  URI="${DATABASE_URI}"
fi
if [ -z "$URI" ]; then
  echo "Defina MIGRATE_DEST_DATABASE_URI (ref $DEST_REF, porta 5432)"
  exit 1
fi
LOG="${MIGRATE_IMPORT_LOG:-/tmp/migrate-import-sql.log}"
exec > >(tee -a "$LOG") 2>&1
echo "Log: $LOG"

DIR="data/supabase-migration/mcp-import"
if [ ! -d "$DIR" ]; then
  echo "Pasta $DIR não encontrada. Rode: npm run migrate:mcp:gen-import"
  exit 1
fi

shopt -s nullglob
files=("$DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "Nenhum .sql em $DIR. Rode: npm run migrate:mcp:gen-import"
  exit 1
fi

for f in "${files[@]}"; do
  echo ">>> $(basename "$f")"
  psql "$URI" -v ON_ERROR_STOP=1 -f "$f"
done

echo ""
echo "Verificando contagens..."
psql "$URI" -v ON_ERROR_STOP=1 -c "
SELECT 'posts' AS t, count(*)::int AS n FROM posts
UNION ALL SELECT 'media', count(*)::int FROM media
UNION ALL SELECT 'sponsors', count(*)::int FROM sponsors
UNION ALL SELECT 'categories', count(*)::int FROM categories;
"
