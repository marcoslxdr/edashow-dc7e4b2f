'use server'

import { randomBytes } from 'crypto'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireCmsRole } from '@/lib/actions/cms-authz'

/**
 * Generate a preview token for a draft post.
 * Deletes any existing pending tokens for the same post before creating a new one.
 */
export async function generatePreviewToken(postId: string) {
    await requireCmsRole()
    const supabase = createAdminClient()

    // Delete existing pending tokens for this post
    await supabase
        .from('draft_preview_tokens')
        .delete()
        .eq('post_id', postId)
        .eq('status', 'pending')

    // Generate a 64-char hex token (256 bits)
    const token = randomBytes(32).toString('hex')

    // Expires in 7 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
        .from('draft_preview_tokens')
        .insert({
            post_id: postId,
            token,
            expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

    if (error) {
        console.error('[generatePreviewToken] Error:', error)
        throw new Error(error.message || 'Erro ao gerar token de preview')
    }

    return data
}

/**
 * Get a post by its high-entropy preview token.
 */
export async function getPostByPreviewToken(tokenOrId: string) {
    const supabase = createAdminClient()

    // Find the token
    const { data: tokenData, error: tokenError } = await supabase
        .from('draft_preview_tokens')
        .select('*')
        .eq('token', tokenOrId)
        .single()

    if (tokenError || !tokenData) {
        return null
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
        return null
    }

    // Fetch the full post with relationships
    const { data: post, error: postError } = await supabase
        .from('posts')
        .select(`
            *,
            category:categories(id, name, slug),
            author:columnists(id, name, slug, bio, photo_url, instagram_url, twitter_url)
        `)
        .eq('id', tokenData.post_id)
        .single()

    if (postError || !post) {
        return null
    }

    return {
        token: tokenData,
        post: {
            ...post,
            featured_image: post.cover_image_url
                ? { url: post.cover_image_url, alt_text: post.title || 'Imagem do post' }
                : null,
        },
    }
}

/**
 * Submit a review decision for a preview token.
 * If approved, automatically publishes the post.
 * The reviewer identity comes from the logged-in Supabase user.
 */
export async function submitPreviewReview(
    token: string,
    decision: 'approved' | 'rejected',
    comment?: string
) {
    await requireCmsRole()
    const supabase = createAdminClient()

    // Try to get logged-in user info (optional - anonymous reviews allowed)
    let reviewerName = 'Revisor externo'
    try {
        const authClient = await createClient()
        const { data: { user } } = await authClient.auth.getUser()
        if (user) {
            reviewerName = user.user_metadata?.full_name || user.email || 'Revisor'
        }
    } catch {
        // Anonymous review - use default name
    }

    // Validate the token exists and is still pending
    const { data: tokenData, error: tokenError } = await supabase
        .from('draft_preview_tokens')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

    if (tokenError || !tokenData) {
        throw new Error('Token inválido ou já utilizado.')
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
        throw new Error('Este link de preview expirou.')
    }

    // Update the token with the review
    const { error: updateError } = await supabase
        .from('draft_preview_tokens')
        .update({
            status: decision,
            reviewer_name: reviewerName,
            reviewer_comment: comment || null,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', tokenData.id)

    if (updateError) {
        console.error('[submitPreviewReview] Error updating token:', updateError)
        throw new Error('Erro ao salvar a revisão.')
    }

    // If approved, publish the post
    if (decision === 'approved') {
        const { data: post, error: publishError } = await supabase
            .from('posts')
            .update({
                status: 'published',
                published_at: new Date().toISOString(),
            })
            .eq('id', tokenData.post_id)
            .select()
            .single()

        if (publishError) {
            console.error('[submitPreviewReview] Error publishing:', publishError)
            throw new Error('Erro ao publicar o post.')
        }

        revalidatePath('/cms/posts')
        revalidatePath('/')
        revalidatePath(`/posts/${post.slug}`)
    }

    return { success: true, decision }
}

/**
 * Get the active (pending) preview token for a post, if any.
 */
export async function getActivePreviewToken(postId: string) {
    await requireCmsRole()
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('draft_preview_tokens')
        .select('*')
        .eq('post_id', postId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('[getActivePreviewToken] Error:', error)
        return null
    }

    return data
}

/**
 * Revoke (delete) all pending preview tokens for a post.
 */
export async function revokePreviewToken(postId: string) {
    await requireCmsRole()
    const supabase = createAdminClient()

    const { error } = await supabase
        .from('draft_preview_tokens')
        .delete()
        .eq('post_id', postId)
        .eq('status', 'pending')

    if (error) {
        console.error('[revokePreviewToken] Error:', error)
        throw new Error('Erro ao revogar token de preview.')
    }

    return { success: true }
}
