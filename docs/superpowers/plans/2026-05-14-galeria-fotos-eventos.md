# Galeria de Fotos de Eventos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar sistema de galeria de fotos vinculado a eventos, com upload admin-only, marca d'água automática via sharp, otimização de imagens, e página pública com botão de contato para alta qualidade.

**Architecture:** Server-side image processing com sharp (já no projeto). Dois buckets Supabase Storage: privado para originais, público para versões watermark + thumbnail. Duas tabelas novas no banco. CMS usa nova aba no EventEditor. Página pública em `/events/[slug]/gallery`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind, shadcn/ui, Supabase, sharp, sonner (toasts), lucide-react.

---

## File Structure

| File | Responsibility |
|------|-------------|
| `supabase/migrations/20260514_create_event_photo_tables.sql` | DDL das tabelas + RLS policies + bucket setup |
| `lib/actions/cms-event-photos.ts` | Server actions: CRUD de galeria/fotos, upload com sharp, reorder, delete |
| `public/watermark-logo.png` | Logo do EdaShow com fundo transparente para composição |
| `components/cms/GalleryUploader.tsx` | Área de drop + upload de múltiplas fotos no CMS |
| `components/cms/GalleryPhotoGrid.tsx` | Grid de fotos com drag-and-drop de ordenação no CMS |
| `components/GalleryLightbox.tsx` | Lightbox reutilizável (CMS + público) |
| `app/events/[slug]/gallery/page.tsx` | Página pública da galeria |
| `components/cms/EventEditor.tsx` | MODIFICAR: adicionar aba "Galeria de Fotos" |
| `app/events/[slug]/page.tsx` | MODIFICAR: adicionar link para galeria quando existir |
| `app/cms/events/page.tsx` | MODIFICAR: badge indicando eventos com galeria |

---

### Task 1: Migration do Banco de Dados

**Files:**
- Create: `supabase/migrations/20260514_create_event_photo_tables.sql`

- [ ] **Step 1: Escrever migration completa**

```sql
-- ============================================
-- Galeria de Fotos de Eventos
-- ============================================

-- Tabela de galerias vinculadas a eventos
CREATE TABLE IF NOT EXISTS event_photo_galleries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Galeria de Fotos',
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    contact_email TEXT,
    contact_whatsapp TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id)
);

-- Tabela de fotos dentro de uma galeria
CREATE TABLE IF NOT EXISTS event_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gallery_id UUID NOT NULL REFERENCES event_photo_galleries(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    watermarked_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE event_photo_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

-- Policies para event_photo_galleries
CREATE POLICY "Allow public read galleries"
    ON event_photo_galleries FOR SELECT
    TO anon, authenticated
    USING (is_public = true);

CREATE POLICY "Allow admin full access galleries"
    ON event_photo_galleries FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- Policies para event_photos
CREATE POLICY "Allow public read photos"
    ON event_photos FOR SELECT
    TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM event_photo_galleries
        WHERE event_photo_galleries.id = event_photos.gallery_id
        AND event_photo_galleries.is_public = true
    ));

CREATE POLICY "Allow admin full access photos"
    ON event_photos FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_event_photo_galleries_updated_at ON event_photo_galleries;
CREATE TRIGGER update_event_photo_galleries_updated_at
    BEFORE UPDATE ON event_photo_galleries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260514_create_event_photo_tables.sql
git commit -m "feat(db): create event photo gallery tables with RLS"
```

---

### Task 2: Criar Buckets de Storage no Supabase

**Files:**
- Create: `supabase/migrations/20260514_create_photo_buckets.sql`

- [ ] **Step 1: Escrever migration de buckets**

```sql
-- Criar buckets para fotos de eventos
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES 
    ('event-photos-original', 'event-photos-original', false, false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('event-photos-public', 'event-photos-public', true, false, 10485760, ARRAY['image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- Policy: anon pode ler bucket publico
CREATE POLICY "Allow public read public photos"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'event-photos-public');

-- Policy: authenticated (admin via service role bypass) pode tudo nos buckets
CREATE POLICY "Allow admin full access photo buckets"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id IN ('event-photos-original', 'event-photos-public'))
    WITH CHECK (bucket_id IN ('event-photos-original', 'event-photos-public'));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260514_create_photo_buckets.sql
git commit -m "feat(storage): create event photo buckets with policies"
```

