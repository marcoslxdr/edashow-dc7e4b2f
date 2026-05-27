'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { parseEventVideoUrl } from '@/lib/event-videos/parse-url'
import { revalidatePath } from 'next/cache'

export async function getEventVideos(eventId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('event_videos')
        .select('*')
        .eq('event_id', eventId)
        .order('display_order', { ascending: true })

    if (error) throw error
    return data ?? []
}

export async function getEventVideosBySlug(slug: string) {
    const supabase = createAdminClient()
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('slug', slug)
        .single()

    if (eventError && eventError.code !== 'PGRST116') throw eventError
    if (!event) return []

    return getEventVideos(event.id)
}

export async function addEventVideo(data: {
    event_id: string
    video_url: string
    title?: string
}) {
    if (!data.event_id) {
        throw new Error('Salve o evento antes de adicionar vídeos.')
    }

    const parsed = parseEventVideoUrl(data.video_url)
    if (!parsed) {
        throw new Error('URL inválida. Use um link do YouTube ou Instagram (post, reel ou vídeo).')
    }

    const supabase = createAdminClient()

    const { count } = await supabase
        .from('event_videos')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', data.event_id)

    const displayOrder = count ?? 0

    const { data: row, error } = await supabase
        .from('event_videos')
        .insert([
            {
                event_id: data.event_id,
                platform: parsed.platform,
                video_url: parsed.videoUrl,
                title: data.title?.trim() || null,
                display_order: displayOrder,
            },
        ])
        .select()
        .single()

    if (error) throw error

    revalidatePath('/cms/events')
    revalidatePath('/events')
    return row
}

export async function deleteEventVideo(videoId: string) {
    const supabase = createAdminClient()
    const { error } = await supabase.from('event_videos').delete().eq('id', videoId)
    if (error) throw error
    revalidatePath('/cms/events')
    revalidatePath('/events')
}
