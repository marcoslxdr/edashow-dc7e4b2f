'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getEventPhotoProcessingConfig } from '@/lib/event-photos/config'
import { isValidDriveUrl } from '@/lib/event-videos/parse-url'
import { renderPublicWebp, renderThumbnailWebp } from '@/lib/event-photos/process-variants'
import { revalidatePath } from 'next/cache'
import { readFile } from 'fs/promises'
import { join } from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

const extractPath = (url: string) => {
    try {
        const urlObj = new URL(url)
        const match = urlObj.pathname.match(/\/public\/[^/]+\/(.+)/)
        return match ? match[1] : null
    } catch {
        return null
    }
}

async function getWatermarkBuffer() {
    const logoPath = join(process.cwd(), 'public', 'watermark-logo.png')
    try {
        return await readFile(logoPath)
    } catch {
        throw new Error(
            'Arquivo de marca d\'água ausente. Adicione `public/watermark-logo.png` (PNG com transparência).',
        )
    }
}

export async function getGalleryByEventId(eventId: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('event_photo_galleries')
        .select('*, photos:event_photos(*)')
        .eq('event_id', eventId)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
}

export async function getGalleryByEventSlug(slug: string) {
    const supabase = createAdminClient()
    
    // Buscar evento pelo slug
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('slug', slug)
        .single()
    
    if (eventError && eventError.code !== 'PGRST116') throw eventError
    if (!event) return null
    
    const { data, error } = await supabase
        .from('event_photo_galleries')
        .select('*, photos:event_photos(*)')
        .eq('event_id', event.id)
        .eq('is_public', true)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) return null
    
    // Ordenar fotos
    if (data.photos) {
        data.photos.sort((a: any, b: any) => a.display_order - b.display_order)
    }
    
    return data
}

export async function createOrUpdateGallery(data: {
    id?: string
    event_id: string
    title: string
    description?: string
    is_public?: boolean
    contact_email?: string
    contact_whatsapp?: string
    drive_download_url?: string
}) {
    if (!data.event_id || typeof data.event_id !== 'string') {
        throw new Error('Salve o evento antes de criar a galeria (evento precisa existir no banco).')
    }

    const supabase = createAdminClient()

    const driveRaw = data.drive_download_url?.trim()
    if (driveRaw && !isValidDriveUrl(driveRaw)) {
        throw new Error('Use um link válido do Google Drive (drive.google.com).')
    }

    const { id, ...galleryData } = data
    if ('drive_download_url' in galleryData) {
        galleryData.drive_download_url = driveRaw || null
    }
    
    let result
    if (id) {
        result = await supabase
            .from('event_photo_galleries')
            .update(galleryData)
            .eq('id', id)
            .select()
            .single()
    } else {
        result = await supabase
            .from('event_photo_galleries')
            .insert([galleryData])
            .select()
            .single()
    }
    
    if (result.error) throw result.error
    revalidatePath('/events')
    return result.data
}

type UploadedObject = { bucket: 'event-photos-original' | 'event-photos-public'; path: string }

async function rollbackUploaded(supabase: ReturnType<typeof createAdminClient>, uploaded: UploadedObject[]) {
    for (const { bucket, path } of [...uploaded].reverse()) {
        await supabase.storage.from(bucket).remove([path])
    }
}

