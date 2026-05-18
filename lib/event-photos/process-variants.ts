import sharp from 'sharp'
import type { EventPhotoProcessingConfig } from './config'

async function rgbaLogoWithOpacity(
    watermarkPng: Buffer,
    targetImageWidthPx: number,
    config: EventPhotoProcessingConfig,
): Promise<Buffer> {
    const logoWidth = Math.max(
        1,
        Math.round(targetImageWidthPx * (config.watermarkWidthPercent / 100)),
    )

    const { data, info } = await sharp(watermarkPng)
        .resize(logoWidth, null, { withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

    const opacity = config.watermarkOpacity
    const n = data.length
    for (let i = 0; i < n; i += 4) {
        data[i + 3] = Math.min(255, Math.round(data[i + 3] * opacity))
    }

    return sharp(data, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4,
        },
    })
        .png()
        .toBuffer()
}

async function toResizedRgbBuffer(originalBuffer: Buffer, maxWidth: number): Promise<Buffer> {
    return sharp(originalBuffer)
        .rotate()
        .resize(maxWidth, null, { withoutEnlargement: true })
        .toBuffer()
}

export async function renderPublicWebp(
    originalBuffer: Buffer,
    watermarkPng: Buffer,
    config: EventPhotoProcessingConfig,
): Promise<Buffer> {
    const resized = await toResizedRgbBuffer(originalBuffer, config.publicMaxWidth)
    const meta = await sharp(resized).metadata()
    const w = meta.width ?? config.publicMaxWidth
    const logo = await rgbaLogoWithOpacity(watermarkPng, w, config)

    return sharp(resized)
        .composite([
            {
                input: logo,
                gravity: config.watermarkGravity,
                blend: 'over',
                left: config.watermarkPaddingPx,
                top: config.watermarkPaddingPx,
            },
        ])
        .webp({ quality: config.webpQualityPublic })
        .toBuffer()
}

export async function renderThumbnailWebp(
    originalBuffer: Buffer,
    watermarkPng: Buffer,
    config: EventPhotoProcessingConfig,
): Promise<Buffer> {
    const resized = await toResizedRgbBuffer(originalBuffer, config.thumbWidth)

    if (!config.watermarkOnThumbnail) {
        return sharp(resized).webp({ quality: config.webpQualityThumb }).toBuffer()
    }

    const meta = await sharp(resized).metadata()
    const w = meta.width ?? config.thumbWidth
    const logo = await rgbaLogoWithOpacity(watermarkPng, w, config)

    return sharp(resized)
        .composite([
            {
                input: logo,
                gravity: config.watermarkGravity,
                blend: 'over',
                left: config.watermarkPaddingPx,
                top: config.watermarkPaddingPx,
            },
        ])
        .webp({ quality: config.webpQualityThumb })
        .toBuffer()
}
