'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { EventPostsPanel } from '../EventPostsPanel'

interface EventPostsDialogProps {
    event: { id: string; title: string }
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EventPostsDialog({ event, open, onOpenChange }: EventPostsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Posts — {event.title}</DialogTitle>
                </DialogHeader>
                <EventPostsPanel eventId={event.id} />
            </DialogContent>
        </Dialog>
    )
}
