import { NextResponse } from 'next/server'
import { seedImageBank } from '@/lib/images/image-bank-seed'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[IMAGE-BANK-SEED] cron started')
  const results = await seedImageBank()
  const summary = {
    categories: results.length,
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    skipped: results.reduce((s, r) => s + r.skipped, 0),
    errors: results.flatMap((r) => r.errors),
    timestamp: new Date().toISOString(),
  }
  console.log('[IMAGE-BANK-SEED] cron done', summary)
  return NextResponse.json({ success: true, results, summary })
}