---

### Task 3: Preparar Logo para Marca d'Água

**Files:**
- Create: `public/watermark-logo.png`

- [ ] **Step 1: Localizar logo existente**

Buscar o logo atual do site em `public/` (ex: `public/logo.png`, `public/logo.svg`, ou similar).

```bash
ls /Volumes/SSDdoMarcos/Projetos/edashow-dc7e4b2f/public/ | grep -i logo
```

- [ ] **Step 2: Converter para PNG com fundo transparente**

Se o logo existir como SVG ou PNG branco, criar uma versão adequada para marca d'água (colorida ou branca com transparência). Se não houver logo adequado, criar um `watermark-logo.png` 256x256 com o texto "EDA SHOW" em branco com transparência.

Use ImageMagick ou sharp via script Node:

```bash
npx tsx -e "
const sharp = require('sharp');
sharp({
  create: { width: 256, height: 256, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } }
})
.svg('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\"><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"white\" font-size=\"32\" font-family=\"sans-serif\" font-weight=\"bold\">EDA SHOW</text></svg>')
.png()
.toFile('public/watermark-logo.png')
.then(() => console.log('Logo criado'))
.catch(console.error);
"
```

Se já houver um logo PNG/SVG adequado, apenas copiá-lo:
```bash
cp /Volumes/SSDdoMarcos/Projetos/edashow-dc7e4b2f/public/logo.png /Volumes/SSDdoMarcos/Projetos/edashow-dc7e4b2f/public/watermark-logo.png
```

- [ ] **Step 3: Commit**

```bash
git add public/watermark-logo.png
git commit -m "feat(assets): add watermark logo for photo processing"
```

---

### Task 4: Server Actions — CRUD de Galeria e Fotos

**Files:**
- Create: `lib/actions/cms-event-photos.ts`

- [ ] **Step 1: Escrever server actions**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import { join } from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

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
    
    if (eventError) throw eventError
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
    revalidatePath('/cms/events')
    revalidatePath(`/events/${data.event_id}`)
    return result.data
}

