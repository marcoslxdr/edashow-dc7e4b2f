'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Camera, Download, Image as ImageIcon, Loader2, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    createOrUpdateGallery,
    deleteGallery,
    ensureGalleryForEvent,
    getGalleryByEventId,
} from '@/lib/actions/cms-event-photos'
import { GalleryPhotoGrid } from './GalleryPhotoGrid'
import { PhotoSourcePicker } from './PhotoSourcePicker'
import { toast } from 'sonner'

interface EventGalleryPanelProps {
    eventId: string
    onGalleryChange?: () => void
}

export function EventGalleryPanel({ eventId, onGalleryChange }: EventGalleryPanelProps) {
    const [gallery, setGallery] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [galleryForm, setGalleryForm] = useState({
        title: 'Galeria de Fotos',
        description: '',
        is_public: true,
        contact_email: '',
        contact_whatsapp: '',
        drive_download_url: '',
    })

    const fetchGallery = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getGalleryByEventId(eventId)
            if (data) {
                setGallery(data)
                setGalleryForm({
                    title: data.title || 'Galeria de Fotos',
                    description: data.description || '',
                    is_public: data.is_public !== false,
                    contact_email: data.contact_email || '',
                    contact_whatsapp: data.contact_whatsapp || '',
                    drive_download_url: data.drive_download_url || '',
                })
            } else {
                setGallery(null)
            }
            onGalleryChange?.()
        } catch {
            toast.error('Erro ao carregar galeria.')
        }
        setLoading(false)
    }, [eventId, onGalleryChange])

    useEffect(() => {
        fetchGallery()
    }, [fetchGallery])

    const handleSaveGallery = async () => {
        try {
            const result = await createOrUpdateGallery({
                id: gallery?.id,
                event_id: eventId,
                ...galleryForm,
            })
            setGallery((prev: any) => ({ ...prev, ...result }))
            toast.success('Galeria salva!')
            await fetchGallery()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erro ao salvar galeria.')
        }
    }

    const handleDeleteGallery = async () => {
        if (!gallery?.id) return
        if (!confirm('Excluir toda a galeria e fotos?')) return
        try {
            await deleteGallery(gallery.id)
            setGallery(null)
            toast.success('Galeria excluída.')
            await fetchGallery()
        } catch {
            toast.error('Erro ao excluir galeria.')
        }
    }

    const ensureGallery = async (): Promise<string | null> => {
        if (gallery?.id) return gallery.id
        try {
            const created = await ensureGalleryForEvent(eventId)
            setGallery(created)
            return created.id
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erro ao criar galeria.')
            return null
        }
    }

    const handlePrepareUpload = async () => {
        const id = await ensureGallery()
        if (id) await fetchGallery()
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary" />
                    Configurações da galeria
                </h3>
                <p className="text-sm text-muted-foreground">
                    Fotos públicas recebem marca d&apos;água automaticamente.
                </p>

                <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                        value={galleryForm.title}
                        onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Descrição</Label>
                    <textarea
                        value={galleryForm.description}
                        onChange={(e) =>
                            setGalleryForm({ ...galleryForm, description: e.target.value })
                        }
                        className="w-full border border-gray-200 rounded-md p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <Label>Galeria pública</Label>
                    <Switch
                        checked={galleryForm.is_public}
                        onCheckedChange={(checked) =>
                            setGalleryForm({ ...galleryForm, is_public: checked })
                        }
                    />
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Link do Google Drive
                    </Label>
                    <Input
                        value={galleryForm.drive_download_url}
                        onChange={(e) =>
                            setGalleryForm({ ...galleryForm, drive_download_url: e.target.value })
                        }
                        placeholder="https://drive.google.com/..."
                    />
                </div>

                <div className="flex gap-3">
                    <Button
                        type="button"
                        onClick={handleSaveGallery}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Salvar galeria
                    </Button>
                    {gallery?.id && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDeleteGallery}
                            className="text-destructive border-destructive/30"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir galeria
                        </Button>
                    )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-primary" />
                    Fotos
                </h3>

                {!gallery?.id ? (
                    <div className="text-center py-6 space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Nenhuma foto ainda. Salve a galeria ou comece enviando imagens.
                        </p>
                        <Button type="button" onClick={handlePrepareUpload} variant="outline">
                            Preparar galeria para upload
                        </Button>
                    </div>
                ) : (
                    <PhotoSourcePicker
                        galleryId={gallery.id}
                        eventId={eventId}
                        onRefresh={fetchGallery}
                    />
                )}
            </div>

            {gallery?.photos?.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-gray-900">
                        Fotos ({gallery.photos.length})
                    </h3>
                    <GalleryPhotoGrid photos={gallery.photos} onUpdate={fetchGallery} />
                </div>
            )}
        </div>
    )
}
