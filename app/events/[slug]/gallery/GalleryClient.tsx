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
