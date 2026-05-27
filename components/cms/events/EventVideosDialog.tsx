'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { getEventVideos } from '@/lib/actions/cms-event-videos'
import { EventVideosPanel } from '../EventVideosPanel'

interface EventVideosDialogProps {
    event: { id: string; title: string }
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EventVideosDialog({ event, open, onOpenChange }: EventVideosDialogProps) {
    const [videos, setVideos] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const fetchVideos = useCallback(async () => {
        if (!event.id) return
        setLoading(true)
        try {
            setVideos(await getEventVideos(event.id))
        } catch {
            setVideos([])
        }
        setLoading(false)
    }, [event.id])

    useEffect(() => {
        if (open) fetchVideos()
    }, [open, fetchVideos])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Vídeos — {event.title}</DialogTitle>
                </DialogHeader>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <EventVideosPanel eventId={event.id} videos={videos} onChange={fetchVideos} />
                )}
            </DialogContent>
        </Dialog>
    )
}
