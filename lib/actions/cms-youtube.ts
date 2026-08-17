'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCmsRole } from './cms-authz'
import { extractChannelId, getChannelInfo, getLatestVideos, YouTubeChannel } from '@/lib/youtube'

export interface YouTubeConfig {
    id?: string
    channel_id: string
    channel_url: string
    channel_name?: string
    channel_thumbnail?: string
    subscriber_count?: string
    video_count?: string
    description?: string
    enabled: boolean
}

/**
 * Get the current YouTube configuration
 */
export async function getYouTubeConfig(): Promise<YouTubeConfig | null> {
    await requireCmsRole()
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('youtube_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching YouTube config:', error)
        return null
    }

    return data
}

/**
 * Save YouTube configuration
 */
export async function saveYouTubeConfig(config: YouTubeConfig): Promise<{ success: boolean; error?: string }> {
    await requireCmsRole()
    const supabase = createAdminClient()

    // Use admin client to bypass RLS

    // If we have an existing config, update it
    if (config.id) {
        const { error } = await supabase
            .from('youtube_config')
            .update({
                channel_id: config.channel_id,
                channel_url: config.channel_url,
                channel_name: config.channel_name,
                channel_thumbnail: config.channel_thumbnail,
                subscriber_count: config.subscriber_count,
                video_count: config.video_count,
                description: config.description,
                enabled: config.enabled
            })
            .eq('id', config.id)

        if (error) {
            console.error('Error updating YouTube config:', error)
            return { success: false, error: error.message }
        }
    } else {
        // Create new config (delete any existing first)
        await supabase.from('youtube_config').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        const { error } = await supabase
            .from('youtube_config')
            .insert({
                channel_id: config.channel_id,
                channel_url: config.channel_url,
                channel_name: config.channel_name,
                channel_thumbnail: config.channel_thumbnail,
                subscriber_count: config.subscriber_count,
                video_count: config.video_count,
                description: config.description,
                enabled: config.enabled
            })

        if (error) {
            console.error('Error creating YouTube config:', error)
            return { success: false, error: error.message }
        }
    }

    return { success: true }
}

/**
 * Test YouTube connection by URL
 */
export async function testYouTubeConnection(url: string): Promise<{
    success: boolean
    channel?: YouTubeChannel
    channelId?: string
    error?: string
}> {
    await requireCmsRole()
    try {
        const channelId = await extractChannelId(url)

        if (!channelId) {
            return { success: false, error: 'Não foi possível encontrar o canal. Verifique a URL.' }
        }

        const channel = await getChannelInfo(channelId)

        if (!channel) {
            return { success: false, error: 'Não foi possível obter informações do canal.' }
        }

        return { success: true, channel, channelId }
    } catch (error) {
        console.error('Error testing YouTube connection:', error)
        return { success: false, error: 'Erro ao conectar com o YouTube.' }
    }
}

/**
 * Get YouTube videos for public display
 */
export async function getPublicYouTubeVideos(limit: number = 12) {
    // Use regular client for read operations
    const supabase = createClient()

    const config = await getYouTubeConfig()

    if (!config || !config.enabled || !config.channel_id) {
        return { channel: null, videos: [] }
    }

    const videos = await getLatestVideos(config.channel_id, limit)

    return {
        channel: {
            id: config.channel_id,
            name: config.channel_name,
            thumbnail: config.channel_thumbnail,
            subscriberCount: config.subscriber_count,
            videoCount: config.video_count,
            description: config.description
        },
        videos
    }
}
