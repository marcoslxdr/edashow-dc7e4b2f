import type { Gravity } from 'sharp'

const ALLOWED_GRAVITY = new Set<string>([
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
    'center',
    'centre',
])

export type EventPhotoProcessingConfig = {
    publicMaxWidth: number
    thumbWidth: number
    webpQualityPublic: number
    webpQualityThumb: number
    watermarkWidthPercent: number
    watermarkPaddingPx: number
    watermarkGravity: Gravity
    watermarkOpacity: number
    watermarkOnThumbnail: boolean
}

function parseIntEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return fallback
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n) || n < min || n > max) return fallback
    return n
}

function parseFloatEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return fallback
    const n = Number.parseFloat(raw)
    if (!Number.isFinite(n) || n < min || n > max) return fallback
    return n
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return fallback
    const v = raw.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(v)) return true
    if (['0', 'false', 'no', 'off'].includes(v)) return false
    return fallback
}

function parseGravity(raw: string | undefined, fallback: Gravity): Gravity {
    if (!raw || raw.trim() === '') return fallback
    const g = raw.trim().toLowerCase()
    return ALLOWED_GRAVITY.has(g) ? (g as Gravity) : fallback
}

export function getEventPhotoProcessingConfig(): EventPhotoProcessingConfig {
    return {
        publicMaxWidth: parseIntEnv('EVENT_PHOTO_PUBLIC_MAX_WIDTH', 1600, 320, 4096),
        thumbWidth: parseIntEnv('EVENT_PHOTO_THUMB_WIDTH', 400, 80, 2048),
        webpQualityPublic: parseIntEnv('EVENT_PHOTO_WEBP_QUALITY_PUBLIC', 80, 30, 100),
        webpQualityThumb: parseIntEnv('EVENT_PHOTO_WEBP_QUALITY_THUMB', 70, 30, 100),
        watermarkWidthPercent: parseIntEnv('EVENT_PHOTO_WATERMARK_WIDTH_PCT', 12, 1, 50),
        watermarkPaddingPx: parseIntEnv('EVENT_PHOTO_WATERMARK_PADDING_PX', 24, 0, 200),
        watermarkGravity: parseGravity(process.env.EVENT_PHOTO_WATERMARK_GRAVITY, 'southeast'),
        watermarkOpacity: parseFloatEnv('EVENT_PHOTO_WATERMARK_OPACITY', 0.35, 0, 1),
        watermarkOnThumbnail: parseBoolEnv('EVENT_PHOTO_WATERMARK_ON_THUMB', false),
    }
}
