'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { processImageWithSettings, getMimeType, getExtension } from '@/lib/images/image-optimizer'
import { requireCmsRole } from './cms-authz'

export async function getMedia() {
    await requireCmsRole()
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('media')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export async function uploadMedia(formData: FormData) {
    await requireCmsRole()
    // Use admin client to bypass RLS
    const supabase = await createAdminClient()
    const file = formData.get('file') as File

    if (!file || !(file instanceof File)) throw new Error('Arquivo não informado')
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    if (!allowedTypes.has(file.type)) throw new Error('Formato de imagem não permitido')
    if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo muito grande. Máximo de 10MB.')

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
                const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
                finalFilename = `${Date.now()}-${baseName}.${getExtension(optimized.format)}`

                console.log(`Image optimized: ${file.name} (${file.size} bytes) -> ${finalFilename} (${finalSize} bytes)`)
            } else {
                // Optimization disabled or failed, use original
                fileBuffer = originalBuffer
                finalFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
                finalMimeType = file.type
                finalSize = file.size
            }
        } catch (error) {
            console.error('Error optimizing image:', error)
            // Fallback to original
            fileBuffer = originalBuffer
            finalFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
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
    await requireCmsRole()
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
