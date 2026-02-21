'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPost(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('posts')
        .select('*, categories(*), columnists(*)')
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

export async function savePost(data: any) {
    // Use admin client for CMS operations to bypass RLS
    const supabase = await createAdminClient()
    const { id, categories, columnists, ...postData } = data

    // Normalize data types for PostgreSQL
    const normalizedData: any = { ...postData }

    // Convert published_at from date string (YYYY-MM-DD) to ISO timestamp if provided
    if (normalizedData.published_at) {
        const dateStr = normalizedData.published_at
        // If it's just a date string (YYYY-MM-DD), convert to timestamp
        if (dateStr.length === 10 && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Create a date at midnight UTC and convert to ISO string
            normalizedData.published_at = new Date(dateStr + 'T00:00:00.000Z').toISOString()
        } else if (typeof dateStr === 'string') {
            // If it's already a timestamp, ensure it's valid
            normalizedData.published_at = new Date(dateStr).toISOString()
        }
    }

    // Convert empty strings to null for UUID fields
    if (normalizedData.category_id === '' || normalizedData.category_id === null) {
        normalizedData.category_id = null
    }
    if (normalizedData.columnist_id === '' || normalizedData.columnist_id === null) {
        normalizedData.columnist_id = null
    }

    // Ensure tags is an array
    if (normalizedData.tags && !Array.isArray(normalizedData.tags)) {
        normalizedData.tags = []
    }

    // Ensure boolean fields are actual booleans
    if (normalizedData.featured_home !== undefined) {
        normalizedData.featured_home = Boolean(normalizedData.featured_home)
    }

    // Ensure status is valid
    if (normalizedData.status && !['draft', 'published', 'archived'].includes(normalizedData.status)) {
        normalizedData.status = 'draft'
    }

    // Ensure slug exists and is valid (generate from title if missing)
    if (!normalizedData.slug && normalizedData.title) {
        // Simple slug generation if needed
        normalizedData.slug = normalizedData.title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    }

    // Ensure required fields for new posts
    if ((id === 'new' || !id) && !normalizedData.slug) {
        throw new Error('Slug é obrigatório para criar um novo post')
    }

    let result
    const operation = (id === 'new' || !id) ? 'insert' : 'update'

    console.log('[savePost] Operação:', operation)
    console.log('[savePost] Dados normalizados:', JSON.stringify(normalizedData, null, 2))

    if (id === 'new' || !id) {
        result = await supabase.from('posts').insert([normalizedData]).select().single()
    } else {
        result = await supabase.from('posts').update(normalizedData).eq('id', id).select().single()
    }

    if (result.error) {
        console.error('[savePost] Erro do Supabase:', result.error)
        console.error('[savePost] Código:', result.error.code)
        console.error('[savePost] Mensagem:', result.error.message)
        console.error('[savePost] Detalhes:', result.error.details)
        console.error('[savePost] Hint:', result.error.hint)

        // Melhorar mensagem de erro para o usuário
        let userMessage = result.error.message || 'Erro desconhecido'

        // Adicionar contexto baseado no código de erro
        if (result.error.code === '42501') {
            userMessage = 'Permissão negada. Verifique as políticas de segurança (RLS) do Supabase.'
        } else if (result.error.code === '23505') {
            userMessage = 'Já existe um post com este slug ou identificador único.'
        } else if (result.error.code === '23503') {
            userMessage = 'Categoria ou colunista referenciado não existe.'
        } else if (result.error.code === '23502') {
            userMessage = 'Campo obrigatório está faltando.'
        } else if (result.error.code === '22P02') {
            userMessage = 'Formato de dados inválido. Verifique os tipos dos campos.'
        }

        const error = new Error(userMessage) as any
        error.code = result.error.code
        error.details = result.error.details
        error.hint = result.error.hint
        throw error
    }

    revalidatePath('/cms/posts')
    revalidatePath('/')
    revalidatePath(`/posts/${result.data.slug}`)
    return result.data
}

export async function autoSavePost(data: any) {
    // Use admin client for CMS operations to bypass RLS
    const supabase = await createAdminClient()
    const { id, categories, columnists, ...postData } = data

    if (!id || id === 'new') return null // Can't auto-save a new post without ID

    // Normalize data types for PostgreSQL (same as savePost)
    const normalizedData: any = { ...postData }

    // Convert published_at from date string to ISO timestamp if provided
    if (normalizedData.published_at) {
        const dateStr = normalizedData.published_at
        if (dateStr.length === 10 && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            normalizedData.published_at = new Date(dateStr + 'T00:00:00.000Z').toISOString()
        } else if (typeof dateStr === 'string') {
            normalizedData.published_at = new Date(dateStr).toISOString()
        }
    }

    // Convert empty strings to null for UUID fields
    if (normalizedData.category_id === '' || normalizedData.category_id === null) {
        normalizedData.category_id = null
    }
    if (normalizedData.columnist_id === '' || normalizedData.columnist_id === null) {
        normalizedData.columnist_id = null
    }

    // Ensure tags is an array
    if (normalizedData.tags && !Array.isArray(normalizedData.tags)) {
        normalizedData.tags = []
    }

    const { data: result, error } = await supabase
        .from('posts')
        .update(normalizedData)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return result
}


