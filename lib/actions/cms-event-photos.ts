'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCmsRole } from './cms-authz'
import { toActionError } from '@/lib/supabase/action-error'
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
    await requireCmsRole()
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('event_photo_galleries')
        .select('*, photos:event_photos(*)')
        .eq('event_id', eventId)
        .single()

    if (error && error.code !== 'PGRST116') throw toActionError(error, 'Erro ao carregar galeria.')
    return data
}

export async function getGalleryByEventSlug(slug: string) {
    const supabase = await createClient()
    
    // Buscar evento pelo slug
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('slug', slug)
        .single()
    
    if (eventError && eventError.code !== 'PGRST116') throw toActionError(eventError, 'Erro ao buscar evento.')
    if (!event) return null
    
    const { data, error } = await supabase
        .from('event_photo_galleries')
        .select('*, photos:event_photos(*)')
        .eq('event_id', event.id)
        .eq('is_public', true)
        .single()

    if (error && error.code !== 'PGRST116') throw toActionError(error, 'Erro ao carregar galeria.')
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
    await requireCmsRole()
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
        galleryData.drive_download_url = driveRaw || undefined
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
    
    if (result.error) {
        throw toActionError(
            result.error,
            'Não foi possível salvar a galeria. Confira se as migrações de eventos foram aplicadas no Supabase.',
        )
    }
    revalidatePath('/events')
    return result.data
}

export async function ensureGalleryForEvent(eventId: string) {
    await requireCmsRole()
    const existing = await getGalleryByEventId(eventId)
    if (existing) return existing

    return createOrUpdateGallery({
        event_id: eventId,
        title: 'Galeria de Fotos',
        is_public: true,
    })
}

export async function attachExistingEventPhotos(galleryId: string, photoIds: string[]) {
    await requireCmsRole()
    if (!photoIds.length) return []

    const supabase = createAdminClient()
    const { data: sources, error: fetchError } = await supabase
        .from('event_photos')
        .select('original_url, watermarked_url, thumbnail_url, file_size')
        .in('id', photoIds)

    if (fetchError) throw toActionError(fetchError)
    if (!sources?.length) throw new Error('Nenhuma foto encontrada para copiar.')

    const { count } = await supabase
        .from('event_photos')
        .select('id', { count: 'exact', head: true })
        .eq('gallery_id', galleryId)

    let order = count ?? 0
    const rows = sources.map((s) => ({
        gallery_id: galleryId,
        original_url: s.original_url,
        watermarked_url: s.watermarked_url,
        thumbnail_url: s.thumbnail_url,
        file_size: s.file_size,
        display_order: order++,
    }))

    const { data, error } = await supabase.from('event_photos').insert(rows).select()
    if (error) throw toActionError(error)

    revalidatePath('/cms/events')
    revalidatePath('/events')
    return data
}

export async function searchEventGalleries(query: string, excludeEventId?: string) {
    await requireCmsRole()
    const supabase = createAdminClient()
    let q = supabase
        .from('event_photo_galleries')
        .select('id, title, event_id, events!inner(id, title, slug), photos:event_photos(id, thumbnail_url, watermarked_url)')
        .order('created_at', { ascending: false })
        .limit(20)

    if (excludeEventId) q = q.neq('event_id', excludeEventId)
    if (query.trim()) q = q.ilike('events.title', `%${query.trim()}%`)

    const { data, error } = await q
    if (error) throw toActionError(error)
    return data ?? []
}

type UploadedObject = { bucket: 'event-photos-original' | 'event-photos-public'; path: string }

async function rollbackUploaded(supabase: ReturnType<typeof createAdminClient>, uploaded: UploadedObject[]) {
    for (const { bucket, path } of [...uploaded].reverse()) {
        await supabase.storage.from(bucket).remove([path])
    }
}

