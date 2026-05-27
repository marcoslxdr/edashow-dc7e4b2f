/**
 * Lê .cache/mcp_invoke/*.json e imprime cada arquivo para stdout com marcadores.
 * Uso interno: o agente lê a saída e chama MCP execute_sql.
 * Para automação local com PAT: npm run migrate:mcp:apply (requer SUPABASE_ACCESS_TOKEN)
 */
import fs from 'fs'
import path from 'path'

const DIR = path.join(process.cwd(), '.cache', 'mcp_invoke')

async function runQuery(sql: string, token: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/jqpbqrhlslgitifuliqa/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`)
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN ausente')
    process.exit(1)
  }

  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))

  for (const file of files) {
    const { query } = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')) as {
      query: string
    }
    process.stdout.write(`>>> ${file}\n`)
    await runQuery(query, token)
    console.log('OK')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
