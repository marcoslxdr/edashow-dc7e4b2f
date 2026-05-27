'use client'

import { EventVideosEditor } from './EventVideosEditor'

interface EventVideo {
    id: string
    platform: string
    video_url: string
    title?: string | null
}

interface EventVideosPanelProps {
    eventId: string
    videos: EventVideo[]
    onChange: () => void
}

export function EventVideosPanel({ eventId, videos, onChange }: EventVideosPanelProps) {
    return <EventVideosEditor eventId={eventId} videos={videos} onChange={onChange} />
}