export async function uploadEventPhotos(galleryId: string, formData: FormData) {
    const supabase = createAdminClient()
    const files = formData.getAll('photos') as File[]

    if (!files.length) throw new Error('Nenhuma foto enviada')

    const processingConfig = getEventPhotoProcessingConfig()
    const watermarkBuffer = await getWatermarkBuffer()
    const uploadedPhotos: any[] = []

    for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error(`Tipo não permitido: ${file.name}. Use JPG, PNG ou WEBP.`)
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`Arquivo muito grande: ${file.name}. Máximo 20MB.`)
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        let publicBuffer: Buffer
        let thumbnailBuffer: Buffer
        try {
            publicBuffer = await renderPublicWebp(buffer, watermarkBuffer, processingConfig)
            thumbnailBuffer = await renderThumbnailWebp(buffer, watermarkBuffer, processingConfig)
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            throw new Error(`Falha ao processar ${file.name}: ${msg}`)
        }

        const originalPath = `${galleryId}/${fileName}.${ext}`
        const publicPath = `${galleryId}/${fileName}_public.webp`
        const thumbPath = `${galleryId}/${fileName}_thumb.webp`
        const uploaded: UploadedObject[] = []

        try {
            const { error: originalError } = await supabase
                .storage
                .from('event-photos-original')
                .upload(originalPath, buffer, {
                    contentType: file.type,
                    upsert: false,
                })

            if (originalError) throw originalError
            uploaded.push({ bucket: 'event-photos-original', path: originalPath })

            const { error: publicError } = await supabase.storage.from('event-photos-public').upload(publicPath, publicBuffer, {
                contentType: 'image/webp',
                upsert: false,
            })

            if (publicError) throw publicError
            uploaded.push({ bucket: 'event-photos-public', path: publicPath })

            const { error: thumbError } = await supabase.storage.from('event-photos-public').upload(thumbPath, thumbnailBuffer, {
                contentType: 'image/webp',
                upsert: false,
            })

            if (thumbError) throw thumbError
            uploaded.push({ bucket: 'event-photos-public', path: thumbPath })

            const { data: publicUrl } = supabase.storage.from('event-photos-public').getPublicUrl(publicPath)

            const { data: thumbUrl } = supabase.storage.from('event-photos-public').getPublicUrl(thumbPath)

            const { data: originalUrl } = supabase.storage.from('event-photos-original').getPublicUrl(originalPath)

            const { data: photoRecord, error: photoError } = await supabase
                .from('event_photos')
                .insert([
                    {
                        gallery_id: galleryId,
                        original_url: originalUrl.publicUrl,
                        watermarked_url: publicUrl.publicUrl,
                        thumbnail_url: thumbUrl.publicUrl,
                        file_size: file.size,
                        display_order: 0,
                    },
                ])
                .select()
                .single()

            if (photoError) throw photoError
            uploadedPhotos.push(photoRecord)
        } catch (e) {
            await rollbackUploaded(supabase, uploaded)
            throw e
        }
    }

    revalidatePath('/cms/events')
    return uploadedPhotos
}

export async function deleteEventPhoto(photoId: string) {
    const supabase = createAdminClient()
    
    // Buscar foto para obter paths
    const { data: photo, error: fetchError } = await supabase
        .from('event_photos')
        .select('*')
        .eq('id', photoId)
        .single()
    
    if (fetchError) throw fetchError
    
    const originalPath = extractPath(photo.original_url)
    const watermarkedPath = extractPath(photo.watermarked_url)
    const thumbnailPath = extractPath(photo.thumbnail_url)
    
    // Deletar do storage
    if (originalPath) {
        await supabase.storage.from('event-photos-original').remove([originalPath])
    }
    if (watermarkedPath) {
        await supabase.storage.from('event-photos-public').remove([watermarkedPath])
    }
    if (thumbnailPath) {
        await supabase.storage.from('event-photos-public').remove([thumbnailPath])
    }
    
    // Deletar do banco
    const { error } = await supabase.from('event_photos').delete().eq('id', photoId)
    if (error) throw error
    
    revalidatePath('/cms/events')
}

export async function reorderEventPhotos(photoIds: string[]) {
    const supabase = createAdminClient()
    
    await Promise.all(photoIds.map((id, index) =>
        supabase.from('event_photos').update({ display_order: index }).eq('id', id)
    ))
    
    revalidatePath('/cms/events')
}

export async function deleteGallery(galleryId: string) {
    const supabase = createAdminClient()
    
    // Buscar todas as fotos
    const { data: photos, error: photosError } = await supabase
        .from('event_photos')
        .select('*')
        .eq('gallery_id', galleryId)
    
    if (photosError) throw photosError
    
    // Deletar arquivos do storage
    for (const photo of photos || []) {
        const originalPath = extractPath(photo.original_url)
        const watermarkedPath = extractPath(photo.watermarked_url)
        const thumbnailPath = extractPath(photo.thumbnail_url)
        
        if (originalPath) {
            await supabase.storage.from('event-photos-original').remove([originalPath])
        }
        if (watermarkedPath) {
            await supabase.storage.from('event-photos-public').remove([watermarkedPath])
        }
        if (thumbnailPath) {
            await supabase.storage.from('event-photos-public').remove([thumbnailPath])
        }
    }
    
    // Deletar galeria (cascade deleta fotos)
    const { error } = await supabase
        .from('event_photo_galleries')
        .delete()
        .eq('id', galleryId)
    
    if (error) throw error
    revalidatePath('/cms/events')
}
