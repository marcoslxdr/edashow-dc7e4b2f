'use client'

import { useState } from 'react'
import { Plus, Trash2, Youtube, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addEventVideo, deleteEventVideo } from '@/lib/actions/cms-event-videos'
import { toast } from 'sonner'

interface EventVideo {
    id: string
    platform: string
    video_url: string
    title?: string | null
}

interface EventVideosEditorProps {
    eventId: string
    videos: EventVideo[]
    onChange: () => void
}

export function EventVideosEditor({ eventId, videos, onChange }: EventVideosEditorProps) {
    const [url, setUrl] = useState('')
    const [title, setTitle] = useState('')
    const [loading, setLoading] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleAdd = async () => {
        if (!url.trim()) {
            toast.error('Informe a URL do vídeo.')
            return
        }
        setLoading(true)
        try {
            await addEventVideo({ event_id: eventId, video_url: url, title: title || undefined })
            setUrl('')
            setTitle('')
            toast.success('Vídeo adicionado!')
            onChange()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro ao adicionar vídeo.'
            toast.error(message)
        }
        setLoading(false)
    }

    const handleDelete = async (videoId: string) => {
        if (!confirm('Remover este vídeo do evento?')) return
        setDeletingId(videoId)
        try {
            await deleteEventVideo(videoId)
            toast.success('Vídeo removido.')
            onChange()
        } catch {
            toast.error('Erro ao remover vídeo.')
        }
        setDeletingId(null)
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-orange-500" />
                    Adicionar Vídeo
                </h3>
                <p className="text-sm text-gray-500">
                    Cole links do YouTube (vídeo ou shorts) ou Instagram (post, reel ou IGTV).
                </p>

                <div className="space-y-2">
                    <Label>URL do vídeo</Label>
                    <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... ou https://www.instagram.com/reel/..."
                    />
                </div>

                <div className="space-y-2">
                    <Label>Título (opcional)</Label>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Abertura do evento"
                    />
                </div>

                <Button
                    type="button"
                    onClick={handleAdd}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4 mr-2" />
                    )}
                    Adicionar vídeo
                </Button>
            </div>

            {videos.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
                    <h3 className="text-lg font-bold text-gray-900">
                        Vídeos anexados ({videos.length})
                    </h3>
                    <ul className="divide-y divide-gray-100">
                        {videos.map((video) => (
                            <li key={video.id} className="flex items-start justify-between gap-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 truncate">
                                        {video.title || 'Sem título'}
                                    </p>
                                    <p className="text-xs text-gray-500 uppercase mt-0.5">
                                        {video.platform}
                                    </p>
                                    <a
                                        href={video.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-orange-600 hover:underline inline-flex items-center gap-1 mt-1 truncate max-w-full"
                                    >
                                        {video.video_url}
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                    </a>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={deletingId === video.id}
                                    onClick={() => handleDelete(video.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                                >
                                    {deletingId === video.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
