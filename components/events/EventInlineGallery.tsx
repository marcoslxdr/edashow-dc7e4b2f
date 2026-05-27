'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GalleryLightbox } from '@/components/GalleryLightbox'

interface GalleryPhoto {
    id: string
    watermarked_url: string
    thumbnail_url: string
}

interface EventInlineGalleryProps {
    photos: GalleryPhoto[]
    driveDownloadUrl?: string | null
}

export function EventInlineGallery({ photos, driveDownloadUrl }: EventInlineGalleryProps) {
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    if (!photos.length) return null

    return (
        <section id="galeria" className="mb-12 scroll-mt-24">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Galeria de fotos</h2>
                {driveDownloadUrl && (
                    <a href={driveDownloadUrl} target="_blank" rel="noopener noreferrer">
                        <Button
                            variant="outline"
                            className="border-orange-300 text-orange-700 hover:bg-orange-50 font-semibold gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Baixar no Drive
                        </Button>
                    </a>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((photo, index) => (
                    <button
                        key={photo.id}
                        type="button"
                        className="relative aspect-square rounded-lg overflow-hidden border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        onClick={() => {
                            setLightboxIndex(index)
                            setLightboxOpen(true)
                        }}
                    >
                        <Image
                            src={photo.thumbnail_url || photo.watermarked_url}
                            alt=""
                            fill
                            className="object-cover hover:scale-105 transition-transform duration-200 ease-out"
                            sizes="(max-width: 768px) 50vw, 25vw"
                        />
                    </button>
                ))}
            </div>
            <GalleryLightbox
                photos={photos}
                currentIndex={lightboxIndex}
                isOpen={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                onNavigate={setLightboxIndex}
            />
        </section>
    )
}
