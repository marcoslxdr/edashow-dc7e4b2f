/**
 * Gera um único arquivo SQL (schema + dados) para colar no SQL Editor do Supabase.
 * Requer export prévio: npm run migrate:supabase:export
 */
import fs from 'fs'
import path from 'path'

const BACKUP_DIR = path.join(process.cwd(), 'data', 'supabase-migration')
const OUT = path.join(process.cwd(), 'data', 'supabase-migration', 'full-migration-bundle.sql')

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  if (Array.isArray(value)) {
    const inner = value.map((v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)).join(',')
    return `ARRAY[${inner}]::text[]`
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

function main() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const parts: string[] = [
    '-- EdaShow: bundle gerado para novo projeto Supabase',
    '-- Execute no SQL Editor: https://supabase.com/dashboard/project/<ref>/sql/new',
    'BEGIN;',
    '',
  ]

  for (const file of migrationFiles) {
    parts.push(`-- ========== ${file} ==========`)
    parts.push(fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    parts.push('')
  }

  const manifestPath = path.join(BACKUP_DIR, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, number>
    parts.push('-- ========== DADOS (export) ==========')

    const skipTables = new Set(['user_roles'])
    parts.push(
      '-- user_roles: importe via npm run migrate:supabase (requer auth.users no destino)',
    )

    for (const [table, count] of Object.entries(manifest)) {
      if (!count || skipTables.has(table)) continue
      const file = path.join(BACKUP_DIR, `${table}.json`)
      if (!fs.existsSync(file)) continue

      const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[]
      if (!rows.length) continue

      parts.push(`\n-- ${table} (${rows.length} rows)`)
      const cols = Object.keys(rows[0])
      for (const row of rows) {
        const values = cols.map((c) => sqlLiteral(row[c]))
        parts.push(
          `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;`,
        )
      }
    }
  } else {
    parts.push('-- (sem dados: rode npm run migrate:supabase:export antes)')
  }

  parts.push('', 'COMMIT;')

  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  fs.writeFileSync(OUT, parts.join('\n'))
  console.log(`Bundle gerado: ${OUT}`)
  console.log(`Tamanho: ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`)
}

main()
