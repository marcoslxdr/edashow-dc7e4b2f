import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { auth } from '@/auth'

export async function GET() {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [postsCount, eventsCount, sponsorsCount, subscribersCount, recentPosts] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM posts`,
        sql`SELECT COUNT(*) as count FROM events`,
        sql`SELECT COUNT(*) as count FROM sponsors`,
        sql`SELECT COUNT(*) as count FROM newsletter_subscribers`.catch(() => [{ count: 0 }]),
        sql`SELECT id, title, status, created_at, slug, cover_image_url FROM posts ORDER BY created_at DESC LIMIT 5`
    ])

    return NextResponse.json({
        posts: parseInt(postsCount[0]?.count || '0'),
        events: parseInt(eventsCount[0]?.count || '0'),
        sponsors: parseInt(sponsorsCount[0]?.count || '0'),
        subscribers: parseInt(subscribersCount[0]?.count || '0'),
        recentPosts: recentPosts || []
    })
}
