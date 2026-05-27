/**
 * Migração completa entre projetos Supabase (schema + dados + auth + storage).
 *
 * Variáveis ( .env.local ):
 *   MIGRATE_SOURCE_URL, MIGRATE_SOURCE_SERVICE_ROLE_KEY  — origem (padrão: .env atual)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — destino (novo projeto)
 *   MIGRATE_DEST_DATABASE_URI — opcional; aplica SQL via psql/pg (recomendado)
 *
 * Uso:
 *   npm run migrate:supabase:export   # só exporta JSON em data/supabase-migration/
 *   npm run migrate:supabase            # schema + import + storage
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import pg from 'pg'
import { spawnSync } from 'child_process'

dotenv.config({ path: '.env.local', override: true })

const BACKUP_DIR = path.join(process.cwd(), 'data', 'supabase-migration')

const DATA_TABLES_ORDER = [
  'categories',
  'columnists',
  'media',
  'posts',
  'events',
  'sponsors',
  'theme_settings',
  'user_roles',
  'banners',
  'image_settings',
  'youtube_config',
  'ai_settings',
  'ai_prompts',
  'ai_generations',
  'ai_personas',
  'ai_knowledge_blocks',
  'scheduled_posts',
  'newsletters',
  'newsletter_schedules',
  'content_sources',
  'keyword_groups',
  'draft_preview_tokens',
  'event_photo_galleries',
  'event_photos',
  'event_videos',
] as const

const STORAGE_BUCKETS = ['media', 'edashow-media', 'sponsors', 'event-photos-public', 'event-photos-original'] as const

function projectRefFromUrl(url: string): string {
  return new URL(url).hostname.split('.')[0] ?? ''
}

function resolveSource(): { url: string; key: string } {
  const url = process.env.MIGRATE_SOURCE_URL?.trim() || process.env.MIGRATE_SOURCE_SUPABASE_URL?.trim()
  const key =
    process.env.MIGRATE_SOURCE_SERVICE_ROLE_KEY?.trim() ||
    process.env.MIGRATE_SOURCE_SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (url && key) return { url, key }

  const legacyUrl = process.env.LEGACY_SUPABASE_URL?.trim()
  const legacyKey = process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (legacyUrl && legacyKey) return { url: legacyUrl, key: legacyKey }

  // Fallback: export usando credenciais antigas ainda presentes no .env.local
  const fallbackUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const fallbackKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const fallbackRef = fallbackUrl ? projectRefFromUrl(fallbackUrl) : ''
  if (
    fallbackUrl &&
    fallbackKey &&
    fallbackRef &&
    fallbackRef !== 'jqpbqrhlslgitifuliqa'
  ) {
    return { url: fallbackUrl, key: fallbackKey }
  }

  throw new Error(
    'Defina MIGRATE_SOURCE_URL e MIGRATE_SOURCE_SERVICE_ROLE_KEY (projeto antigo) em .env.local.',
  )
}

function resolveDest(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (secret do novo projeto) em .env.local.',
    )
  }
  return { url, key }
}

function pgSsl() {
  return { rejectUnauthorized: false, checkServerIdentity: () => undefined } as const
}

async function connectPg(uri: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: uri, ssl: pgSsl() })
  await client.connect()
  return client
}

function listMigrationFiles(): string[] {
  const dir = path.join(process.cwd(), 'supabase', 'migrations')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

async function applySchemaWithPg(uri: string) {
  const files = listMigrationFiles()
  console.log(`\n📐 Aplicando ${files.length} migrações SQL no destino...`)
  for (const file of files) {
    const full = path.join(process.cwd(), 'supabase', 'migrations', file)
    console.log(`   → ${file}`)
    const r = spawnSync('psql', [uri, '-v', 'ON_ERROR_STOP=1', '-f', full], { stdio: 'inherit' })
    if (r.status !== 0) {
      throw new Error(`Falha ao aplicar ${file}`)
    }
  }
}

async function applySchemaWithPgClient(client: pg.Client) {
  const files = listMigrationFiles()
  console.log(`\n📐 Aplicando ${files.length} migrações SQL (pg client)...`)
  for (const file of files) {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', file), 'utf8')
    console.log(`   → ${file}`)
    await client.query(sql)
  }
}

async function fetchAllRows(supabase: SupabaseClient, table: string): Promise<Record<string, unknown>[]> {
  const pageSize = 500
  let from = 0
  const rows: Record<string, unknown>[] = []

  for (;;) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1)
    if (error) {
      if (error.message.includes('Could not find the table')) return []
      throw new Error(`${table}: ${error.message}`)
    }
    if (!data?.length) break
    rows.push(...(data as Record<string, unknown>[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function exportData(source: SupabaseClient) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const manifest: Record<string, number> = {}

  console.log(`\n📤 Exportando dados para ${BACKUP_DIR}`)

  for (const table of DATA_TABLES_ORDER) {
    const rows = await fetchAllRows(source, table)
    manifest[table] = rows.length
    if (rows.length === 0) continue
    fs.writeFileSync(path.join(BACKUP_DIR, `${table}.json`), JSON.stringify(rows, null, 2))
    console.log(`   ${table}: ${rows.length}`)
  }

  fs.writeFileSync(path.join(BACKUP_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('\n✅ Export concluído.')
}

async function loadAuthUsers(source: SupabaseClient): Promise<
  Array<{
    id: string
    email?: string
    phone?: string
    user_metadata?: Record<string, unknown>
    app_metadata?: Record<string, unknown>
  }>
> {
  const file = path.join(BACKUP_DIR, 'auth-users.json')
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{
      id: string
      email?: string
      phone?: string
      user_metadata?: Record<string, unknown>
      app_metadata?: Record<string, unknown>
    }>
  }

  const users: Array<{
    id: string
    email?: string
    phone?: string
    user_metadata?: Record<string, unknown>
    app_metadata?: Record<string, unknown>
  }> = []
  let page = 1

  for (;;) {
    const { data, error } = await source.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const batch = data.users ?? []
    users.push(...batch)
    if (batch.length < 100) break
    page++
  }

  return users
}

async function migrateAuthUsers(source: SupabaseClient, dest: SupabaseClient) {
  console.log('\n👤 Migrando usuários Auth...')
  const users = await loadAuthUsers(source)
  let total = 0

  for (const user of users) {
    const payload = {
      id: user.id,
      email: user.email,
      email_confirm: true,
      phone: user.phone,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    }

    const { error: createErr } = await dest.auth.admin.createUser(payload)
    if (createErr && !createErr.message.toLowerCase().includes('already')) {
      console.warn(`   ⚠ ${user.email ?? user.id}: ${createErr.message}`)
    } else {
      total++
    }
  }

  console.log(`   ${total} usuário(s) processado(s).`)
}

async function importTable(dest: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return

  const chunk = 100
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await dest.from(table).upsert(slice, { onConflict: 'id' })
    if (error) throw new Error(`${table} upsert: ${error.message}`)
  }
}

function rewriteStorageHost(value: unknown, oldHost: string, newHost: string): unknown {
  if (typeof value === 'string' && value.includes(oldHost)) {
    return value.replaceAll(oldHost, newHost)
  }
  return value
}

function rewriteRowUrls(row: Record<string, unknown>, oldHost: string, newHost: string) {
  for (const key of Object.keys(row)) {
    row[key] = rewriteStorageHost(row[key], oldHost, newHost)
  }
}

async function importData(dest: SupabaseClient, sourceUrl: string, destUrl: string) {
  const manifestPath = path.join(BACKUP_DIR, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup não encontrado. Rode: npm run migrate:supabase:export`)
  }

  const oldHost = new URL(sourceUrl).host
  const newHost = new URL(destUrl).host

  console.log('\n📥 Importando dados no destino...')

  for (const table of DATA_TABLES_ORDER) {
    const file = path.join(BACKUP_DIR, `${table}.json`)
    if (!fs.existsSync(file)) continue

    const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[]
    if (!rows.length) continue

    if (['posts', 'media', 'events', 'theme_settings', 'sponsors'].includes(table)) {
      rows.forEach((r) => rewriteRowUrls(r, oldHost, newHost))
    }

    await importTable(dest, table, rows)
    console.log(`   ${table}: ${rows.length}`)
  }

  console.log('\n✅ Import de tabelas concluído.')
}

async function listAllStoragePaths(
  supabase: SupabaseClient,
  bucket: string,
  prefix = '',
): Promise<string[]> {
  const out: string[] = []
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) {
    if (error.message.toLowerCase().includes('not found')) return []
    throw error
  }

  for (const item of data ?? []) {
    const p = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id) {
      out.push(p)
    } else {
      out.push(...(await listAllStoragePaths(supabase, bucket, p)))
    }
  }
  return out
}

async function ensureBucket(dest: SupabaseClient, bucket: string) {
  const { data: buckets } = await dest.storage.listBuckets()
  if (buckets?.some((b) => b.name === bucket)) return

  const { error } = await dest.storage.createBucket(bucket, { public: true })
  if (error && !error.message.includes('already exists')) {
    throw new Error(`bucket ${bucket}: ${error.message}`)
  }
}

async function migrateStorage(source: SupabaseClient, dest: SupabaseClient) {
  console.log('\n🖼️  Migrando Storage...')

  for (const bucket of STORAGE_BUCKETS) {
    await ensureBucket(dest, bucket)
    const paths = await listAllStoragePaths(source, bucket)
    if (!paths.length) {
      console.log(`   ${bucket}: vazio`)
      continue
    }

    let copied = 0
    for (const objectPath of paths) {
      const { data: blob, error: dlErr } = await source.storage.from(bucket).download(objectPath)
      if (dlErr || !blob) {
        console.warn(`   ⚠ download ${bucket}/${objectPath}: ${dlErr?.message}`)
        continue
      }

      const buf = Buffer.from(await blob.arrayBuffer())
      const { error: upErr } = await dest.storage.from(bucket).upload(objectPath, buf, {
        upsert: true,
        contentType: blob.type || undefined,
      })
      if (upErr) {
        console.warn(`   ⚠ upload ${bucket}/${objectPath}: ${upErr.message}`)
        continue
      }
      copied++
    }
    console.log(`   ${bucket}: ${copied}/${paths.length} arquivo(s)`)
  }
}

async function verifyDest(dest: SupabaseClient) {
  const checks = ['posts', 'categories', 'user_roles'] as const
  console.log('\n🔍 Verificação no destino:')
  for (const table of checks) {
    const { count, error } = await dest.from(table).select('*', { count: 'exact', head: true })
    if (error) console.log(`   ${table}: ERRO ${error.message}`)
    else console.log(`   ${table}: ${count ?? 0} registro(s)`)
  }
}

async function main() {
  const mode = process.argv[2] ?? 'full'
  const sourceCfg = resolveSource()
  const source = createClient(sourceCfg.url, sourceCfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (mode === 'export') {
    await exportData(source)
    return
  }

  const destCfg = resolveDest()
  const dest = createClient(destCfg.url, destCfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const destRef = projectRefFromUrl(destCfg.url)
  const sourceRef = projectRefFromUrl(sourceCfg.url)
  console.log(`Origem: ${sourceRef} → Destino: ${destRef}`)

  if (!fs.existsSync(path.join(BACKUP_DIR, 'manifest.json'))) {
    await exportData(source)
  }

  const destDbUri =
    process.env.MIGRATE_DEST_DATABASE_URI?.trim() ||
    (process.env.DATABASE_URI?.includes(destRef) ? process.env.DATABASE_URI.trim() : '')

  if (destDbUri) {
    if (spawnSync('which', ['psql']).status === 0) {
      await applySchemaWithPg(destDbUri)
    } else {
      const client = await connectPg(destDbUri)
      try {
        await applySchemaWithPgClient(client)
      } finally {
        await client.end()
      }
    }
  } else {
    console.warn(
      '\n⚠️  MIGRATE_DEST_DATABASE_URI não definida — pulando DDL.\n' +
        '   Cole supabase/migrations/*.sql no SQL Editor do novo projeto ou defina a URI Session :5432.\n',
    )
  }

  await migrateAuthUsers(source, dest)
  await importData(dest, sourceCfg.url, destCfg.url)
  await migrateStorage(source, dest)
  await verifyDest(dest)

  console.log('\n🎉 Migração finalizada. Atualize Vercel com as mesmas variáveis do .env.local.')
}

main().catch((err) => {
  console.error('\n❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
