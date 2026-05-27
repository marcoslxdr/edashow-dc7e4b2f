'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { parseEventVideoUrl } from '@/lib/event-videos/parse-url'
import { revalidatePath } from 'next/cache'

function formatSupabaseError(
    context: string,
    error: { message?: string; code?: string; details?: string; hint?: string },
) {
    const parts = [context, error.message, error.code].filter(Boolean)
    if (process.env.NODE_ENV === 'development' && error.hint) parts.push(`hint: ${error.hint}`)
    return parts.join(' — ')
}

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

    const { data: event, error: eventLookupError } = await supabase
        .from('events')
        .select('slug')
        .eq('id', data.event_id)
        .single()

    if (eventLookupError) {
        throw new Error(formatSupabaseError('Evento não encontrado', eventLookupError))
    }

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

    if (error) {
        if (error.code === '42P01') {
            throw new Error(
                'Tabela event_videos ausente. Aplique a migration 20260526_event_gallery_drive_and_videos.sql.',
            )
        }
        throw new Error(formatSupabaseError('Não foi possível salvar o vídeo', error))
    }

    revalidatePath('/cms/events')
    if (event?.slug) {
        revalidatePath(`/events/${event.slug}`)
    }
    revalidatePath('/events')
    return row
}

export async function deleteEventVideo(videoId: string) {
    const supabase = createAdminClient()

    const { data: video, error: fetchError } = await supabase
        .from('event_videos')
        .select('event_id')
        .eq('id', videoId)
        .single()

    if (fetchError) throw new Error(formatSupabaseError('Vídeo não encontrado', fetchError))

    const { error } = await supabase.from('event_videos').delete().eq('id', videoId)
    if (error) throw new Error(formatSupabaseError('Não foi possível remover o vídeo', error))

    if (video?.event_id) {
        const { data: event } = await supabase
            .from('events')
            .select('slug')
            .eq('id', video.event_id)
            .single()
        if (event?.slug) revalidatePath(`/events/${event.slug}`)
    }

    revalidatePath('/cms/events')
    revalidatePath('/events')
}