export async function uploadEventPhotos(galleryId: string, formData: FormData) {
    const supabase = await createAdminClient()
    const files = formData.getAll('photos') as File[]
    
    if (!files.length) throw new Error('Nenhuma foto enviada')
    
    const watermarkBuffer = await getWatermarkBuffer()
    const uploadedPhotos = []
    
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
    
    // Extrair paths dos URLs
    const extractPath = (url: string) => {
        try {
            const urlObj = new URL(url)
            const pathParts = urlObj.pathname.split('/')
            // Pegar a parte após o bucket name
            return pathParts.slice(3).join('/')
        } catch {
            return null
        }
    }
    
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
    
    const updates = photoIds.map((id, index) => ({
        id,
        display_order: index
    }))
    
    for (const update of updates) {
        const { error } = await supabase
            .from('event_photos')
            .update({ display_order: update.display_order })
            .eq('id', update.id)
        
        if (error) throw error
    }
    
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
        const extractPath = (url: string) => {
            try {
                const urlObj = new URL(url)
                const pathParts = urlObj.pathname.split('/')
                return pathParts.slice(3).join('/')
            } catch {
                return null
            }
        }
        
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/cms-event-photos.ts
git commit -m "feat(actions): add event photo gallery CRUD server actions"
```

---

### Task 5: Componente GalleryUploader (CMS)

**Files:**
- Create: `components/cms/GalleryUploader.tsx`

- [ ] **Step 1: Criar componente de upload**

```tsx
'use client'

import React, { useCallback, useState } from 'react'
import { Upload, X, ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadEventPhotos } from '@/lib/actions/cms-event-photos'
import { toast } from 'sonner'

interface GalleryUploaderProps {
    galleryId: string
    onUploadComplete: () => void
}

export function GalleryUploader({ galleryId, onUploadComplete }: GalleryUploaderProps) {
    const [files, setFiles] = useState<File[]>([])
    const [previews, setPreviews] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)

    const handleFiles = useCallback((newFiles: FileList | null) => {
        if (!newFiles) return
        
        const validFiles: File[] = []
        const validPreviews: string[] = []
        
        Array.from(newFiles).forEach(file => {
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                toast.error(`${file.name}: tipo não suportado. Use JPG, PNG ou WEBP.`)
                return
            }
            if (file.size > 20 * 1024 * 1024) {
                toast.error(`${file.name}: arquivo muito grande (máx 20MB).`)
                return
            }
            validFiles.push(file)
            validPreviews.push(URL.createObjectURL(file))
        })
        
        setFiles(prev => [...prev, ...validFiles])
        setPreviews(prev => [...prev, ...validPreviews])
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
    }, [handleFiles])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
    }, [])

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
        setPreviews(prev => {
            URL.revokeObjectURL(prev[index])
            return prev.filter((_, i) => i !== index)
        })
    }

    const handleUpload = async () => {
        if (!files.length) return
        
        setUploading(true)
        try {
            const formData = new FormData()
            files.forEach(file => formData.append('photos', file))
            
            await uploadEventPhotos(galleryId, formData)
            toast.success(`${files.length} foto(s) enviada(s) com sucesso!`)
            setFiles([])
            setPreviews([])
            onUploadComplete()
        } catch (error) {
            console.error('Erro no upload:', error)
            toast.error('Erro ao enviar fotos. Tente novamente.')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                    dragOver 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
            >
                <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                    id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer block">
                    <ImagePlus className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 font-medium">
                        Arraste fotos aqui ou <span className="text-orange-500 underline">clique para selecionar</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        JPG, PNG, WEBP · Máx 20MB por foto
                    </p>
                </label>
            </div>

            {/* Previews */}
            {previews.length > 0 && (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">
                        {previews.length} foto(s) selecionada(s)
                    </p>
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                        {previews.map((preview, index) => (
                            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                                <img 
                                    src={preview} 
                                    alt="Preview" 
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    onClick={() => removeFile(index)}
                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Enviar {files.length} foto(s)
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cms/GalleryUploader.tsx
git commit -m "feat(cms): add GalleryUploader component with drag-drop"
```

---

### Task 6: Componente GalleryPhotoGrid (CMS)

**Files:**
- Create: `components/cms/GalleryPhotoGrid.tsx`

- [ ] **Step 1: Criar grid com drag-and-drop nativo**

```tsx
'use client'

import React, { useState, useCallback } from 'react'
import { Trash2, GripVertical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteEventPhoto, reorderEventPhotos } from '@/lib/actions/cms-event-photos'
import { toast } from 'sonner'
import Image from 'next/image'

interface Photo {
    id: string
    thumbnail_url: string
    watermarked_url: string
    display_order: number
}

interface GalleryPhotoGridProps {
    photos: Photo[]
    onUpdate: () => void
}

export function GalleryPhotoGrid({ photos, onUpdate }: GalleryPhotoGridProps) {
    const [items, setItems] = useState<Photo[]>(
        [...photos].sort((a, b) => a.display_order - b.display_order)
    )
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [savingOrder, setSavingOrder] = useState(false)

    const handleDragStart = useCallback((index: number) => {
        setDraggedIndex(index)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index) return
        
        const newItems = [...items]
        const draggedItem = newItems[draggedIndex]
        newItems.splice(draggedIndex, 1)
        newItems.splice(index, 0, draggedItem)
        
        setItems(newItems)
        setDraggedIndex(index)
    }, [draggedIndex, items])

    const handleDragEnd = useCallback(async () => {
        setDraggedIndex(null)
        
        // Salvar nova ordem no banco
        setSavingOrder(true)
        try {
            const photoIds = items.map(p => p.id)
            await reorderEventPhotos(photoIds)
            toast.success('Ordem atualizada!')
        } catch (error) {
            console.error('Erro ao reordenar:', error)
            toast.error('Erro ao salvar ordem')
            // Reverter
            setItems([...photos].sort((a, b) => a.display_order - b.display_order))
        } finally {
            setSavingOrder(false)
        }
    }, [items, photos])

    const handleDelete = async (photoId: string) => {
        if (!confirm('Tem certeza que deseja excluir esta foto?')) return
        
        setDeletingId(photoId)
        try {
            await deleteEventPhoto(photoId)
            toast.success('Foto excluída!')
            setItems(prev => prev.filter(p => p.id !== photoId))
            onUpdate()
        } catch (error) {
            console.error('Erro ao excluir:', error)
            toast.error('Erro ao excluir foto')
        } finally {
            setDeletingId(null)
        }
    }

    if (!items.length) {
        return (
            <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                Nenhuma foto na galeria ainda.
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {savingOrder && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando ordem...
                </div>
            )}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {items.map((photo, index) => (
                    <div
                        key={photo.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`relative aspect-square rounded-lg overflow-hidden border border-gray-200 group cursor-move ${
                            draggedIndex === index ? 'opacity-50' : ''
                        }`}
                    >
                        <Image
                            src={photo.thumbnail_url}
                            alt="Foto do evento"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 33vw, 20vw"
                        />
                        
                        {/* Drag handle */}
                        <div className="absolute top-1 left-1 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-3 h-3" />
                        </div>
                        
                        {/* Delete button */}
                        <button
                            onClick={() => handleDelete(photo.id)}
                            disabled={deletingId === photo.id}
                            className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                        >
                            {deletingId === photo.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Trash2 className="w-3 h-3" />
                            )}
                        </button>
                    </div>
                ))}
            </div>
            <p className="text-xs text-gray-500">
                Arraste as fotos para reordenar.
            </p>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cms/GalleryPhotoGrid.tsx
git commit -m "feat(cms): add GalleryPhotoGrid with drag-drop reordering"
```

---

### Task 7: Componente GalleryLightbox (Reutilizável)

**Files:**
- Create: `components/GalleryLightbox.tsx`

- [ ] **Step 1: Criar lightbox**

```tsx
'use client'

import React, { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'

interface Photo {
    id: string
    watermarked_url: string
    thumbnail_url: string
}

interface GalleryLightboxProps {
    photos: Photo[]
    currentIndex: number
    isOpen: boolean
    onClose: () => void
    onNavigate: (index: number) => void
}

export function GalleryLightbox({ photos, currentIndex, isOpen, onClose, onNavigate }: GalleryLightboxProps) {
    const currentPhoto = photos[currentIndex]

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) onNavigate(currentIndex - 1)
    }, [currentIndex, onNavigate])

    const handleNext = useCallback(() => {
        if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1)
    }, [currentIndex, photos.length, onNavigate])

    useEffect(() => {
        if (!isOpen) return
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowLeft') handlePrev()
            if (e.key === 'ArrowRight') handleNext()
        }
        
        document.addEventListener('keydown', handleKeyDown)
        document.body.style.overflow = 'hidden'
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = ''
        }
    }, [isOpen, onClose, handlePrev, handleNext])

    if (!isOpen || !currentPhoto) return null

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Close button */}
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
            >
                <X className="w-8 h-8" />
            </button>

            {/* Navigation */}
            {currentIndex > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white z-10"
                >
                    <ChevronLeft className="w-10 h-10" />
                </button>
            )}
            
            {currentIndex < photos.length - 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white z-10"
                >
                    <ChevronRight className="w-10 h-10" />
                </button>
            )}

            {/* Image */}
            <div 
                className="relative w-full h-full max-w-5xl max-h-[90vh] mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <Image
                    src={currentPhoto.watermarked_url}
                    alt="Foto do evento"
                    fill
                    className="object-contain"
                    priority
                    sizes="100vw"
                />
            </div>

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
                {currentIndex + 1} / {photos.length}
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/GalleryLightbox.tsx
git commit -m "feat(ui): add reusable GalleryLightbox component"
```

---

### Task 8: Integrar Aba de Galeria no EventEditor

**Files:**
- Modify: `components/cms/EventEditor.tsx`

- [ ] **Step 1: Adicionar imports e estado da galeria**

No topo do arquivo, adicionar imports:
```typescript
import { Camera, Image as ImageIcon } from 'lucide-react'
import { GalleryUploader } from './GalleryUploader'
import { GalleryPhotoGrid } from './GalleryPhotoGrid'
import { 
    getGalleryByEventId, 
    createOrUpdateGallery, 
    deleteGallery 
} from '@/lib/actions/cms-event-photos'
import { Switch } from '@/components/ui/switch'
```

Adicionar estado (dentro do componente):
```typescript
const [activeTab, setActiveTab] = useState<'details' | 'gallery'>('details')
const [gallery, setGallery] = useState<any>(null)
const [galleryLoading, setGalleryLoading] = useState(false)
const [galleryForm, setGalleryForm] = useState({
    title: 'Galeria de Fotos',
    description: '',
    is_public: true,
    contact_email: '',
    contact_whatsapp: ''
})
```

- [ ] **Step 2: Adicionar funções de fetch e save da galeria**

```typescript
const fetchGallery = async () => {
    if (!currentEvent.id) return
    setGalleryLoading(true)
    try {
        const data = await getGalleryByEventId(currentEvent.id)
        if (data) {
            setGallery(data)
            setGalleryForm({
                title: data.title || 'Galeria de Fotos',
                description: data.description || '',
                is_public: data.is_public !== false,
                contact_email: data.contact_email || '',
                contact_whatsapp: data.contact_whatsapp || ''
            })
        }
    } catch (error) {
        console.error('Erro ao buscar galeria:', error)
    }
    setGalleryLoading(false)
}