export async function deletePost(id: string) {
    // Use admin client for CMS operations to bypass RLS
    const supabase = await createAdminClient()

    console.log('[deletePost] Tentando excluir post com ID:', id)

    const { error } = await supabase.from('posts').delete().eq('id', id)

    if (error) {
        console.error('[deletePost] Erro do Supabase:', error)
        console.error('[deletePost] Código:', error.code)
        console.error('[deletePost] Mensagem:', error.message)
        console.error('[deletePost] Detalhes:', error.details)
        console.error('[deletePost] Hint:', error.hint)

        // Melhorar mensagem de erro para o usuário
        let userMessage = error.message || 'Erro desconhecido'

        // Adicionar contexto baseado no código de erro
        if (error.code === '23503') {
            userMessage = 'Não é possível excluir este post pois existem registros relacionados. Remova as referências primeiro.'
        } else if (error.code === '42501') {
            userMessage = 'Permissão negada. Verifique as políticas de segurança (RLS) do Supabase.'
        } else if (error.code === '22P02') {
            userMessage = 'ID inválido fornecido.'
        }

        const enhancedError = new Error(userMessage) as any
        enhancedError.code = error.code
        enhancedError.details = error.details
        enhancedError.hint = error.hint
        throw enhancedError
    }

    console.log('[deletePost] Post excluído com sucesso:', id)
    revalidatePath('/cms/posts')
    revalidatePath('/')
}

export async function deleteMultiplePosts(ids: string[]) {
    // Use admin client for CMS operations to bypass RLS
    const supabase = await createAdminClient()

    console.log('[deleteMultiplePosts] Tentando excluir posts com IDs:', ids)

    const { error } = await supabase.from('posts').delete().in('id', ids)

    if (error) {
        console.error('[deleteMultiplePosts] Erro do Supabase:', error)
        console.error('[deleteMultiplePosts] Código:', error.code)
        console.error('[deleteMultiplePosts] Mensagem:', error.message)
        console.error('[deleteMultiplePosts] Detalhes:', error.details)
        console.error('[deleteMultiplePosts] Hint:', error.hint)

        // Melhorar mensagem de erro para o usuário
        let userMessage = error.message || 'Erro desconhecido'

        // Adicionar contexto baseado no código de erro
        if (error.code === '23503') {
            userMessage = 'Não é possível excluir um ou mais posts pois existem registros relacionados. Remova as referências primeiro.'
        } else if (error.code === '42501') {
            userMessage = 'Permissão negada. Verifique as políticas de segurança (RLS) do Supabase.'
        } else if (error.code === '22P02') {
            userMessage = 'IDs inválidos fornecidos.'
        }

        const enhancedError = new Error(userMessage) as any
        enhancedError.code = error.code
        enhancedError.details = error.details
        enhancedError.hint = error.hint
        throw enhancedError
    }

    console.log('[deleteMultiplePosts] Posts excluídos com sucesso:', ids)
    revalidatePath('/cms/posts')
    revalidatePath('/')
}

export async function getPostForPreview(id: string) {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('posts')
        .select(`
            *,
            category:categories(id, name, title, slug),
            author:columnists(id, name, slug, bio, photo_url, instagram_url, twitter_url),
            cover_image_url
        `)
        .eq('id', id)
        .single()

    if (error) {
        console.error(`[getPostForPreview] Erro ao buscar post ${id}:`, error)
        return null
    }

    return {
        ...data,
        featured_image: data.cover_image_url
            ? { url: data.cover_image_url, alt_text: data.title || 'Imagem do post' }
            : null,
    }
}

export async function publishPost(id: string) {
    const supabase = await createAdminClient()

    // Buscar post atual para verificar published_at
    const { data: current } = await supabase
        .from('posts')
        .select('published_at, slug')
        .eq('id', id)
        .single()

    const updateData: any = {
        status: 'published',
    }

    // Só define published_at se ainda não tiver
    if (!current?.published_at) {
        updateData.published_at = new Date().toISOString()
    }

    const { data, error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', id)
        .select('slug')
        .single()

    if (error) {
        console.error('[publishPost] Erro:', error)
        throw new Error(error.message || 'Erro ao publicar post')
    }

    revalidatePath('/cms/posts')
    revalidatePath('/')
    revalidatePath(`/posts/${data.slug}`)

    return data
}

export async function getCategories() {
    const supabase = await createClient()
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) throw error
    return data
}

export async function getColumnists() {
    const supabase = await createClient()
    const { data, error } = await supabase.from('columnists').select('*').order('name')
    if (error) throw error
    return data
}
