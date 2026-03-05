'use server'

import { sql } from '@/lib/db/client'
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

export async function getYouTubeConfig(): Promise<YouTubeConfig | null> {
    try {
        const rows = await sql`SELECT * FROM youtube_config ORDER BY created_at DESC LIMIT 1`
        return rows[0] as YouTubeConfig || null
    } catch (error) {
        console.error('Error fetching YouTube config:', error)
        return null
    }
}

export async function saveYouTubeConfig(config: YouTubeConfig): Promise<{ success: boolean; error?: string }> {
    try {
        if (config.id) {
            await sql`
                UPDATE youtube_config SET
                    channel_id = ${config.channel_id},
                    channel_url = ${config.channel_url},
                    channel_name = ${config.channel_name || null},
                    channel_thumbnail = ${config.channel_thumbnail || null},
                    subscriber_count = ${config.subscriber_count || null},
                    video_count = ${config.video_count || null},
                    description = ${config.description || null},
                    enabled = ${config.enabled}
                WHERE id = ${config.id}
            `
        } else {
            await sql`DELETE FROM youtube_config`
            await sql`
                INSERT INTO youtube_config (channel_id, channel_url, channel_name, channel_thumbnail, subscriber_count, video_count, description, enabled)
                VALUES (${config.channel_id}, ${config.channel_url}, ${config.channel_name || null}, ${config.channel_thumbnail || null}, ${config.subscriber_count || null}, ${config.video_count || null}, ${config.description || null}, ${config.enabled})
            `
        }
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function testYouTubeConnection(url: string): Promise<{
    success: boolean
    channel?: YouTubeChannel
    channelId?: string
    error?: string
}> {
    try {
        const channelId = await extractChannelId(url)
        if (!channelId) return { success: false, error: 'Não foi possível encontrar o canal. Verifique a URL.' }
        const channel = await getChannelInfo(channelId)
        if (!channel) return { success: false, error: 'Não foi possível obter informações do canal.' }
        return { success: true, channel, channelId }
    } catch {
        return { success: false, error: 'Erro ao conectar com o YouTube.' }
    }
}

export async function getPublicYouTubeVideos(limit: number = 12) {
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
