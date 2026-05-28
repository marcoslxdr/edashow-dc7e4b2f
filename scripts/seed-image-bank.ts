import dotenv from 'dotenv'
import path from 'path'
import { seedImageBank } from '../lib/images/image-bank-seed'

const root = process.cwd()
dotenv.config({ path: path.join(root, '.env.local'), override: true })
dotenv.config({ path: path.join(root, '.env') })

function requireEnv(name: string): void {
  if (!process.env[name]?.trim()) {
    console.error(
      `[IMAGE-BANK-SEED] Missing ${name}. Add it to .env.local (see .env.example).`
    )
    process.exit(1)
  }
}

async function main() {
  requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const categoryArg = args.find((a) => a.startsWith('--category='))
  const categorySlug = categoryArg?.split('=')[1]

  console.log('[IMAGE-BANK-SEED] starting', { dryRun, categorySlug })
  const results = await seedImageBank({ dryRun, categorySlug })
  console.log(JSON.stringify(results, null, 2))
  const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
  process.exit(totalInserted > 0 || dryRun ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
