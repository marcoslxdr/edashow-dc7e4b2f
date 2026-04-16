'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Pencil, Send, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { publishPost } from '@/lib/actions/cms-posts'

interface DraftPreviewBannerProps {
    postId: string
    postSlug: string
}

export function DraftPreviewBanner({ postId, postSlug }: DraftPreviewBannerProps) {
    const router = useRouter()
    const [isPublishing, setIsPublishing] = useState(false)
    const [isPublished, setIsPublished] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    const handlePublish = async () => {
        if (isPublishing) return
        setIsPublishing(true)
        try {
            await publishPost(postId)
            setIsPublished(true)
            router.refresh()
        } catch (error: any) {
            alert(`Erro ao publicar: ${error?.message || 'Erro desconhecido'}`)
        } finally {
            setIsPublishing(false)
        }
    }

    if (dismissed) return null

    if (isPublished) {
        return (
            <div className="sticky top-0 z-50 bg-green-50 border-b border-green-200">
                <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-3">
                    <span className="text-sm font-medium text-green-800">
                        Post publicado com sucesso!
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDismissed(true)}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-sm font-medium text-amber-800">
                        Preview do rascunho &mdash; apenas editores podem ver
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/cms/posts/${postId}`)}
                        className="gap-1.5 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                    >
                        {isPublishing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Publicar</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}
