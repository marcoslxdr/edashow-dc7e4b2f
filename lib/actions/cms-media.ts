'use server'

import { sql } from '@/lib/db/client'
import { put, del } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import { processImageWithSettings, getMimeType, getExtension } from '@/lib/images/image-optimizer'

export async function getMedia() {
    const data = await sql`
        SELECT * FROM media ORDER BY created_at DESC
    `
    return data
}

export async function uploadMedia(formData: FormData) {
    const file = formData.get('file') as File

    const isImage = file.type.startsWith('image/')

    let fileBuffer: Buffer
    let finalFilename: string
    let finalMimeType: string
    let finalSize: number

    const arrayBuffer = await file.arrayBuffer()
    const originalBuffer = Buffer.from(arrayBuffer)

    if (isImage) {
        try {
            const optimized = await processImageWithSettings(originalBuffer)

            if (optimized) {
                fileBuffer = optimized.buffer
                finalMimeType = getMimeType(optimized.format)
                finalSize = fileBuffer.length
                const baseName = file.name.replace(/\.[^.]+$/, '')
                finalFilename = `${Date.now()}-${baseName}.${getExtension(optimized.format)}`
                console.log(`Image optimized: ${file.name} (${file.size} bytes) -> ${finalFilename} (${finalSize} bytes)`)
            } else {
                fileBuffer = originalBuffer
                finalFilename = `${Date.now()}-${file.name}`
                finalMimeType = file.type
                finalSize = file.size
            }
        } catch (error) {
            console.error('Error optimizing image:', error)
            fileBuffer = originalBuffer
            finalFilename = `${Date.now()}-${file.name}`
            finalMimeType = file.type
            finalSize = file.size
        }
    } else {
        fileBuffer = originalBuffer
        finalFilename = `${Date.now()}-${file.name}`
        finalMimeType = file.type
        finalSize = file.size
    }

    // Upload to Vercel Blob
    const blob = await put(finalFilename, fileBuffer, {
        access: 'public',
        contentType: finalMimeType,
    })

    // Save reference in media table
    const rows = await sql`
        INSERT INTO media (filename, url, mime_type, filesize, title)
        VALUES (${finalFilename}, ${blob.url}, ${finalMimeType}, ${finalSize}, ${file.name})
        RETURNING *
    `

    revalidatePath('/cms/media')
    return rows[0]
}

export async function deleteMedia(id: string, url: string) {
    // Delete from Vercel Blob
    await del(url)

    // Delete from database
    await sql`DELETE FROM media WHERE id = ${id}`

    revalidatePath('/cms/media')
}