async function insertProcessedPhotoFromBuffer(
    supabase: ReturnType<typeof createAdminClient>,
    galleryId: string,
    buffer: Buffer,
    mimeType: string,
    fileSize: number,
    sourceLabel: string,
) {
    const processingConfig = getEventPhotoProcessingConfig()
    const watermarkBuffer = await getWatermarkBuffer()

    const ext =
        mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    let publicBuffer: Buffer
    let thumbnailBuffer: Buffer
    try {
        publicBuffer = await renderPublicWebp(buffer, watermarkBuffer, processingConfig)
        thumbnailBuffer = await renderThumbnailWebp(buffer, watermarkBuffer, processingConfig)
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Falha ao processar ${sourceLabel}: ${msg}`)
    }

    const originalPath = `${galleryId}/${fileName}.${ext}`
    const publicPath = `${galleryId}/${fileName}_public.webp`
    const thumbPath = `${galleryId}/${fileName}_thumb.webp`
    const uploaded: UploadedObject[] = []

    try {
        const { error: originalError } = await supabase.storage
            .from('event-photos-original')
            .upload(originalPath, buffer, { contentType: mimeType, upsert: false })

        if (originalError) throw toActionError(originalError, 'Falha ao enviar foto original.')
        uploaded.push({ bucket: 'event-photos-original', path: originalPath })

        const { error: publicError } = await supabase.storage
            .from('event-photos-public')
            .upload(publicPath, publicBuffer, { contentType: 'image/webp', upsert: false })

        if (publicError) throw toActionError(publicError, 'Falha ao enviar foto pública.')
        uploaded.push({ bucket: 'event-photos-public', path: publicPath })

        const { error: thumbError } = await supabase.storage
            .from('event-photos-public')
            .upload(thumbPath, thumbnailBuffer, { contentType: 'image/webp', upsert: false })

        if (thumbError) throw toActionError(thumbError, 'Falha ao gerar miniatura.')
        uploaded.push({ bucket: 'event-photos-public', path: thumbPath })

        const { data: publicUrl } = supabase.storage.from('event-photos-public').getPublicUrl(publicPath)
        const { data: thumbUrl } = supabase.storage.from('event-photos-public').getPublicUrl(thumbPath)
        const { data: originalUrl } = supabase.storage
            .from('event-photos-original')
            .getPublicUrl(originalPath)

        const { data: photoRecord, error: photoError } = await supabase
            .from('event_photos')
            .insert([
                {
                    gallery_id: galleryId,
                    original_url: originalUrl.publicUrl,
                    watermarked_url: publicUrl.publicUrl,
                    thumbnail_url: thumbUrl.publicUrl,
                    file_size: fileSize,
                    display_order: 0,
                },
            ])
            .select()
            .single()

        if (photoError) throw toActionError(photoError, 'Falha ao registrar foto na galeria.')
        return photoRecord
    } catch (e) {
        await rollbackUploaded(supabase, uploaded)
        throw e
    }
}

export async function attachMediaToEventGallery(galleryId: string, mediaIds: string[]) {
    await requireCmsRole()
    if (!mediaIds.length) return []

    const supabase = createAdminClient()
    const { data: mediaRows, error } = await supabase
        .from('media')
        .select('id, url, filename, mime_type, filesize')
        .in('id', mediaIds)

    if (error) throw toActionError(error)
    if (!mediaRows?.length) throw new Error('Mídia não encontrada.')

    const uploaded: any[] = []
    for (const item of mediaRows) {
        const res = await fetch(item.url)
        if (!res.ok) {
            throw new Error(`Falha ao baixar ${item.filename ?? item.id}`)
        }
        const buffer = Buffer.from(await res.arrayBuffer())
        const mime = item.mime_type || 'image/jpeg'
        const photo = await insertProcessedPhotoFromBuffer(
            supabase,
            galleryId,
            buffer,
            mime,
            item.filesize ?? buffer.length,
            item.filename ?? `media-${item.id}`,
        )
        uploaded.push(photo)
    }

    revalidatePath('/cms/events')
    revalidatePath('/events')
    return uploaded
}

export async function uploadEventPhotos(galleryId: string, formData: FormData) {
    await requireCmsRole()
    const supabase = createAdminClient()
    const files = formData.getAll('photos') as File[]

    if (!files.length) throw new Error('Nenhuma foto enviada')

    const uploadedPhotos: any[] = []

    for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error(`Tipo não permitido: ${file.name}. Use JPG, PNG ou WEBP.`)
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`Arquivo muito grande: ${file.name}. Máximo 20MB.`)
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const photo = await insertProcessedPhotoFromBuffer(
            supabase,
            galleryId,
            buffer,
            file.type,
            file.size,
            file.name,
        )
        uploadedPhotos.push(photo)
    }

    revalidatePath('/cms/events')
    return uploadedPhotos
}

export async function deleteEventPhoto(photoId: string) {
    await requireCmsRole()
    const supabase = createAdminClient()
    
    // Buscar foto para obter paths
    const { data: photo, error: fetchError } = await supabase
        .from('event_photos')
        .select('*')
        .eq('id', photoId)
        .single()
    
    if (fetchError) throw toActionError(fetchError)
    
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
    if (error) throw toActionError(error)
    
    revalidatePath('/cms/events')
}

export async function reorderEventPhotos(photoIds: string[]) {
    await requireCmsRole()
    const supabase = createAdminClient()
    
    await Promise.all(photoIds.map((id, index) =>
        supabase.from('event_photos').update({ display_order: index }).eq('id', id)
    ))
    
    revalidatePath('/cms/events')
}

export async function deleteGallery(galleryId: string) {
    await requireCmsRole()
    const supabase = createAdminClient()
    
    // Buscar todas as fotos
    const { data: photos, error: photosError } = await supabase
        .from('event_photos')
        .select('*')
        .eq('gallery_id', galleryId)
    
    if (photosError) throw toActionError(photosError)
    
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
    
    if (error) throw toActionError(error)
    revalidatePath('/cms/events')
}
