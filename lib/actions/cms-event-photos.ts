'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
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
    return readFile(logoPath)
}

export async function getGalleryByEventId(eventId: string) {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('event_photo_galleries')
        .select('*, photos:event_photos(*)')
        .eq('event_id', eventId)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
}

export async function getGalleryByEventSlug(slug: string) {
    const supabase = await createAdminClient()
    
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
}) {
    const supabase = await createAdminClient()
    
    const { id, ...galleryData } = data
    
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

export async function uploadEventPhotos(galleryId: string, formData: FormData) {
    const supabase = await createAdminClient()
    const files = formData.getAll('photos') as File[]
    
    if (!files.length) throw new Error('Nenhuma foto enviada')
    
    const watermarkBuffer = await getWatermarkBuffer()
    const uploadedPhotos: any[] = []
    
    for (const file of files) {
        // Validação
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error(`Tipo não permitido: ${file.name}. Use JPG, PNG ou WEBP.`)
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`Arquivo muito grande: ${file.name}. Máximo 20MB.`)
        }
        
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        
        // Upload original
        const { data: originalData, error: originalError } = await supabase
            .storage
            .from('event-photos-original')
            .upload(`${galleryId}/${fileName}.${ext}`, buffer, {
                contentType: file.type,
                upsert: false
            })
        
        if (originalError) throw originalError
        
        // Processar com sharp
        const imageMetadata = await sharp(buffer).metadata()
        const imageWidth = imageMetadata.width || 1600
        const logoWidth = Math.round(imageWidth * 0.12)
        
        // Redimensionar logo proporcionalmente
        const resizedLogo = await sharp(watermarkBuffer)
            .resize(logoWidth, null, { withoutEnlargement: true })
            .toBuffer()
        
        // Versão pública com watermark
        const publicBuffer = await sharp(buffer)
            .resize(1600, null, { withoutEnlargement: true })
            .webp({ quality: 80 })
            .composite([{
                input: resizedLogo,
                gravity: 'southeast',
                blend: 'over',
                left: 24,
                top: 24
            }])
            .toBuffer()
        
        // Thumbnail
        const thumbnailBuffer = await sharp(buffer)
            .resize(400, null, { withoutEnlargement: true })
            .webp({ quality: 70 })
            .toBuffer()
        
        // Upload versão pública
        const { data: publicData, error: publicError } = await supabase
            .storage
            .from('event-photos-public')
            .upload(`${galleryId}/${fileName}_public.webp`, publicBuffer, {
                contentType: 'image/webp',
                upsert: false
            })
        
        if (publicError) throw publicError
        
        // Upload thumbnail
        const { data: thumbData, error: thumbError } = await supabase
            .storage
            .from('event-photos-public')
            .upload(`${galleryId}/${fileName}_thumb.webp`, thumbnailBuffer, {
                contentType: 'image/webp',
                upsert: false
            })
        
        if (thumbError) throw thumbError
        
        // Construir URLs públicas
        const { data: publicUrl } = supabase
            .storage
            .from('event-photos-public')
            .getPublicUrl(`${galleryId}/${fileName}_public.webp`)
        
        const { data: thumbUrl } = supabase
            .storage
            .from('event-photos-public')
            .getPublicUrl(`${galleryId}/${fileName}_thumb.webp`)
        
        const { data: originalUrl } = supabase
            .storage
            .from('event-photos-original')
            .getPublicUrl(`${galleryId}/${fileName}.${ext}`)
        
        // Inserir no banco
        const { data: photoRecord, error: photoError } = await supabase
            .from('event_photos')
            .insert([{
                gallery_id: galleryId,
                original_url: originalUrl.publicUrl,
                watermarked_url: publicUrl.publicUrl,
                thumbnail_url: thumbUrl.publicUrl,
                file_size: file.size,
                display_order: 0
            }])
            .select()
            .single()
        
        if (photoError) throw photoError
        uploadedPhotos.push(photoRecord)
    }
    
    revalidatePath('/cms/events')
    return uploadedPhotos
}

export async function deleteEventPhoto(photoId: string) {
    const supabase = await createAdminClient()
    
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
    const supabase = await createAdminClient()
    
    await Promise.all(photoIds.map((id, index) =>
        supabase.from('event_photos').update({ display_order: index }).eq('id', id)
    ))
    
    revalidatePath('/cms/events')
}

export async function deleteGallery(galleryId: string) {
    const supabase = await createAdminClient()
    
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
