'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { requireCmsRole } from './cms-authz'
import { revalidatePath } from 'next/cache'

export async function getEventPosts(eventId: string) {
    await requireCmsRole()
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('posts')
        .select('id, title, slug, status, published_at, cover_image_url')
        .eq('event_id', eventId)
        .order('published_at', { ascending: false, nullsFirst: false })

    if (error) throw error
    return data ?? []
}

export async function linkPostToEvent(postId: string, eventId: string | null) {
    await requireCmsRole()
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('posts')
        .update({ event_id: eventId })
        .eq('id', postId)
        .select('slug')
        .single()

    if (error) throw error

    revalidatePath('/cms/events')
    revalidatePath('/cms/posts')
    if (eventId) {
        const { data: ev } = await supabase.from('events').select('slug').eq('id', eventId).single()
        if (ev?.slug) revalidatePath(`/events/${ev.slug}`)
    }
    if (data?.slug) revalidatePath(`/posts/${data.slug}`)
    return data
}

export async function searchPostsForLink(query: string, excludeEventId?: string) {
    await requireCmsRole()
    const supabase = createAdminClient()
    let q = supabase
        .from('posts')
        .select('id, title, slug, status, event_id')
        .order('updated_at', { ascending: false })
        .limit(15)

    if (query.trim()) q = q.ilike('title', `%${query.trim()}%`)
    if (excludeEventId) {
        q = q.or(`event_id.is.null,event_id.neq.${excludeEventId}`)
    }

    const { data, error } = await q
    if (error) throw error
    return data ?? []
}
