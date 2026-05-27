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
            const message = error instanceof Error ? error.message : 'Erro ao enviar fotos. Tente novamente.'
            toast.error(message)
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
