import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { validateApiKey, generateSlug } from '@/lib/api-auth'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/posts/[id]
 * Retorna um post específico pelo ID.
 *
 * Headers:
 *   Authorization: Bearer <POSTS_API_KEY>
 */
export async function GET(request: Request, context: RouteContext) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    const { id } = await context.params
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('posts')
        .select(`
            *,
            category:categories(id, name, slug),
            author:columnists(id, name, slug, bio, photo_url)
        `)
        .eq('id', id)
        .single()

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ post: data })
}

/**
 * PUT /api/posts/[id]
 * Atualiza um post existente (parcialmente – envie apenas os campos a alterar).
 *
 * Headers:
 *   Authorization: Bearer <POSTS_API_KEY>
 *   Content-Type: application/json
 *
 * Body (JSON) – todos os campos são opcionais:
 *   title           string
 *   content         string   (HTML ou texto)
 *   excerpt         string
 *   cover_image_url string
 *   category_id     string   UUID
 *   columnist_id    string   UUID
 *   status          string   "draft" | "published" | "archived"
 *   tags            array    ["tag1", "tag2"]
 *   featured_home   boolean
 *   source_url      string
 *   published_at    string   ISO 8601
 *   slug            string
 */
export async function PUT(request: Request, context: RouteContext) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    const { id } = await context.params

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido no corpo da requisição.' }, { status: 400 })
    }

    if (Object.keys(body).length === 0) {
        return NextResponse.json({ error: 'Nenhum campo enviado para atualização.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch current post to verify existence and get current slug
    const { data: current, error: fetchError } = await supabase
        .from('posts')
        .select('id, slug, status, published_at')
        .eq('id', id)
        .single()

    if (fetchError || !current) {
        return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 })
    }

    const updateData: any = {}

    if (body.title !== undefined) {
        if (typeof body.title !== 'string' || body.title.trim() === '') {
            return NextResponse.json({ error: '"title" não pode ser vazio.' }, { status: 400 })
        }
        updateData.title = body.title.trim()
    }

    if (body.content !== undefined) updateData.content = body.content
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt || null
    if (body.cover_image_url !== undefined) updateData.cover_image_url = body.cover_image_url || null
    if (body.category_id !== undefined) updateData.category_id = body.category_id || null
    if (body.columnist_id !== undefined) updateData.columnist_id = body.columnist_id || null
    if (body.source_url !== undefined) updateData.source_url = body.source_url || null
    if (body.featured_home !== undefined) updateData.featured_home = Boolean(body.featured_home)
    if (body.tags !== undefined) updateData.tags = Array.isArray(body.tags) ? body.tags : []

    if (body.status !== undefined) {
        if (!['draft', 'published', 'archived'].includes(body.status)) {
            return NextResponse.json({ error: '"status" deve ser "draft", "published" ou "archived".' }, { status: 400 })
        }
        updateData.status = body.status
        // Auto-set published_at when publishing for the first time
        if (body.status === 'published' && !current.published_at) {
            updateData.published_at = new Date().toISOString()
        }
    }

    if (body.published_at !== undefined) {
        const parsedDate = new Date(body.published_at)
        if (isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: '"published_at" inválido. Use ISO 8601.' }, { status: 400 })
        }
        updateData.published_at = parsedDate.toISOString()
    }

    if (body.slug !== undefined) {
        updateData.slug = String(body.slug).trim()
    } else if (body.title !== undefined) {
        // Auto-update slug only if title changed and no explicit slug was provided
        updateData.slug = generateSlug(updateData.title)
    }

    const { data, error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        let message = error.message
        if (error.code === '23505') message = 'Já existe um post com este slug.'
        if (error.code === '23503') message = 'O "category_id" ou "columnist_id" informado não existe.'
        return NextResponse.json({ error: message, code: error.code }, { status: 400 })
    }

    revalidatePath('/')
    revalidatePath(`/posts/${data.slug}`)
    if (current.slug !== data.slug) {
        revalidatePath(`/posts/${current.slug}`)
    }

    return NextResponse.json({ post: data })
}

/**
 * DELETE /api/posts/[id]
 * Remove um post permanentemente.
 *
 * Headers:
 *   Authorization: Bearer <POSTS_API_KEY>
 */
export async function DELETE(request: Request, context: RouteContext) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    const { id } = await context.params
    const supabase = createAdminClient()

    const { data: current } = await supabase
        .from('posts')
        .select('slug')
        .eq('id', id)
        .single()

    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id)

    if (error) {
        if (error.code === '22P02') {
            return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/')
    if (current?.slug) {
        revalidatePath(`/posts/${current.slug}`)
    }

    return NextResponse.json({ success: true, message: 'Post excluído com sucesso.' })
}
