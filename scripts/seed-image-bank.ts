import 'dotenv/config'
import { seedImageBank } from '../lib/images/image-bank-seed'

async function main() {
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
