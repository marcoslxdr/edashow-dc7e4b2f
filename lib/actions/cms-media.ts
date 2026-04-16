'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { processImageWithSettings, getMimeType, getExtension } from '@/lib/images/image-optimizer'

export async function getMedia() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('media')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export async function uploadMedia(formData: FormData) {
    // Use admin client to bypass RLS
    const supabase = await createAdminClient()
    const file = formData.get('file') as File

    // Check if it's an image
    const isImage = file.type.startsWith('image/')

    let fileBuffer: Buffer
    let finalFilename: string
    let finalMimeType: string
    let finalSize: number

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const originalBuffer = Buffer.from(arrayBuffer)

    if (isImage) {
        // Try to optimize the image
        try {
            const optimized = await processImageWithSettings(originalBuffer)

            if (optimized) {
                // Use optimized image
                fileBuffer = optimized.buffer
                finalMimeType = getMimeType(optimized.format)
                finalSize = fileBuffer.length

                // Generate new filename with correct extension
                const baseName = file.name.replace(/\.[^.]+$/, '')
                finalFilename = `${Date.now()}-${baseName}.${getExtension(optimized.format)}`

                console.log(`Image optimized: ${file.name} (${file.size} bytes) -> ${finalFilename} (${finalSize} bytes)`)
            } else {
                // Optimization disabled or failed, use original
                fileBuffer = originalBuffer
                finalFilename = `${Date.now()}-${file.name}`
                finalMimeType = file.type
                finalSize = file.size
            }
        } catch (error) {
            console.error('Error optimizing image:', error)
            // Fallback to original
            fileBuffer = originalBuffer
            finalFilename = `${Date.now()}-${file.name}`
            finalMimeType = file.type
            finalSize = file.size
        }
    } else {
        // Non-image files, use as-is
        fileBuffer = originalBuffer
        finalFilename = `${Date.now()}-${file.name}`
        finalMimeType = file.type
        finalSize = file.size
    }

    const bucket = process.env.SUPABASE_BUCKET || 'media'

    // 1. Upload file to storage
    const { data: storageData, error: storageError } = await supabase.storage
        .from(bucket)
        .upload(finalFilename, fileBuffer, {
            contentType: finalMimeType
        })

    if (storageError) throw storageError

    // 2. Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(finalFilename)

    // 3. Save reference in media table
    const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .insert([
            {
                filename: finalFilename,
                url: publicUrl,
                mime_type: finalMimeType,
                filesize: finalSize,
                title: file.name
            }
        ])
        .select()
        .single()

    if (mediaError) throw mediaError

    revalidatePath('/cms/media')
    return mediaData
}


export async function deleteMedia(id: string, filename: string) {
    // Use admin client to bypass RLS
    const supabase = await createAdminClient()

    const bucket = process.env.SUPABASE_BUCKET || 'media'

    // 1. Delete from storage
    const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([filename])

    if (storageError) throw storageError

    // 2. Delete from database
    const { error: dbError } = await supabase
        .from('media')
        .delete()
        .eq('id', id)

    if (dbError) throw dbError

    revalidatePath('/cms/media')
}
