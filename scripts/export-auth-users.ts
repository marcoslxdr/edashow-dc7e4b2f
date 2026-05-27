import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: '.env.local', override: true })

const OUT = path.join(process.cwd(), 'data', 'supabase-migration', 'auth-users.json')

async function main() {
  const url = process.env.MIGRATE_SOURCE_URL?.trim()
  const key = process.env.MIGRATE_SOURCE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Defina MIGRATE_SOURCE_URL e MIGRATE_SOURCE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const users: unknown[] = []
  let page = 1

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const batch = data.users ?? []
    users.push(...batch)
    if (batch.length < 100) break
    page++
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(users, null, 2))
  console.log(`Exportados ${users.length} usuário(s) → ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