useEffect(() => {
    if (currentEvent.id) {
        fetchGallery()
    }
}, [currentEvent.id])

const handleSaveGallery = async () => {
    try {
        const data = {
            id: gallery?.id,
            event_id: currentEvent.id,
            ...galleryForm
        }
        const result = await createOrUpdateGallery(data)
        setGallery(result)
        toast.success('Galeria salva com sucesso!')
    } catch (error) {
        console.error('Erro ao salvar galeria:', error)
        toast.error('Erro ao salvar galeria')
    }
}

const handleDeleteGallery = async () => {
    if (!gallery?.id) return
    if (!confirm('Tem certeza que deseja excluir toda a galeria? Todas as fotos serão removidas.')) return
    
    try {
        await deleteGallery(gallery.id)
        setGallery(null)
        setGalleryForm({
            title: 'Galeria de Fotos',
            description: '',
            is_public: true,
            contact_email: '',
            contact_whatsapp: ''
        })
        toast.success('Galeria excluída!')
    } catch (error) {
        console.error('Erro ao excluir galeria:', error)
        toast.error('Erro ao excluir galeria')
    }
}
```

- [ ] **Step 3: Adicionar tabs e conteúdo da galeria**

Substituir o grid existente (linhas 96-189 aproximadamente) por um sistema de tabs. A estrutura deve ser:

```tsx
{/* Tabs */}
<div className="flex items-center gap-1 border-b border-gray-200 mb-6">
    <button
        onClick={() => setActiveTab('details')}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'details'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
    >
        Detalhes do Evento
    </button>
    <button
        onClick={() => setActiveTab('gallery')}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'gallery'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
    >
        <Camera className="w-4 h-4" />
        Galeria de Fotos
        {gallery && <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full">{gallery.photos?.length || 0}</span>}
    </button>
</div>

{/* Tab Content */}
{activeTab === 'details' ? (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ... existing content ... */}
    </div>
) : (
    <div className="space-y-6">
        {/* Gallery Settings */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3">Configurações da Galeria</h3>
            
            <div className="space-y-2">
                <Label>Título da Galeria</Label>
                <Input
                    value={galleryForm.title}
                    onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })}
                    placeholder="Ex: Fotos do Congresso 2026"
                />
            </div>
            
            <div className="space-y-2">
                <Label>Descrição</Label>
                <textarea
                    value={galleryForm.description}
                    onChange={(e) => setGalleryForm({ ...galleryForm, description: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-md p-3 text-gray-700 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
                    placeholder="Breve descrição da galeria..."
                />
            </div>
            
            <div className="flex items-center justify-between py-2">
                <div>
                    <Label className="text-sm font-medium">Galeria Pública</Label>
                    <p className="text-xs text-gray-500">Quando ativada, a galeria ficará visível no site</p>
                </div>
                <Switch
                    checked={galleryForm.is_public}
                    onCheckedChange={(checked) => setGalleryForm({ ...galleryForm, is_public: checked })}
                />
            </div>
            
            <div className="space-y-2">
                <Label>Email de Contato (para alta qualidade)</Label>
                <Input
                    type="email"
                    value={galleryForm.contact_email}
                    onChange={(e) => setGalleryForm({ ...galleryForm, contact_email: e.target.value })}
                    placeholder="contato@edashow.com"
                />
            </div>
            
            <div className="space-y-2">
                <Label>WhatsApp de Contato</Label>
                <Input
                    value={galleryForm.contact_whatsapp}
                    onChange={(e) => setGalleryForm({ ...galleryForm, contact_whatsapp: e.target.value })}
                    placeholder="5511999999999"
                />
            </div>
            
            <div className="flex items-center gap-3 pt-2">
                <Button
                    onClick={handleSaveGallery}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Configurações
                </Button>
                {gallery?.id && (
                    <Button
                        variant="destructive"
                        onClick={handleDeleteGallery}
                        className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir Galeria
                    </Button>
                )}
            </div>
        </div>
        
        {/* Upload */}
        {gallery?.id && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3">Adicionar Fotos</h3>
                <GalleryUploader 
                    galleryId={gallery.id}
                    onUploadComplete={fetchGallery}
                />
            </div>
        )}
        
        {/* Photos Grid */}
        {gallery?.id && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3">
                    Fotos ({gallery.photos?.length || 0})
                </h3>
                <GalleryPhotoGrid 
                    photos={gallery.photos || []}
                    onUpdate={fetchGallery}
                />
            </div>
        )}
    </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add components/cms/EventEditor.tsx
git commit -m "feat(cms): add gallery tab to EventEditor"
```

---

### Task 9: Página Pública da Galeria

**Files:**
- Create: `app/events/[slug]/gallery/page.tsx`

- [ ] **Step 1: Criar página pública**

```tsx
import { getEventBySlug, getEvents } from '@/lib/supabase/api'
import { getGalleryByEventSlug } from '@/lib/actions/cms-event-photos'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { GalleryLightbox } from '@/components/GalleryLightbox'
import { GalleryClient } from './GalleryClient'

export const dynamic = 'force-dynamic'

interface GalleryPageProps {
    params: {
        slug: string
    }
}

export async function generateStaticParams() {
    const events = await getEvents({ limit: 100 })
    return events.map((event: any) => ({ slug: event.slug }))
}

export async function generateMetadata({ params }: GalleryPageProps) {
    const event = await getEventBySlug(params.slug)
    if (!event) {
        return { title: 'Galeria não encontrada | EdaShow' }
    }
    return {
        title: `Galeria de Fotos - ${event.title} | EdaShow`,
        description: `Veja as fotos do evento ${event.title}`,
    }
}

export default async function GalleryPage({ params }: GalleryPageProps) {
    const event = await getEventBySlug(params.slug)
    
    if (!event) {
        notFound()
    }
    
    const gallery = await getGalleryByEventSlug(params.slug)
    
    if (!gallery) {
        notFound()
    }
    
    const photos = (gallery.photos || []).sort((a: any, b: any) => a.display_order - b.display_order)
    
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="container mx-auto px-4 py-6">
                <Link href={`/events/${params.slug}`}>
                    <Button variant="ghost" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar ao Evento
                    </Button>
                </Link>
            </div>
            
            {/* Gallery Info */}
            <div className="container mx-auto px-4 pb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                    {gallery.title}
                </h1>
                <p className="text-gray-600 mb-2">
                    {event.title}
                </p>
                {gallery.description && (
                    <p className="text-gray-500 max-w-2xl">
                        {gallery.description}
                    </p>
                )}
            </div>
            
            {/* Photo Grid */}
            <div className="container mx-auto px-4 pb-12">
                <GalleryClient photos={photos} />
            </div>
            
            {/* CTA Footer */}
            <div className="container mx-auto px-4 pb-12">
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-xl p-8 text-center shadow-xl">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                        Quer as fotos em alta qualidade?
                    </h2>
                    <p className="text-white/90 mb-6 max-w-xl mx-auto">
                        Entre em contato conosco para receber as imagens originais sem marca d'água.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {gallery.contact_email && (
                            <a 
                                href={`mailto:${gallery.contact_email}?subject=Solicitação de Fotos - ${event.title}`}
                                className="inline-flex"
                            >
                                <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 font-bold gap-2">
                                    <Mail className="h-5 w-5" />
                                    Enviar Email
                                </Button>
                            </a>
                        )}
                        {gallery.contact_whatsapp && (
                            <a 
                                href={`https://wa.me/${gallery.contact_whatsapp}?text=Olá! Gostaria de solicitar as fotos em alta qualidade do evento ${event.title}.`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex"
                            >
                                <Button size="lg" className="bg-green-500 text-white hover:bg-green-600 font-bold gap-2">
                                    <MessageCircle className="h-5 w-5" />
                                    WhatsApp
                                </Button>
                            </a>
                        )}
                        {!gallery.contact_email && !gallery.contact_whatsapp && (
                            <p className="text-white/80 text-sm">
                                Informações de contato em breve.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Criar componente cliente para interatividade**

Create: `app/events/[slug]/gallery/GalleryClient.tsx`

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { GalleryLightbox } from '@/components/GalleryLightbox'

interface Photo {
    id: string
    thumbnail_url: string
    watermarked_url: string
}

interface GalleryClientProps {
    photos: Photo[]
}

export function GalleryClient({ photos }: GalleryClientProps) {
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)

    if (!photos.length) {
        return (
            <div className="text-center py-12 text-gray-500">
                Nenhuma foto disponível nesta galeria.
            </div>
        )
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo, index) => (
                    <button
                        key={photo.id}
                        onClick={() => {
                            setCurrentIndex(index)
                            setLightboxOpen(true)
                        }}
                        className="relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 hover:border-orange-300 transition-colors group"
                    >
                        <Image
                            src={photo.thumbnail_url}
                            alt="Foto do evento"
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </button>
                ))}
            </div>

            <GalleryLightbox
                photos={photos}
                currentIndex={currentIndex}
                isOpen={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                onNavigate={setCurrentIndex}
            />
        </>
    )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/events/[slug]/gallery/page.tsx app/events/[slug]/gallery/GalleryClient.tsx
git commit -m "feat(gallery): add public gallery page with lightbox and contact CTA"
```

---

### Task 10: Link para Galeria na Página do Evento

**Files:**
- Modify: `app/events/[slug]/page.tsx`

- [ ] **Step 1: Adicionar link e import**

Adicionar import:
```typescript
import { Camera } from 'lucide-react'
import { getGalleryByEventSlug } from '@/lib/actions/cms-event-photos'
```

No componente da página, buscar a galeria:
```typescript
const gallery = await getGalleryByEventSlug(params.slug)
```

Adicionar o link para a galeria após o header/hero section (após a div do hero, antes do `<article>`):

```tsx
{gallery && (
    <div className="container mx-auto px-4 mb-6">
        <Link href={`/events/${params.slug}/gallery`}>
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-bold gap-2 shadow-lg">
                <Camera className="h-5 w-5" />
                Ver Galeria de Fotos ({gallery.photos?.length || 0})
            </Button>
        </Link>
    </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add app/events/[slug]/page.tsx
git commit -m "feat(events): add gallery link on event detail page"
```

---

### Task 11: Badge de Galeria na Lista de Eventos CMS

**Files:**
- Modify: `app/cms/events/page.tsx`

- [ ] **Step 1: Adicionar badge**

Adicionar import:
```typescript
import { Camera } from 'lucide-react'
```

Modificar a coluna 'name' (evento) para mostrar o badge quando o evento tiver galeria. Como a lista atual não busca dados de galeria, adicionar o fetch:

No `useEffect` de fetchEvents, após buscar os eventos, buscar quais têm galeria. Ou modificar a server action `getEvents` para incluir a contagem. Opção mais simples: criar uma função auxiliar no cliente.

Modificar o `fetchEvents`:
```typescript
const fetchEvents = async () => {
    setLoading(true)
    try {
        const data = await getEvents()
        // Buscar galerias para cada evento
        const eventsWithGallery = await Promise.all(
            (data || []).map(async (event: any) => {
                try {
                    const gallery = await getGalleryByEventId(event.id)
                    return { ...event, has_gallery: !!gallery, photo_count: gallery?.photos?.length || 0 }
                } catch {
                    return { ...event, has_gallery: false, photo_count: 0 }
                }
            })
        )
        setEvents(eventsWithGallery)
    } catch (error) {
        console.error('Erro ao buscar eventos:', error)
    }
    setLoading(false)
}
```

Adicionar import de `getGalleryByEventId` no topo (apesar de ser server action, pode ser chamado no client se for 'use server'):
```typescript
import { getGalleryByEventId } from '@/lib/actions/cms-event-photos'
```

Modificar a renderização da coluna name:
```tsx
{
    key: 'name',
    label: 'Evento',
    render: (item: any) => (
        <div className="flex flex-col">
            <span className="font-bold text-gray-900">{item.title}</span>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                <MapPin className="w-2.5 h-2.5" /> {item.location || 'Local não definido'}
            </div>
            {item.has_gallery && (
                <div className="flex items-center gap-1 mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
                        <Camera className="w-2.5 h-2.5" />
                        {item.photo_count} foto(s)
                    </span>
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/cms/events/page.tsx
git commit -m "feat(cms): show gallery badge in events list"
```

---

### Task 12: Build e Verificação Final

- [ ] **Step 1: Rodar build**

```bash
npm run build
```

Expected: Build completa sem erros de TypeScript.

- [ ] **Step 2: Verificar migrations**

```bash
# Listar todos os arquivos novos/modificados
git status
```

Expected:
- `supabase/migrations/20260514_create_event_photo_tables.sql`
- `supabase/migrations/20260514_create_photo_buckets.sql`
- `public/watermark-logo.png`
- `lib/actions/cms-event-photos.ts`
- `components/cms/GalleryUploader.tsx`
- `components/cms/GalleryPhotoGrid.tsx`
- `components/GalleryLightbox.tsx`
- `app/events/[slug]/gallery/page.tsx`
- `app/events/[slug]/gallery/GalleryClient.tsx`
- `components/cms/EventEditor.tsx` (modified)
- `app/events/[slug]/page.tsx` (modified)
- `app/cms/events/page.tsx` (modified)

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat(gallery): complete event photo gallery feature"
```

---

## Spec Coverage Checklist

| Spec Requirement | Plan Task |
|-----------------|-----------|
| Tabelas `event_photo_galleries` e `event_photos` | Task 1 |
| Buckets `event-photos-original` e `event-photos-public` | Task 2 |
| Server actions CRUD | Task 4 |
| Upload com sharp + watermark | Task 4 |
| Logo da marca d'água | Task 3 |
| Componente de upload drag-drop | Task 5 |
| Grid com ordenação drag-drop | Task 6 |
| Lightbox reutilizável | Task 7 |
| Aba no EventEditor | Task 8 |
| Página pública `/events/[slug]/gallery` | Task 9 |
| Link da galeria na página do evento | Task 10 |
| Badge na lista CMS | Task 11 |
| Botão de contato email/whatsapp | Task 9 |
| RLS policies | Task 1 + 2 |

---

## Placeholder Scan

- [x] Nenhum "TBD", "TODO", "implement later"
- [x] Código completo em cada step
- [x] Comandos exatos com expected output
- [x] Tipos e nomes consistentes entre tasks

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-galeria-fotos-eventos.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach do you prefer?**
