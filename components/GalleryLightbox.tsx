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
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
            >
                <X className="w-8 h-8" />
            </button>

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

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
                {currentIndex + 1} / {photos.length}
            </div>
        </div>
    )
}
