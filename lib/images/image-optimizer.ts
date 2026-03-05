/**
 * Image Optimizer Service
 * Uses Sharp to optimize images: resize, convert formats, apply watermarks
 */

import sharp from 'sharp'
import { sql } from '@/lib/db/client'

export interface ImageSettings {
    id: string
    enabled: boolean
    format: 'webp' | 'jpeg' | 'png'
    quality: number
    max_width: number
    max_height: number
    watermark_enabled: boolean
    watermark_logo_url: string | null
    watermark_position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    watermark_opacity: number
    watermark_size: number
}

export interface OptimizeOptions {
    format?: 'webp' | 'jpeg' | 'png'
    quality?: number
    maxWidth?: number
    maxHeight?: number
    watermark?: {
        logoUrl: string
        position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
        opacity: number // 1-100
        size: number // percentage of image width
    }
}

/**
 * Get image optimization settings from database
 */
export async function getImageSettings(): Promise<ImageSettings | null> {
    try {
        const rows = await sql\`SELECT * FROM image_settings LIMIT 1\`
        return rows[0] as ImageSettings || null
    } catch (error) {
        console.error('Error fetching image settings:', error)
        return null
    }
}

/**
 * Fetch watermark logo as buffer
 */
async function fetchWatermarkLogo(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url)
        if (!response.ok) return null

        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
    } catch (error) {
        console.error('Error fetching watermark logo:', error)
        return null
    }
}

/**
 * Calculate watermark position
 */
function getWatermarkPosition(
    position: string,
    imageWidth: number,
    imageHeight: number,
    watermarkWidth: number,
    watermarkHeight: number
): { left: number; top: number } {
    const padding = 20

    switch (position) {
        case 'top-left':
            return { left: padding, top: padding }
        case 'top-right':
            return { left: imageWidth - watermarkWidth - padding, top: padding }
        case 'bottom-left':
            return { left: padding, top: imageHeight - watermarkHeight - padding }
        case 'bottom-right':
            return { left: imageWidth - watermarkWidth - padding, top: imageHeight - watermarkHeight - padding }
        case 'center':
            return {
                left: Math.floor((imageWidth - watermarkWidth) / 2),
                top: Math.floor((imageHeight - watermarkHeight) / 2)
            }
        default:
            return { left: imageWidth - watermarkWidth - padding, top: imageHeight - watermarkHeight - padding }
    }
}

/**
 * Optimize an image buffer with the given options
 */
export async function optimizeImage(
    inputBuffer: Buffer,
    options: OptimizeOptions = {}
): Promise<{ buffer: Buffer; format: string; width: number; height: number }> {
    const {
        format = 'webp',
        quality = 85,
        maxWidth = 1920,
        maxHeight = 1080,
        watermark
    } = options

    // Start with the input buffer
    let pipeline = sharp(inputBuffer)

    // Get metadata for the original image
    const metadata = await pipeline.metadata()
    const originalWidth = metadata.width || 1920
    const originalHeight = metadata.height || 1080

    // Calculate resize dimensions maintaining aspect ratio
    let targetWidth = originalWidth
    let targetHeight = originalHeight

    if (originalWidth > maxWidth || originalHeight > maxHeight) {
        const widthRatio = maxWidth / originalWidth
        const heightRatio = maxHeight / originalHeight
        const ratio = Math.min(widthRatio, heightRatio)

        targetWidth = Math.round(originalWidth * ratio)
        targetHeight = Math.round(originalHeight * ratio)
    }

    // Resize if needed
    if (targetWidth !== originalWidth || targetHeight !== originalHeight) {
        pipeline = pipeline.resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true
        })
    }

    // Apply watermark if provided
    if (watermark && watermark.logoUrl) {
        const logoBuffer = await fetchWatermarkLogo(watermark.logoUrl)

        if (logoBuffer) {
            try {
                // Calculate watermark size
                const watermarkWidth = Math.round(targetWidth * (watermark.size / 100))

                // Resize watermark logo and apply opacity
                const opacity = Math.round(255 * (watermark.opacity / 100))
                const resizedLogo = await sharp(logoBuffer)
                    .resize(watermarkWidth, null, { fit: 'inside' })
                    .ensureAlpha()
                    .composite([{
                        input: Buffer.from([255, 255, 255, opacity]),
                        raw: { width: 1, height: 1, channels: 4 },
                        tile: true,
                        blend: 'dest-in'
                    }])
                    .toBuffer()

                // Get watermark dimensions
                const logoMetadata = await sharp(resizedLogo).metadata()
                const logoHeight = logoMetadata.height || 100

                // Calculate position
                const pos = getWatermarkPosition(
                    watermark.position,
                    targetWidth,
                    targetHeight,
                    watermarkWidth,
                    logoHeight
                )

                // Composite watermark onto image
                pipeline = pipeline.composite([{
                    input: resizedLogo,
                    left: Math.max(0, pos.left),
                    top: Math.max(0, pos.top)
                }])
            } catch (err) {
                console.error('Error applying watermark:', err)
            }
        }
    }

    // Convert to target format with quality
    let outputBuffer: Buffer

    switch (format) {
        case 'webp':
            outputBuffer = await pipeline.webp({ quality }).toBuffer()
            break
        case 'jpeg':
            outputBuffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
            break
        case 'png':
            outputBuffer = await pipeline.png({ quality, compressionLevel: 9 }).toBuffer()
            break
        default:
            outputBuffer = await pipeline.webp({ quality }).toBuffer()
    }

    return {
        buffer: outputBuffer,
        format,
        width: targetWidth,
        height: targetHeight
    }
}

/**
 * Process image using saved settings from database
 */
export async function processImageWithSettings(
    inputBuffer: Buffer
): Promise<{ buffer: Buffer; format: string; width: number; height: number } | null> {
    const settings = await getImageSettings()

    // If no settings or optimization disabled, return null (use original)
    if (!settings || !settings.enabled) {
        return null
    }

    const options: OptimizeOptions = {
        format: settings.format,
        quality: settings.quality,
        maxWidth: settings.max_width,
        maxHeight: settings.max_height
    }

    // Add watermark if enabled
    if (settings.watermark_enabled && settings.watermark_logo_url) {
        options.watermark = {
            logoUrl: settings.watermark_logo_url,
            position: settings.watermark_position,
            opacity: settings.watermark_opacity,
            size: settings.watermark_size
        }
    }

    return optimizeImage(inputBuffer, options)
}

/**
 * Get MIME type for format
 */
export function getMimeType(format: string): string {
    switch (format) {
        case 'webp': return 'image/webp'
        case 'jpeg': return 'image/jpeg'
        case 'png': return 'image/png'
        default: return 'image/webp'
    }
}

/**
 * Get file extension for format
 */
export function getExtension(format: string): string {
    switch (format) {
        case 'webp': return 'webp'
        case 'jpeg': return 'jpg'
        case 'png': return 'png'
        default: return 'webp'
    }
}
