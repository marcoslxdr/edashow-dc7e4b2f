import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { auth } from '@/auth'

export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const banners = await sql`SELECT * FROM banners ORDER BY display_order ASC, created_at DESC`
    return NextResponse.json({ banners })
}
