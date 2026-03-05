'use server'

import { sql } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'

export async function getPost(id: string) {
    const rows = await sql`
        SELECT p.*, 
            cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
            col.id as col_id, col.name as col_name, col.slug as col_slug
        FROM posts p
        LEFT JOIN categories cat ON cat.id = p.category_id
        LEFT JOIN columnists col ON col.id = p.author_id
        WHERE p.id = ${id}
        LIMIT 1
    `
    if (!rows || rows.length === 0) return null
    const row = rows[0]
    return {
        ...row,
        categories: row.cat_id ? { id: row.cat_id, name: row.cat_name, slug: row.cat_slug } : null,
        columnists: row.col_id ? { id: row.col_id, name: row.col_name, slug: row.col_slug } : null,
    }
}

export async function savePost(data: any) {
    const { id, categories, columnists, ...postData } = data

    const normalizedData: any = { ...postData }

    if (normalizedData.published_at) {
        const dateStr = normalizedData.published_at
        if (dateStr.length === 10 && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            normalizedData.published_at = new Date(dateStr + 'T00:00:00.000Z').toISOString()
        } else if (typeof dateStr === 'string') {
            normalizedData.published_at = new Date(dateStr).toISOString()
        }
    }

    if (normalizedData.category_id === '' || normalizedData.category_id === null) {
        normalizedData.category_id = null
    }
    if (normalizedData.columnist_id === '' || normalizedData.columnist_id === null) {
        normalizedData.columnist_id = null
    }

    if (normalizedData.tags && !Array.isArray(normalizedData.tags)) {
        normalizedData.tags = []
    }

    if (normalizedData.featured_home !== undefined) {
        normalizedData.featured_home = Boolean(normalizedData.featured_home)
    }

    if (normalizedData.status && !['draft', 'published', 'archived'].includes(normalizedData.status)) {
        normalizedData.status = 'draft'
    }

    if (!normalizedData.slug && normalizedData.title) {
        normalizedData.slug = normalizedData.title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    }

    if ((id === 'new' || !id) && !normalizedData.slug) {
        throw new Error('Slug é obrigatório para criar um novo post')
    }

    console.log('[savePost] Dados normalizados:', JSON.stringify(normalizedData, null, 2))

    try {
        let result
        if (id === 'new' || !id) {
            const keys = Object.keys(normalizedData)
            const values = Object.values(normalizedData)
            const cols = keys.join(', ')
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
            const rows = await sql(
                `INSERT INTO posts (${cols}) VALUES (${placeholders}) RETURNING *`,
                values
            )
            result = rows[0]
        } else {
            const keys = Object.keys(normalizedData)
            const values = Object.values(normalizedData)
            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
            const rows = await sql(
                `UPDATE posts SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
                [...values, id]
            )
            result = rows[0]
        }

        revalidatePath('/cms/posts')
        revalidatePath('/')
        if (result?.slug) revalidatePath(`/posts/${result.slug}`)
        return result
    } catch (error: any) {
        console.error('[savePost] Erro:', error)
        let userMessage = error.message || 'Erro desconhecido'
        if (error.code === '23505') userMessage = 'Já existe um post com este slug.'
        if (error.code === '23503') userMessage = 'Categoria ou colunista referenciado não existe.'
        if (error.code === '23502') userMessage = 'Campo obrigatório está faltando.'
        const enhancedError = new Error(userMessage) as any
        enhancedError.code = error.code
        throw enhancedError
    }
}

export async function autoSavePost(data: any) {
    const { id, categories, columnists, ...postData } = data
    if (!id || id === 'new') return null

    const normalizedData: any = { ...postData }

    if (normalizedData.published_at) {
        const dateStr = normalizedData.published_at
        if (dateStr.length === 10 && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            normalizedData.published_at = new Date(dateStr + 'T00:00:00.000Z').toISOString()
        } else if (typeof dateStr === 'string') {
            normalizedData.published_at = new Date(dateStr).toISOString()
        }
    }

    if (normalizedData.category_id === '') normalizedData.category_id = null
    if (normalizedData.columnist_id === '') normalizedData.columnist_id = null
    if (normalizedData.tags && !Array.isArray(normalizedData.tags)) normalizedData.tags = []

    const keys = Object.keys(normalizedData)
    const values = Object.values(normalizedData)
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
    const rows = await sql(
        `UPDATE posts SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
    )
    return rows[0] || null
}

export async function deletePost(id: string) {
    console.log('[deletePost] Excluindo post:', id)
    try {
        await sql`DELETE FROM posts WHERE id = ${id}`
        revalidatePath('/cms/posts')
        revalidatePath('/')
    } catch (error: any) {
        console.error('[deletePost] Erro:', error)
        let userMessage = error.message || 'Erro desconhecido'
        if (error.code === '23503') userMessage = 'Não é possível excluir este post pois existem registros relacionados.'
        throw new Error(userMessage)
    }
}

export async function deleteMultiplePosts(ids: string[]) {
    console.log('[deleteMultiplePosts] Excluindo posts:', ids)
    try {
        await sql`DELETE FROM posts WHERE id = ANY(${ids}::uuid[])`
        revalidatePath('/cms/posts')
        revalidatePath('/')
    } catch (error: any) {
        console.error('[deleteMultiplePosts] Erro:', error)
        throw new Error(error.message || 'Erro ao excluir posts')
    }
}

export async function getPostForPreview(id: string) {
    const rows = await sql`
        SELECT p.*,
            cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
            col.id as col_id, col.name as col_name, col.slug as col_slug,
            col.bio as col_bio, col.photo_url as col_photo_url,
            col.instagram_url as col_instagram_url, col.twitter_url as col_twitter_url
        FROM posts p
        LEFT JOIN categories cat ON cat.id = p.category_id
        LEFT JOIN columnists col ON col.id = p.author_id
        WHERE p.id = ${id}
        LIMIT 1
    `
    if (!rows || rows.length === 0) return null
    const data = rows[0]
    return {
        ...data,
        category: data.cat_id ? { id: data.cat_id, name: data.cat_name, slug: data.cat_slug } : null,
        author: data.col_id ? { id: data.col_id, name: data.col_name, slug: data.col_slug, bio: data.col_bio, photo_url: data.col_photo_url, instagram_url: data.col_instagram_url, twitter_url: data.col_twitter_url } : null,
        featured_image: data.cover_image_url
            ? { url: data.cover_image_url, alt_text: data.title || 'Imagem do post' }
            : null,
    }
}

export async function publishPost(id: string) {
    const current = await sql`SELECT published_at, slug FROM posts WHERE id = ${id} LIMIT 1`
    const currentPost = current[0]

    let result
    if (!currentPost?.published_at) {
        result = await sql`
            UPDATE posts SET status = 'published', published_at = ${new Date().toISOString()}
            WHERE id = ${id} RETURNING slug
        `
    } else {
        result = await sql`
            UPDATE posts SET status = 'published'
            WHERE id = ${id} RETURNING slug
        `
    }

    const data = result[0]
    if (!data) throw new Error('Post não encontrado')

    revalidatePath('/cms/posts')
    revalidatePath('/')
    revalidatePath(`/posts/${data.slug}`)
    return data
}

export async function getCategories() {
    const data = await sql`SELECT * FROM categories ORDER BY name`
    return data
}

export async function getColumnists() {
    const data = await sql`SELECT * FROM columnists ORDER BY name`
    return data
}
