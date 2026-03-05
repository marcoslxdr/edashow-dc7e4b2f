import { sql } from '@/lib/db/client'

export async function getPosts(options: {
    limit?: number
    offset?: number
    category?: string
    tag?: string
    status?: 'published' | 'draft'
    featured?: boolean
} = {}) {
    try {
        const conditions: string[] = []
        const params: unknown[] = []
        let paramIdx = 1

        if (options.status) {
            conditions.push(`p.status = $${paramIdx++}`)
            params.push(options.status)
        }

        if (options.featured !== undefined) {
            conditions.push(`p.featured_home = $${paramIdx++}`)
            params.push(options.featured)
        }

        if (options.category) {
            conditions.push(`cat.slug = $${paramIdx++}`)
            params.push(options.category)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        let limitClause = ''
        if (options.limit) {
            const offset = options.offset || 0
            limitClause = `LIMIT $${paramIdx++} OFFSET $${paramIdx++}`
            params.push(options.limit, offset)
        }

        // Build query string dynamically for parameterized queries
        const query = `
            SELECT
                p.*,
                cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
                col.id as col_id, col.name as col_name, col.slug as col_slug,
                col.photo_url as col_photo_url, col.bio as col_bio
            FROM posts p
            LEFT JOIN categories cat ON cat.id = p.category_id
            LEFT JOIN columnists col ON col.id = p.author_id
            ${whereClause}
            ORDER BY p.published_at DESC
            ${limitClause}
        `

        const data = await sql(query, params)
        return (data || []).map(normalizeRowData)
    } catch (error) {
        console.error('Error fetching posts:', error)
        return []
    }
}

export async function getPostBySlug(slug: string) {
    try {
        const data = await sql`
            SELECT
                p.*,
                cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
                col.id as col_id, col.name as col_name, col.slug as col_slug,
                col.photo_url as col_photo_url, col.bio as col_bio,
                col.instagram_url as col_instagram_url, col.twitter_url as col_twitter_url
            FROM posts p
            LEFT JOIN categories cat ON cat.id = p.category_id
            LEFT JOIN columnists col ON col.id = p.author_id
            WHERE p.slug = ${slug}
            LIMIT 1
        `

        if (!data || data.length === 0) return null
        return normalizeRowData(data[0])
    } catch (error) {
        console.error(`Error fetching post ${slug}:`, error)
        return null
    }
}

export async function getCategories() {
    try {
        const data = await sql`
            SELECT * FROM categories ORDER BY display_order ASC
        `
        return data || []
    } catch (error) {
        console.error('Error fetching categories:', error)
        return []
    }
}

export async function getSponsors(options: { active?: boolean } = {}) {
    try {
        let data
        if (options.active) {
            data = await sql`
                SELECT * FROM sponsors WHERE active = true ORDER BY display_order ASC
            `
        } else {
            data = await sql`
                SELECT * FROM sponsors ORDER BY display_order ASC
            `
        }
        return data || []
    } catch (error) {
        console.error('Error fetching sponsors:', error)
        return []
    }
}

export async function getEvents(options: { limit?: number, status?: string } = {}) {
    try {
        let data
        if (options.limit && options.status) {
            data = await sql`
                SELECT * FROM events
                WHERE status = ${options.status}
                ORDER BY event_date ASC
                LIMIT ${options.limit}
            `
        } else if (options.limit) {
            data = await sql`
                SELECT * FROM events ORDER BY event_date ASC LIMIT ${options.limit}
            `
        } else if (options.status) {
            data = await sql`
                SELECT * FROM events WHERE status = ${options.status} ORDER BY event_date ASC
            `
        } else {
            data = await sql`
                SELECT * FROM events ORDER BY event_date ASC
            `
        }
        return data || []
    } catch (error) {
        console.error('Error fetching events:', error)
        return []
    }
}

export async function getEventBySlug(slug: string) {
    try {
        const data = await sql`
            SELECT * FROM events WHERE slug = ${slug} LIMIT 1
        `
        if (!data || data.length === 0) return null
        return data[0]
    } catch (error) {
        console.error(`Error fetching event ${slug}:`, error)
        return null
    }
}

export async function getColumnists(options: { limit?: number } = {}) {
    try {
        let data
        if (options.limit) {
            data = await sql`SELECT * FROM columnists LIMIT ${options.limit}`
        } else {
            data = await sql`SELECT * FROM columnists`
        }
        return data || []
    } catch (error) {
        console.error('Error fetching columnists:', error)
        return []
    }
}

export async function getColumnistBySlug(slug: string) {
    try {
        const data = await sql`
            SELECT * FROM columnists WHERE slug = ${slug} LIMIT 1
        `
        if (!data || data.length === 0) return null
        return data[0]
    } catch (error) {
        console.error(`Error fetching columnist ${slug}:`, error)
        return null
    }
}

export async function getCategoryBySlug(slug: string) {
    try {
        const data = await sql`
            SELECT * FROM categories WHERE slug = ${slug} LIMIT 1
        `
        if (!data || data.length === 0) return null
        return data[0]
    } catch (error) {
        console.error(`Error fetching category ${slug}:`, error)
        return null
    }
}

export function getImageUrl(media: unknown, _size: 'card' | 'hero' | 'full' = 'full') {
    if (!media) return '/placeholder.jpg'
    if (typeof media === 'string') return media
    if (typeof media === 'object' && media !== null && 'url' in media) {
        return (media as { url: string }).url || '/placeholder.jpg'
    }
    return '/placeholder.jpg'
}

/**
 * Normaliza dados de posts do banco para o formato esperado pelos componentes.
 * Transforma cover_image_url (string) em featured_image (objeto) e
 * reconstrói os objetos de relacionamento (category, author) a partir das colunas joinadas.
 */
function normalizeRowData(row: Record<string, unknown>): Record<string, unknown> {
    if (!row) return row

    const category = row.cat_id
        ? { id: row.cat_id, name: row.cat_name, slug: row.cat_slug }
        : null

    const author = row.col_id
        ? {
            id: row.col_id,
            name: row.col_name,
            slug: row.col_slug,
            photo_url: row.col_photo_url,
            bio: row.col_bio,
            instagram_url: row.col_instagram_url,
            twitter_url: row.col_twitter_url,
        }
        : null

    return {
        ...row,
        category,
        author,
        featured_image: row.cover_image_url
            ? {
                url: row.cover_image_url,
                alt_text: (row.title as string) || 'Imagem do post'
            }
            : null,
        cover_image_url: row.cover_image_url
    }
}
