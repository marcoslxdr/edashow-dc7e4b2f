import { getPublicSupabaseClient } from './public-client'

export async function getPosts(options: {
    limit?: number
    offset?: number
    category?: string
    tag?: string
    status?: 'published' | 'draft'
    featured?: boolean
} = {}) {
    const supabase = getPublicSupabaseClient()
    let query = supabase
        .from('posts')
        .select(`
      *,
      category:categories(id, name, title, slug),
      author:columnists(id, name, slug, photo_url, bio),
      cover_image_url
    `)
        .order('published_at', { ascending: false })

    if (options.limit) {
        query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1)
    }

    if (options.status) {
        query = query.eq('status', options.status)
    }

    if (options.featured !== undefined) {
        query = query.eq('featured_home', options.featured)
    }

    if (options.category) {
        // Buscar o ID da categoria pelo slug primeiro se necessário, 
        // ou usar join filtrado. No Supabase, se categories é uma tabela relacionada:
        query = query.filter('categories.slug', 'eq', options.category)
    }

    const { data, error } = await query
    if (error) {
        console.error('Error fetching posts from Supabase:', error)
        return []
    }
    return (data || []).map(normalizePostData)
}

export async function getPostBySlug(slug: string) {
    const supabase = getPublicSupabaseClient()
    const { data, error } = await supabase
        .from('posts')
        .select(`
      *,
      category:categories(id, name, title, slug),
      author:columnists(id, name, slug, bio, photo_url, instagram_url, twitter_url),
      cover_image_url
    `)
        .eq('slug', slug)
        .single()

    if (error) {
        console.error(`Error fetching post ${slug}:`, error)
        return null
    }

    return normalizePostData(data)
}

export async function getCategories() {
    const supabase = getPublicSupabaseClient()
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true })

    if (error) {
        console.error('Error fetching categories:', error)
        return []
    }
    return data || []
}

export async function getSponsors(options: { active?: boolean } = {}) {
    const supabase = getPublicSupabaseClient()

    let query = supabase.from('sponsors').select('*').order('display_order', { ascending: true })

    if (options.active) query = query.eq('active', true)


    const { data, error } = await query
    if (error) {
        console.error('Error fetching sponsors:', error)
        return []
    }
    return data || []
}

export async function getEvents(options: { limit?: number, status?: string } = {}) {
    const supabase = getPublicSupabaseClient()
    let query = supabase.from('events').select('*').order('event_date', { ascending: true })

    if (options.limit) query = query.limit(options.limit)
    if (options.status) query = query.eq('status', options.status)

    const { data, error } = await query
    if (error) {
        console.error('Error fetching events:', error)
        return []
    }
    return data || []
}

export async function getEventBySlug(slug: string) {
    const supabase = getPublicSupabaseClient()
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single()

    if (error) {
        console.error(`Error fetching event ${slug}:`, error)
        return null
    }
    return data
}

export async function getColumnists(options: { limit?: number } = {}) {
    const supabase = getPublicSupabaseClient()
    let query = supabase.from('columnists').select('*')
    if (options.limit) query = query.limit(options.limit)

    const { data, error } = await query
    if (error) {
        console.error('Error fetching columnists:', error)
        return []
    }
    return data || []
}

export async function getColumnistBySlug(slug: string) {
    const supabase = getPublicSupabaseClient()
    const { data, error } = await supabase
        .from('columnists')
        .select('*')
        .eq('slug', slug)
        .single()

    if (error) {
        console.error(`Error fetching columnist ${slug}:`, error)
        return null
    }
    return data
}

export async function getCategoryBySlug(slug: string) {
    const supabase = getPublicSupabaseClient()
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .single()

    if (error) {
        console.error(`Error fetching category ${slug}:`, error)
        return null
    }
    return data
}

export function getImageUrl(media: any, size: 'card' | 'hero' | 'full' = 'full') {
    if (!media) return '/placeholder.jpg'
    if (typeof media === 'string') return media
    return media.url || '/placeholder.jpg'
}

/**
 * Normaliza dados de posts do Supabase para o formato esperado pelos componentes
 * Transforma cover_image_url (string) em featured_image (objeto)
 */
function normalizePostData(post: any): any {
    if (!post) return post

    return {
        ...post,
        // Transform cover_image_url (string) → featured_image (object)
        featured_image: post.cover_image_url
            ? {
                url: post.cover_image_url,
                alt_text: post.title || 'Imagem do post'
            }
            : null,
        // Mantém cover_image_url para compatibilidade
        cover_image_url: post.cover_image_url
    }
}
