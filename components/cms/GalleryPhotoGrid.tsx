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
        
        setSavingOrder(true)
        try {
            const photoIds = items.map(p => p.id)
            await reorderEventPhotos(photoIds)
            toast.success('Ordem atualizada!')
        } catch (error) {
            console.error('Erro ao reordenar:', error)
            toast.error('Erro ao salvar ordem')
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
                        
                        <div className="absolute top-1 left-1 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-3 h-3" />
                        </div>
                        
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
