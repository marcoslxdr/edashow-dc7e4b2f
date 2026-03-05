'use server'

import { randomBytes } from 'crypto'
import { sql } from '@/lib/db/client'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function generatePreviewToken(postId: string) {
    await sql`
        DELETE FROM draft_preview_tokens
        WHERE post_id = ${postId} AND status = 'pending'
    `

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const rows = await sql`
        INSERT INTO draft_preview_tokens (post_id, token, expires_at)
        VALUES (${postId}, ${token}, ${expiresAt.toISOString()})
        RETURNING *
    `

    if (!rows || rows.length === 0) throw new Error('Erro ao gerar token de preview')
    return rows[0]
}

export async function getPostByPreviewToken(token: string) {
    const tokenRows = await sql`
        SELECT * FROM draft_preview_tokens WHERE token = ${token} LIMIT 1
    `
    if (!tokenRows || tokenRows.length === 0) return null
    const tokenData = tokenRows[0]

    if (new Date(tokenData.expires_at) < new Date()) return null

    const postRows = await sql`
        SELECT p.*,
            cat.id as cat_id, cat.name as cat_name, cat.slug as cat_slug,
            col.id as col_id, col.name as col_name, col.slug as col_slug,
            col.bio as col_bio, col.photo_url as col_photo_url,
            col.instagram_url as col_instagram_url, col.twitter_url as col_twitter_url
        FROM posts p
        LEFT JOIN categories cat ON cat.id = p.category_id
        LEFT JOIN columnists col ON col.id = p.author_id
        WHERE p.id = ${tokenData.post_id}
        LIMIT 1
    `
    if (!postRows || postRows.length === 0) return null
    const post = postRows[0]

    return {
        token: tokenData,
        post: {
            ...post,
            category: post.cat_id ? { id: post.cat_id, name: post.cat_name, slug: post.cat_slug } : null,
            author: post.col_id ? { id: post.col_id, name: post.col_name, slug: post.col_slug, bio: post.col_bio, photo_url: post.col_photo_url, instagram_url: post.col_instagram_url, twitter_url: post.col_twitter_url } : null,
            featured_image: post.cover_image_url
                ? { url: post.cover_image_url, alt_text: post.title || 'Imagem do post' }
                : null,
        },
    }
}

export async function submitPreviewReview(token: string, decision: 'approved' | 'rejected', comment?: string) {
    let reviewerName = 'Revisor externo'
    try {
        const session = await auth()
        if (session?.user) {
            reviewerName = session.user.name || session.user.email || 'Revisor'
        }
    } catch { /* anonymous review */ }

    const tokenRows = await sql`
        SELECT * FROM draft_preview_tokens
        WHERE token = ${token} AND status = 'pending' LIMIT 1
    `
    if (!tokenRows || tokenRows.length === 0) throw new Error('Token inválido ou já utilizado.')
    const tokenData = tokenRows[0]

    if (new Date(tokenData.expires_at) < new Date()) throw new Error('Este link de preview expirou.')

    await sql`
        UPDATE draft_preview_tokens
        SET status = ${decision}, reviewer_name = ${reviewerName},
            reviewer_comment = ${comment || null}, reviewed_at = NOW()
        WHERE id = ${tokenData.id}
    `

    if (decision === 'approved') {
        const postRows = await sql`
            UPDATE posts SET status = 'published', published_at = NOW()
            WHERE id = ${tokenData.post_id} RETURNING slug
        `
        if (postRows && postRows[0]) {
            revalidatePath('/cms/posts')
            revalidatePath('/')
            revalidatePath(`/posts/${postRows[0].slug}`)
        }
    }

    return { success: true, decision }
}

export async function getActivePreviewToken(postId: string) {
    const rows = await sql`
        SELECT * FROM draft_preview_tokens
        WHERE post_id = ${postId} AND status = 'pending' AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1
    `
    return rows[0] || null
}

export async function revokePreviewToken(postId: string) {
    await sql`
        DELETE FROM draft_preview_tokens
        WHERE post_id = ${postId} AND status = 'pending'
    `
    return { success: true }
}
