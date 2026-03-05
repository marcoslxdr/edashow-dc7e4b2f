import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { sql } from '@/lib/db/client'
import { validateApiKey, generateSlug } from '@/lib/api-auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    const { id } = await context.params
    const rows = await sql`
        SELECT p.*,
            cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
            col.id as col_id, col.name as col_name, col.slug as col_slug, col.bio as col_bio, col.photo_url as col_photo_url
        FROM posts p
        LEFT JOIN categories cat ON cat.id = p.category_id
        LEFT JOIN columnists col ON col.id = p.author_id
        WHERE p.id = ${id} LIMIT 1
    `

    if (!rows || rows.length === 0) {
        return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 })
    }
    const r = rows[0]
    return NextResponse.json({
        post: {
            ...r,
            category: r.cat_id ? { id: r.cat_id, name: r.cat_name, slug: r.cat_slug } : null,
            author: r.col_id ? { id: r.col_id, name: r.col_name, slug: r.col_slug, bio: r.col_bio, photo_url: r.col_photo_url } : null,
        }
    })
}

export async function PUT(request: Request, context: RouteContext) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    const { id } = await context.params

    let body: any
    try { body = await request.json() } catch {
        return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
    }

    if (Object.keys(body).length === 0) {
        return NextResponse.json({ error: 'Nenhum campo enviado para atualização.' }, { status: 400 })
    }

    const currentRows = await sql`SELECT id, slug, status, published_at FROM posts WHERE id = ${id} LIMIT 1`
    if (!currentRows || currentRows.length === 0) {
        return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 })
    }
    const current = currentRows[0]

    const updateData: any = {}
    if (body.title !== undefined) {
        if (typeof body.title !== 'string' || body.title.trim() === '') return NextResponse.json({ error: '"title" não pode ser vazio.' }, { status: 400 })
        updateData.title = body.title.trim()
    }
    if (body.content !== undefined) updateData.content = body.content
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt || null
    if (body.cover_image_url !== undefined) updateData.cover_image_url = body.cover_image_url || null
    if (body.category_id !== undefined) updateData.category_id = body.category_id || null
    if (body.columnist_id !== undefined) updateData.columnist_id = body.columnist_id || null
    if (body.meta_description !== undefined) updateData.meta_description = body.meta_description || null
    if (body.source_url !== undefined) updateData.source_url = body.source_url || null
    if (body.featured_home !== undefined) updateData.featured_home = Boolean(body.featured_home)
    if (body.tags !== undefined) updateData.tags = Array.isArray(body.tags) ? body.tags : []
    if (body.status !== undefined) {
        if (!['draft', 'published', 'archived'].includes(body.status)) return NextResponse.json({ error: '"status" inválido.' }, { status: 400 })
        updateData.status = body.status
        if (body.status === 'published' && !current.published_at) updateData.published_at = new Date().toISOString()
    }
    if (body.published_at !== undefined) {
        const parsedDate = new Date(body.published_at)
        if (isNaN(parsedDate.getTime())) return NextResponse.json({ error: '"published_at" inválido.' }, { status: 400 })
        updateData.published_at = parsedDate.toISOString()
    }
    if (body.slug !== undefined) updateData.slug = String(body.slug).trim()
    else if (body.title !== undefined) updateData.slug = generateSlug(updateData.title)

    try {
        const keys = Object.keys(updateData)
        const values = Object.values(updateData)
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
        const rows = await sql(`UPDATE posts SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
        const data = rows[0]

        revalidatePath('/')
        revalidatePath(`/posts/${data.slug}`)
        if (current.slug !== data.slug) revalidatePath(`/posts/${current.slug}`)

        return NextResponse.json({ post: data })
    } catch (error: any) {
        let message = error.message
        if (error.code === '23505') message = 'Já existe um post com este slug.'
        return NextResponse.json({ error: message }, { status: 400 })
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    const { id } = await context.params
    const currentRows = await sql`SELECT slug FROM posts WHERE id = ${id} LIMIT 1`
    const current = currentRows?.[0]

    await sql`DELETE FROM posts WHERE id = ${id}`

    revalidatePath('/')
    if (current?.slug) revalidatePath(`/posts/${current.slug}`)

    return NextResponse.json({ success: true, message: 'Post excluído com sucesso.' })
}
