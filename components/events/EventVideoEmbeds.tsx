import { parseEventVideoUrl } from '@/lib/event-videos/parse-url'

interface EventVideoRow {
    id: string
    platform: string
    video_url: string
    title?: string | null
}

interface EventVideoEmbedsProps {
    videos: EventVideoRow[]
    className?: string
}

export function EventVideoEmbeds({ videos, className = '' }: EventVideoEmbedsProps) {
    if (!videos.length) return null

    const items = videos
        .map((video) => {
            const parsed = parseEventVideoUrl(video.video_url)
            if (!parsed) return null
            return { ...video, parsed }
        })
        .filter(Boolean) as Array<EventVideoRow & { parsed: NonNullable<ReturnType<typeof parseEventVideoUrl>> }>

    if (!items.length) return null

    return (
        <section className={className}>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Vídeos do Evento</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {items.map((video) => (
                    <div key={video.id} className="space-y-3">
                        {video.title && (
                            <h3 className="text-lg font-semibold text-gray-800">{video.title}</h3>
                        )}
                        <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-black shadow-md">
                            <iframe
                                src={video.parsed.embedUrl}
                                title={video.title || `Vídeo ${video.parsed.platform}`}
                                className="absolute inset-0 w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                loading="lazy"
                            />
                        </div>
                        <a
                            href={video.parsed.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                        >
                            Abrir no {video.parsed.platform === 'youtube' ? 'YouTube' : 'Instagram'}
                        </a>
                    </div>
                ))}
            </div>
        </section>
    )
}
