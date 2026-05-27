# Migração para o novo projeto Supabase

Projeto destino: `jqpbqrhlslgitifuliqa`  
URL: https://jqpbqrhlslgitifuliqa.supabase.co

## O que já foi feito

- Export dos dados do projeto antigo (`exeuuqbgyfaxgbwygfuu`) em `data/supabase-migration/`
- Baseline SQL em `supabase/migrations/20240101000000_baseline_edashow_core.sql`
- `.env.local` apontando para o **novo** projeto (publishable key configurada)
- Scripts: `npm run migrate:supabase:export`, `migrate:supabase`, `migrate:supabase:sql-bundle`

## O que você precisa colar no `.env.local`

No [Dashboard → Settings → API](https://supabase.com/dashboard/project/jqpbqrhlslgitifuliqa/settings/api):

1. **service_role** (ou secret key) → `SUPABASE_SERVICE_ROLE_KEY=`
2. [Database → Connection string](https://supabase.com/dashboard/project/jqpbqrhlslgitifuliqa/settings/database) → URI **Session** (porta 5432) → `DATABASE_URI=` e `MIGRATE_DEST_DATABASE_URI=`
3. [Storage → S3](https://supabase.com/dashboard/project/jqpbqrhlslgitifuliqa/settings/storage) → `SUPABASE_ACCESS_KEY_ID` / `SUPABASE_SECRET_ACCESS_KEY` (opcional para uploads)

## Opção A — Terminal / CLI (recomendada, sem MCP)

Conta CLI (`supabase login`) precisa ter acesso ao projeto `jqpbqrhlslgitifuliqa`. Se `supabase link` der 403, use URI + keys do Dashboard.

```bash
# 1. No Dashboard jqpb: service_role + Connection string Session :5432
# 2. Cole em .env.local:
#    MIGRATE_DEST_DATABASE_URI=postgresql://postgres.jqpbqrhlslgitifuliqa:...
#    SUPABASE_SERVICE_ROLE_KEY=...   # JWT com ref jqpb, NÃO exeuuqbgyfaxgbwygfuu
# 3. Valide:
npm run migrate:check-env

# 4. Import completo (schema + SQL + auth/storage):
npm run migrate:cli:complete
```

Import grande via API (opcional, sem psql):

```bash
# Account → Access Tokens → SUPABASE_ACCESS_TOKEN
export SUPABASE_ACCESS_TOKEN=sbp_...
npm run migrate:mcp:apply-cache
```

## Opção B — Automática (legado)

```bash
# 1. Preencha SUPABASE_SERVICE_ROLE_KEY e MIGRATE_DEST_DATABASE_URI no .env.local
# 2. Execute:
npm run migrate:supabase
```

Isso aplica o schema, importa tabelas, usuários Auth, `user_roles` e copia arquivos dos buckets.

## Opção C — SQL Editor (sem psql local)

1. Abra: https://supabase.com/dashboard/project/jqpbqrhlslgitifuliqa/sql/new
2. Cole o conteúdo de `data/supabase-migration/full-migration-bundle.sql` (regenere com `npm run migrate:supabase:sql-bundle` se necessário)
3. Execute o SQL
4. Com `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`, rode só a parte Auth/storage:

```bash
npm run migrate:supabase
```

(`user_roles` e storage exigem service role no destino.)

## Depois da migração

1. `npm run test:db`
2. `npm run setup:storage`
3. Atualize as mesmas variáveis na **Vercel** (Production + Preview)
4. `npm run dev` e teste login no `/cms`

## Vercel

Substitua no painel da Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URI`
- `SUPABASE_ENDPOINT` (host do novo projeto)
