export type VideoPlatform = 'youtube' | 'instagram'

export interface ParsedEventVideo {
    platform: VideoPlatform
    videoUrl: string
    embedUrl: string
}

function normalizeUrl(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
}

function parseYouTube(url: string): ParsedEventVideo | null {
    let id: string | null = null

    try {
        const parsed = new URL(url)
        const host = parsed.hostname.replace(/^www\./, '')

        if (host === 'youtu.be') {
            id = parsed.pathname.slice(1).split('/')[0] || null
        } else if (host === 'youtube.com' || host === 'm.youtube.com') {
            if (parsed.pathname === '/watch') {
                id = parsed.searchParams.get('v')
            } else if (parsed.pathname.startsWith('/embed/')) {
                id = parsed.pathname.split('/')[2] || null
            } else if (parsed.pathname.startsWith('/shorts/')) {
                id = parsed.pathname.split('/')[2] || null
            }
        }
    } catch {
        return null
    }

    if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null

    const videoUrl = `https://www.youtube.com/watch?v=${id}`
    return {
        platform: 'youtube',
        videoUrl,
        embedUrl: `https://www.youtube.com/embed/${id}`,
    }
}

function parseInstagram(url: string): ParsedEventVideo | null {
    let code: string | null = null

    try {
        const parsed = new URL(url)
        const host = parsed.hostname.replace(/^www\./, '')
        if (host !== 'instagram.com') return null

        const parts = parsed.pathname.split('/').filter(Boolean)
        const type = parts[0]
        if (type === 'p' || type === 'reel' || type === 'tv') {
            code = parts[1] || null
        }
    } catch {
        return null
    }

    if (!code) return null

    const pathPrefix = url.includes('/reel/') ? 'reel' : url.includes('/tv/') ? 'tv' : 'p'
    const videoUrl = `https://www.instagram.com/${pathPrefix}/${code}/`
    return {
        platform: 'instagram',
        videoUrl,
        embedUrl: `https://www.instagram.com/${pathPrefix}/${code}/embed`,
    }
}

export function parseEventVideoUrl(raw: string): ParsedEventVideo | null {
    const url = normalizeUrl(raw)
    if (!url) return null

    return parseYouTube(url) ?? parseInstagram(url)
}

export function isValidDriveUrl(raw: string): boolean {
    const url = normalizeUrl(raw)
    if (!url) return false
    try {
        const parsed = new URL(url)
        const host = parsed.hostname.replace(/^www\./, '')
        return host === 'drive.google.com' || host === 'docs.google.com'
    } catch {
        return false
    }
}
