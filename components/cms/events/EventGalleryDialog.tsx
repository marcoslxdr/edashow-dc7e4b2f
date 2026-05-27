'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { EventGalleryPanel } from '../EventGalleryPanel'

interface EventGalleryDialogProps {
    event: { id: string; title: string }
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EventGalleryDialog({ event, open, onOpenChange }: EventGalleryDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Galeria — {event.title}</DialogTitle>
                </DialogHeader>
                <EventGalleryPanel eventId={event.id} />
            </DialogContent>
        </Dialog>
    )
}
