import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { sql } from '@/lib/db/client'
import { validateApiKey, generateSlug } from '@/lib/api-auth'

export async function GET(request: Request) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category_id = searchParams.get('category_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIdx = 1

    if (status) {
        conditions.push(`p.status = $${paramIdx++}`)
        params.push(status)
    }
    if (category_id) {
        conditions.push(`p.category_id = $${paramIdx++}`)
        params.push(category_id)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit, offset)

    const data = await sql(
        `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.status, p.published_at,
            p.featured_home, p.tags, p.meta_description, p.source_url, p.created_at, p.updated_at,
            cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
            col.id as col_id, col.name as col_name, col.slug as col_slug
        FROM posts p
        LEFT JOIN categories cat ON cat.id = p.category_id
        LEFT JOIN columnists col ON col.id = p.author_id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        params
    )

    return NextResponse.json({
        posts: (data || []).map((r: any) => ({
            ...r,
            category: r.cat_id ? { id: r.cat_id, name: r.cat_name, slug: r.cat_slug } : null,
            author: r.col_id ? { id: r.col_id, name: r.col_name, slug: r.col_slug } : null,
        })),
        pagination: { limit, offset, count: data?.length || 0 }
    })
}

export async function POST(request: Request) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido no corpo da requisição.' }, { status: 400 })
    }

    const { title, content, excerpt, cover_image_url, category_id, columnist_id, status, tags, featured_home, meta_description, source_url, published_at, slug } = body

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return NextResponse.json({ error: 'O campo "title" é obrigatório.' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim() === '') {
        return NextResponse.json({ error: 'O campo "content" é obrigatório.' }, { status: 400 })
    }

    const postStatus = ['draft', 'published', 'archived'].includes(status) ? status : 'draft'
    const postSlug = slug ? String(slug).trim() : generateSlug(title.trim())

    if (!postSlug) {
        return NextResponse.json({ error: 'Não foi possível gerar um slug válido para este título.' }, { status: 400 })
    }

    const postData: Record<string, unknown> = {
        title: title.trim(),
        slug: postSlug,
        content,
        status: postStatus,
        excerpt: excerpt || null,
        cover_image_url: cover_image_url || null,
        category_id: category_id || null,
        columnist_id: columnist_id || null,
        tags: Array.isArray(tags) ? tags : [],
        featured_home: Boolean(featured_home),
        meta_description: meta_description || null,
        source_url: source_url || null,
    }

    if (published_at) {
        const parsedDate = new Date(published_at)
        if (isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: 'Formato de "published_at" inválido. Use ISO 8601.' }, { status: 400 })
        }
        postData.published_at = parsedDate.toISOString()
    } else if (postStatus === 'published') {
        postData.published_at = new Date().toISOString()
    }

    try {
        const keys = Object.keys(postData)
        const values = Object.values(postData)
        const cols = keys.join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const rows = await sql(`INSERT INTO posts (${cols}) VALUES (${placeholders}) RETURNING *`, values)
        const data = rows[0]

        revalidatePath('/')
        if (postStatus === 'published') revalidatePath(`/posts/${data.slug}`)

        return NextResponse.json({ post: data }, { status: 201 })
    } catch (error: any) {
        let message = error.message
        if (error.code === '23505') message = 'Já existe um post com este slug.'
        if (error.code === '23503') message = 'O "category_id" ou "columnist_id" informado não existe.'
        return NextResponse.json({ error: message, code: error.code }, { status: 400 })
    }
}
