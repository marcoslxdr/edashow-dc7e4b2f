/**
 * Aplica migrações SQL de eventos (galeria, buckets, drive, vídeos).
 *
 * Uso:
 *   npm run migrate:events        → tenta conectar e aplicar
 *   npm run migrate:events:sql    → imprime SQL para colar no Supabase SQL Editor
 *
 * .env.local:
 *   DATABASE_URI — copie do Supabase (Connect → URI, Session :5432)
 *   Opcional: SUPABASE_POOLER_HOST=aws-1-sa-east-1.pooler.supabase.com
 */
import fs from 'fs'
import path from 'path'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

export const EVENT_MIGRATIONS = [
    '20260514_create_event_photo_tables.sql',
    '20260514_create_photo_buckets.sql',
    '20260526_event_gallery_drive_and_videos.sql',
] as const

const SA_EAST_POOLER_HOSTS = [
    'aws-1-sa-east-1.pooler.supabase.com',
    'aws-0-sa-east-1.pooler.supabase.com',
] as const

function parsePgUrl(uri: string): URL | null {
    try {
        return new URL(uri.replace(/^postgresql:\/\//, 'http://'))
    } catch {
        return null
    }
}

function labelConnection(uri: string): string {
    const u = parsePgUrl(uri)
    if (!u) return 'connection string'
    if (u.port === '6543') return `pooler transaction :6543 (${u.hostname})`
    if (u.port === '5432' && u.hostname.includes('pooler')) {
        return `pooler session :5432 (${u.hostname})`
    }
    if (u.hostname.startsWith('db.')) return `direct :5432 (${u.hostname})`
    return `${u.hostname}:${u.port || '5432'}`
}

function extractProjectRef(parsed: URL, baseUri: string): string | null {
    const user = parsed.username || ''
    if (user.startsWith('postgres.')) return user.slice('postgres.'.length)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    if (supabaseUrl) {
        try {
            return new URL(supabaseUrl).hostname.split('.')[0] || null
        } catch {
            /* ignore */
        }
    }

    const m = baseUri.match(/postgres\.([a-z0-9]+)/i)
    return m?.[1] ?? null
}

/** Gera URIs alternativas (host do pooler costuma ser aws-1, não aws-0). */
export function buildConnectionCandidates(): string[] {
    const out: string[] = []
    const add = (uri: string) => {
        const t = uri.trim()
        if (t && !out.includes(t)) out.push(t)
    }

    for (const key of ['DATABASE_DIRECT_URI', 'SUPABASE_DB_URL', 'DATABASE_URI'] as const) {
        const v = process.env[key]?.trim()
        if (v) add(v)
    }

    const base = process.env.DATABASE_URI?.trim()
    if (!base) return out

    const parsed = parsePgUrl(base)
    if (!parsed?.password) return out

    const password = decodeURIComponent(parsed.password)
    const encodedPassword = encodeURIComponent(password)
    const projectRef = extractProjectRef(parsed, base)
    const customPooler = process.env.SUPABASE_POOLER_HOST?.trim()

    const poolerHosts = [
        ...(customPooler ? [customPooler] : []),
        ...(parsed.hostname.includes('pooler') ? [parsed.hostname] : []),
        ...SA_EAST_POOLER_HOSTS,
    ].filter((h, i, arr) => h && arr.indexOf(h) === i)

    if (parsed.port === '6543' && parsed.hostname.includes('pooler')) {
        add(base.replace(`@${parsed.hostname}:6543`, `@${parsed.hostname}:5432`))
    }

    if (projectRef) {
        for (const host of poolerHosts) {
            add(`postgresql://postgres.${projectRef}:${encodedPassword}@${host}:5432/postgres`)
            add(`postgresql://postgres.${projectRef}:${encodedPassword}@${host}:6543/postgres`)
        }
        add(`postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`)
    }

    return out
}

async function verify(client: pg.Client) {
    const { rows: tables } = await client.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('event_photo_galleries', 'event_photos', 'event_videos')
    `)
    const names = new Set(tables.map((r) => r.table_name))

    const { rows: cols } = await client.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'event_photo_galleries'
          AND column_name = 'drive_download_url'
    `)

    const ok =
        names.has('event_photo_galleries') &&
        names.has('event_photos') &&
        names.has('event_videos') &&
        cols.length > 0

    if (!ok) {
        throw new Error(
            'Verificação falhou: tabelas/colunas esperadas não encontradas após as migrações.',
        )
    }
}

export async function connectWithFallback(): Promise<{ client: pg.Client; mode: string }> {
    const candidates = buildConnectionCandidates()
    if (!candidates.length) {
        throw new Error('Defina DATABASE_URI em .env.local.')
    }

    const errors: string[] = []

    for (const uri of candidates) {
        const client = new pg.Client({
            connectionString: uri,
            ssl: {
                rejectUnauthorized: false,
                checkServerIdentity: () => undefined,
            },
        })
        try {
            await client.connect()
            return { client, mode: labelConnection(uri) }
        } catch (err) {
            await client.end().catch(() => {})
            const msg = err instanceof Error ? err.message : String(err)
            errors.push(`  • ${labelConnection(uri)}: ${msg}`)
        }
    }

    const err = new Error(
        'Não foi possível conectar ao Postgres.\n\nTentativas:\n' +
            errors.join('\n') +
            '\n\nCorreção:\n' +
            '1. Supabase Dashboard → Project Settings → Database → Reset database password\n' +
            '2. Copie a URI em "Session mode" (porta 5432) — confira o host (ex.: aws-1-sa-east-1...)\n' +
            '3. Atualize DATABASE_URI em .env.local\n' +
            '4. Ou rode: npm run migrate:events:sql e cole no SQL Editor',
    )
    ;(err as Error & { attempts?: string[] }).attempts = errors
    throw err
}

export function loadEventMigrationsSql(): string {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    return EVENT_MIGRATIONS.map((file) => {
        const full = path.join(migrationsDir, file)
        if (!fs.existsSync(full)) throw new Error(`Arquivo não encontrado: ${full}`)
        return `-- ========== ${file} ==========\n${fs.readFileSync(full, 'utf8')}`
    }).join('\n\n')
}

async function main() {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
    const { client, mode } = await connectWithFallback()

    try {
        console.log(`Conectado (${mode}).\n`)

        for (const file of EVENT_MIGRATIONS) {
            const full = path.join(migrationsDir, file)
            const sql = fs.readFileSync(full, 'utf8')
            console.log(`>>> ${file}`)
            await client.query(sql)
            console.log('    OK\n')
        }

        await verify(client)
        console.log('Migrações de eventos aplicadas e verificadas.')
        console.log('  - event_photo_galleries (+ drive_download_url)')
        console.log('  - event_photos, event_videos')
        console.log('  - buckets event-photos-original / event-photos-public')
    } finally {
        await client.end().catch(() => {})
    }
}

main().catch((err) => {
    console.error('\n' + (err instanceof Error ? err.message : err))
    process.exit(1)
})
