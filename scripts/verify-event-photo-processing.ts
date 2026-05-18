import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { getEventPhotoProcessingConfig } from '../lib/event-photos/config'
import { renderPublicWebp, renderThumbnailWebp } from '../lib/event-photos/process-variants'

async function main() {
    const logoPath = join(process.cwd(), 'public', 'watermark-logo.png')
    let watermark: Buffer
    try {
        watermark = await readFile(logoPath)
    } catch {
        console.error('FAIL: coloque public/watermark-logo.png para rodar este script.')
        process.exit(1)
    }

    const fixture = await sharp({
        create: {
            width: 2000,
            height: 1200,
            channels: 3,
            background: { r: 200, g: 100, b: 40 },
        },
    })
        .jpeg()
        .toBuffer()

    const config = getEventPhotoProcessingConfig()

    const publicBuf = await renderPublicWebp(fixture, watermark, config)
    const pubMeta = await sharp(publicBuf).metadata()
    if (pubMeta.format !== 'webp') {
        console.error('FAIL: público não é WebP:', pubMeta.format)
        process.exit(1)
    }
    if ((pubMeta.width ?? 0) > config.publicMaxWidth) {
        console.error('FAIL: largura pública maior que max', pubMeta.width, config.publicMaxWidth)
        process.exit(1)
    }

    const thumbConfig = {
        ...config,
        watermarkOnThumbnail: false,
    }
    const thumbBuf = await renderThumbnailWebp(fixture, watermark, thumbConfig)
    let thumbMeta = await sharp(thumbBuf).metadata()
    if (thumbMeta.format !== 'webp') {
        console.error('FAIL: thumb não é WebP')
        process.exit(1)
    }
    if ((thumbMeta.width ?? 0) > config.thumbWidth) {
        console.error('FAIL: largura thumb maior que max')
        process.exit(1)
    }

    const thumbMarked = await renderThumbnailWebp(fixture, watermark, {
        ...config,
        watermarkOnThumbnail: true,
    })
    thumbMeta = await sharp(thumbMarked).metadata()
    if (thumbMeta.format !== 'webp') {
        console.error('FAIL: thumb com marca não é WebP')
        process.exit(1)
    }

    console.log('OK: event photo processing (public + thumb + thumb+marca).')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
