import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query) {
        return NextResponse.json({ docs: [] })
    }

    try {
        const searchTerm = `%${query}%`
        const data = await sql`
            SELECT p.*,
                cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
                col.id as col_id, col.name as col_name, col.slug as col_slug
            FROM posts p
            LEFT JOIN categories cat ON cat.id = p.category_id
            LEFT JOIN columnists col ON col.id = p.author_id
            WHERE p.status = 'published'
            AND (p.title ILIKE ${searchTerm} OR p.excerpt ILIKE ${searchTerm})
            LIMIT 20
        `

        return NextResponse.json({
            docs: (data || []).map((r: any) => ({
                ...r,
                category: r.cat_id ? { id: r.cat_id, name: r.cat_name, slug: r.cat_slug } : null,
                author: r.col_id ? { id: r.col_id, name: r.col_name, slug: r.col_slug } : null,
            }))
        })
    } catch (error) {
        console.error('Erro na API de busca:', error)
        return NextResponse.json({ error: 'Erro ao processar busca' }, { status: 500 })
    }
}
