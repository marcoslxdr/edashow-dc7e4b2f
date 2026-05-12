'use server'

import { revalidatePath } from 'next/cache'

export async function publishPostFromPreview(postId: string): Promise<{ success: boolean; slug?: string; error?: string }> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        return { success: false, error: 'Configuração indisponível' }
    }

    try {
        const currentRes = await fetch(
            `${supabaseUrl}/rest/v1/posts?id=eq.${encodeURIComponent(postId)}&select=published_at,slug`,
            {
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                },
            }
        )

        if (!currentRes.ok) {
            return { success: false, error: 'Post não encontrado' }
        }

        const currentData = await currentRes.json()
        if (!currentData || currentData.length === 0) {
            return { success: false, error: 'Post não encontrado' }
        }

        const current = currentData[0]
        const updateData: any = { status: 'published' }

        if (!current.published_at) {
            updateData.published_at = new Date().toISOString()
        }

        const updateRes = await fetch(
            `${supabaseUrl}/rest/v1/posts?id=eq.${encodeURIComponent(postId)}`,
            {
                method: 'PATCH',
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation',
                },
                body: JSON.stringify(updateData),
            }
        )

        if (!updateRes.ok) {
            return { success: false, error: 'Erro ao publicar post' }
        }

        const updated = await updateRes.json()
        const slug = updated?.[0]?.slug || ''

        revalidatePath('/cms/posts')
        revalidatePath('/')
        revalidatePath(`/posts/${slug}`)

        return { success: true, slug }
    } catch (err: any) {
        return { success: false, error: err?.message || 'Erro inesperado' }
    }
}
