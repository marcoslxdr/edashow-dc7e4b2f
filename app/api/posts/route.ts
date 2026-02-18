import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { validateApiKey, generateSlug } from '@/lib/api-auth'

/**
 * GET /api/posts
 * Lista posts com filtros opcionais.
 *
 * Query params:
 *   status       - "draft" | "published" | "archived"
 *   category_id  - UUID da categoria
 *   limit        - número de resultados (padrão: 20, máx: 100)
 *   offset       - paginação (padrão: 0)
 *
 * Headers:
 *   Authorization: Bearer <POSTS_API_KEY>
 */
export async function GET(request: Request) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category_id = searchParams.get('category_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    const supabase = createAdminClient()

    let query = supabase
        .from('posts')
        .select(`
            id, title, slug, excerpt, cover_image_url, status, published_at,
            featured_home, tags, source_url, created_at, updated_at,
            category:categories(id, name, slug),
            author:columnists(id, name, slug)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (category_id) query = query.eq('category_id', category_id)

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        posts: data || [],
        pagination: {
            limit,
            offset,
            count: data?.length || 0
        }
    })
}

/**
 * POST /api/posts
 * Cria um novo post.
 *
 * Headers:
 *   Authorization: Bearer <POSTS_API_KEY>
 *   Content-Type: application/json
 *
 * Body (JSON):
 *   title           string  OBRIGATÓRIO
 *   content         string  OBRIGATÓRIO  (HTML ou texto)
 *   excerpt         string  opcional     (resumo curto)
 *   cover_image_url string  opcional     (URL da imagem destaque)
 *   category_id     string  opcional     (UUID da categoria)
 *   columnist_id    string  opcional     (UUID do colunista/autor)
 *   status          string  opcional     "draft" | "published" | "archived" (padrão: "draft")
 *   tags            array   opcional     ["tag1", "tag2"]
 *   featured_home   boolean opcional     (destaque na homepage)
 *   source_url      string  opcional     (URL da fonte original)
 *   published_at    string  opcional     (ISO 8601, padrão: agora se status=published)
 *   slug            string  opcional     (gerado automaticamente do título se omitido)
 */
export async function POST(request: Request) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'JSON inválido no corpo da requisição.' }, { status: 400 })
    }

    const { title,
        content,
        excerpt,
        cover_image_url,
        category_id,
        columnist_id,
        status,
        tags,
        featured_home,
        source_url,
        published_at,
        slug, } = body

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return NextResponse.json({ error: 'O campo "title" é obrigatório.' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim() === '') {
        return NextResponse.json({ error: 'O campo "content" é obrigatório.' }, { status: 400 })
    }

    const postStatus = 'draft'
    const postSlug = slug ? String(slug).trim() : generateSlug(title.trim())

    if (!postSlug) {
        return NextResponse.json({ error: 'Não foi possível gerar um slug válido para este título.' }, { status: 400 })
    }

    const postData: any = {
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
        source_url: source_url || null,
    }

    if (published_at) {
        const parsedDate = new Date(published_at)
        if (isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: 'Formato de "published_at" inválido. Use ISO 8601 (ex: 2025-01-15T10:00:00Z).' }, { status: 400 })
        }
        postData.published_at = parsedDate.toISOString()
    } else if (postStatus === 'published') {
        postData.published_at = new Date().toISOString()
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('posts')
        .insert([postData])
        .select()
        .single()

    if (error) {
        let message = error.message
        if (error.code === '23505') {
            message = 'Já existe um post com este slug. Envie um slug diferente no campo "slug".'
        } else if (error.code === '23503') {
            message = 'O "category_id" ou "columnist_id" informado não existe.'
        } else if (error.code === '22P02') {
            message = 'Formato de dados inválido. Verifique os UUIDs de category_id e columnist_id.'
        }
        return NextResponse.json({ error: message, code: error.code }, { status: 400 })
    }

    revalidatePath('/')
    if (postStatus === 'published') {
        revalidatePath(`/posts/${data.slug}`)
    }

    return NextResponse.json({ post: data }, { status: 201 })
}
