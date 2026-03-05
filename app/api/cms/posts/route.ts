import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { auth } from '@/auth'

export async function GET(request: Request) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let data
    if (status && status !== 'all') {
        data = await sql`
            SELECT p.*, cat.name as category_name
            FROM posts p
            LEFT JOIN categories cat ON cat.id = p.category_id
            WHERE p.status = ${status}
            ORDER BY p.created_at DESC
        `
    } else {
        data = await sql`
            SELECT p.*, cat.name as category_name
            FROM posts p
            LEFT JOIN categories cat ON cat.id = p.category_id
            ORDER BY p.created_at DESC
        `
    }

    return NextResponse.json({ posts: data || [] })
}
