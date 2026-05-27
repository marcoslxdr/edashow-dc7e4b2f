/**
 * Gera SQL de import por tabela para usar com Supabase MCP execute_sql.
 */
import fs from 'fs'
import path from 'path'

const BACKUP = path.join(process.cwd(), 'data', 'supabase-migration')
const OUT_DIR = path.join(BACKUP, 'mcp-import')
const OLD_HOST = 'exeuuqbgyfaxgbwygfuu.supabase.co'
const NEW_HOST = 'jqpbqrhlslgitifuliqa.supabase.co'

const ORDER = [
  'categories',
  'columnists',
  'media',
  'posts',
  'sponsors',
  'theme_settings',
] as const

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `'{}'::text[]`
    const items = value.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',')
    return `ARRAY[${items}]::text[]`
  }
  let s = String(value)
  if (s.includes(OLD_HOST)) s = s.replaceAll(OLD_HOST, NEW_HOST)
  return `'${s.replace(/'/g, "''")}'`
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const table of ORDER) {
    const file = path.join(BACKUP, `${table}.json`)
    if (!fs.existsSync(file)) continue

    const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[]
    if (!rows.length) continue

    const cols = Object.keys(rows[0])
    const lines: string[] = [`-- ${table} (${rows.length})`, 'BEGIN;']

    for (const row of rows) {
      const vals = cols.map((c) => sqlValue(row[c]))
      lines.push(
        `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${cols.filter((c) => c !== 'id').map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')};`,
      )
    }

    const chunkSize = table === 'posts' ? 5 : rows.length
    if (chunkSize >= rows.length) {
      lines.push('COMMIT;')
      const out = path.join(OUT_DIR, `${table}.sql`)
      fs.writeFileSync(out, lines.join('\n'))
      console.log(`${table}: ${rows.length} rows → ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`)
      continue
    }

    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize)
      const chunkLines: string[] = [`-- ${table} chunk ${i / chunkSize + 1}`, 'BEGIN;']
      for (const row of slice) {
        const vals = cols.map((c) => sqlValue(row[c]))
        chunkLines.push(
          `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${cols.filter((c) => c !== 'id').map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')};`,
        )
      }
      chunkLines.push('COMMIT;')
      const out = path.join(OUT_DIR, `${table}_${String(i / chunkSize + 1).padStart(3, '0')}.sql`)
      fs.writeFileSync(out, chunkLines.join('\n'))
      console.log(`  chunk → ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`)
    }
    console.log(`${table}: ${rows.length} rows em ${Math.ceil(rows.length / chunkSize)} arquivo(s)`)
  }
}

main()
