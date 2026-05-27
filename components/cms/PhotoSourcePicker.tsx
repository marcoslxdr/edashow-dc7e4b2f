'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GalleryUploader } from './GalleryUploader'
import { getMedia } from '@/lib/actions/cms-media'
import {
    attachExistingEventPhotos,
    attachMediaToEventGallery,
    searchEventGalleries,
} from '@/lib/actions/cms-event-photos'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PhotoSourcePickerProps {
    galleryId: string
    eventId: string
    onRefresh: () => void
}

export function PhotoSourcePicker({ galleryId, eventId, onRefresh }: PhotoSourcePickerProps) {
    const [media, setMedia] = useState<any[]>([])
    const [mediaLoading, setMediaLoading] = useState(false)
    const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
    const [mediaSubmitting, setMediaSubmitting] = useState(false)

    const [galleryQuery, setGalleryQuery] = useState('')
    const [galleries, setGalleries] = useState<any[]>([])
    const [galleriesLoading, setGalleriesLoading] = useState(false)
    const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null)
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])
    const [copySubmitting, setCopySubmitting] = useState(false)

    const loadMedia = useCallback(async () => {
        setMediaLoading(true)
        try {
            const data = await getMedia()
            setMedia(data || [])
        } catch {
            toast.error('Erro ao carregar biblioteca de mídia.')
        }
        setMediaLoading(false)
    }, [])

    useEffect(() => {
        loadMedia()
    }, [loadMedia])

    const searchGalleries = useCallback(async () => {
        setGalleriesLoading(true)
        try {
            const data = await searchEventGalleries(galleryQuery, eventId)
            setGalleries(data)
            if (!data.find((g: any) => g.id === selectedGalleryId)) {
                setSelectedGalleryId(null)
                setSelectedPhotoIds([])
            }
        } catch {
            toast.error('Erro ao buscar galerias.')
        }
        setGalleriesLoading(false)
    }, [galleryQuery, eventId, selectedGalleryId])

    useEffect(() => {
        const t = setTimeout(() => searchGalleries(), 300)
        return () => clearTimeout(t)
    }, [searchGalleries])

    const toggleMedia = (id: string) => {
        setSelectedMediaIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        )
    }

    const togglePhoto = (id: string) => {
        setSelectedPhotoIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        )
    }

    const handleAttachMedia = async () => {
        if (!selectedMediaIds.length) return
        setMediaSubmitting(true)
        try {
            await attachMediaToEventGallery(galleryId, selectedMediaIds)
            toast.success(`${selectedMediaIds.length} imagem(ns) adicionada(s).`)
            setSelectedMediaIds([])
            onRefresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erro ao adicionar da biblioteca.')
        }
        setMediaSubmitting(false)
    }

    const handleCopyPhotos = async () => {
        if (!selectedPhotoIds.length) return
        setCopySubmitting(true)
        try {
            await attachExistingEventPhotos(galleryId, selectedPhotoIds)
            toast.success(`${selectedPhotoIds.length} foto(s) copiada(s).`)
            setSelectedPhotoIds([])
            onRefresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erro ao copiar fotos.')
        }
        setCopySubmitting(false)
    }

    const selectedGallery = galleries.find((g) => g.id === selectedGalleryId)
    const photos = selectedGallery?.photos ?? []

    return (
        <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">Enviar</TabsTrigger>
                <TabsTrigger value="media">Biblioteca</TabsTrigger>
                <TabsTrigger value="other">Outras galerias</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
                <GalleryUploader galleryId={galleryId} onUploadComplete={onRefresh} />
            </TabsContent>

            <TabsContent value="media" className="mt-4 space-y-4">
                {mediaLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                            {media.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => toggleMedia(item.id)}
                                    className={cn(
                                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors duration-200',
                                        selectedMediaIds.includes(item.id)
                                            ? 'border-primary ring-2 ring-primary/30'
                                            : 'border-transparent',
                                    )}
                                >
                                    <img
                                        src={item.url}
                                        alt={item.filename || ''}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                        {media.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Biblioteca vazia. Envie imagens em Galeria &amp; Mídia.
                            </p>
                        )}
                        <Button
                            type="button"
                            onClick={handleAttachMedia}
                            disabled={!selectedMediaIds.length || mediaSubmitting}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            {mediaSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Adicionar à galeria ({selectedMediaIds.length})
                        </Button>
                    </>
                )}
            </TabsContent>

            <TabsContent value="other" className="mt-4 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={galleryQuery}
                        onChange={(e) => setGalleryQuery(e.target.value)}
                        placeholder="Buscar por nome do evento..."
                        className="pl-9"
                    />
                </div>
                {galleriesLoading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2">
                            {galleries.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedGalleryId(g.id)
                                        setSelectedPhotoIds([])
                                    }}
                                    className={cn(
                                        'text-sm px-3 py-1.5 rounded-full border transition-colors duration-200',
                                        selectedGalleryId === g.id
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border hover:bg-muted',
                                    )}
                                >
                                    {(g.events as { title?: string })?.title || g.title} (
                                    {g.photos?.length || 0})
                                </button>
                            ))}
                        </div>
                        {selectedGallery && photos.length > 0 && (
                            <>
                                <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                                    {photos.map((p: any) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => togglePhoto(p.id)}
                                            className={cn(
                                                'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors duration-200',
                                                selectedPhotoIds.includes(p.id)
                                                    ? 'border-primary ring-2 ring-primary/30'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <img
                                                src={p.thumbnail_url || p.watermarked_url}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleCopyPhotos}
                                    disabled={!selectedPhotoIds.length || copySubmitting}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                >
                                    {copySubmitting && (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    )}
                                    Copiar {selectedPhotoIds.length} foto(s)
                                </Button>
                            </>
                        )}
                        {galleries.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Nenhuma outra galeria encontrada.
                            </p>
                        )}
                    </>
                )}
            </TabsContent>
        </Tabs>
    )
}
