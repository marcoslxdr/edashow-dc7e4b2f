'use client'

import React, { useEffect, useState } from 'react'
import { Plus, MapPin, Calendar, Camera } from 'lucide-react'
import { getGalleryByEventId } from '@/lib/actions/cms-event-photos'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/cms/DataTable'
import { getEvents } from '@/lib/actions/cms-events'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CMSEventsPage() {
    const router = useRouter()
    const [events, setEvents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchEvents = async () => {
        setLoading(true)
        try {
            const data = await getEvents()
            const eventsWithGallery = await Promise.all(
                (data || []).map(async (event: any) => {
                    try {
                        const gallery = await getGalleryByEventId(event.id)
                        return { ...event, has_gallery: !!gallery, photo_count: gallery?.photos?.length || 0 }
                    } catch {
                        return { ...event, has_gallery: false, photo_count: 0 }
                    }
                })
            )
            setEvents(eventsWithGallery)
        } catch (error) {
            console.error('Erro ao buscar eventos:', error)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchEvents()
    }, [])

    const handleEdit = (event: any) => {
        router.push(`/cms/events/${event.id}`)
    }

    const columns = [
        {
            key: 'name',
            label: 'Evento',
            render: (item: any) => (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-900">{item.title}</span>
                    {item.has_gallery && (
                        <div className="flex items-center gap-1 mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
                                <Camera className="w-2.5 h-2.5" />
                                {item.photo_count} foto(s)
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {item.location || 'Local não definido'}
                    </div>
                </div>
            )
        },
        {
            key: 'event_date',
            label: 'Data',
            render: (item: any) => item.event_date ? (
                <div className="flex items-center gap-1.5 text-gray-600">
                    <Calendar className="w-3.5 h-3.5 text-orange-500" />
                    {new Date(item.event_date).toLocaleDateString()}
                </div>
            ) : '-'
        },
        {
            key: 'status',
            label: 'Status',
            render: (item: any) => (
                <span className={cn(
                    "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider",
                    item.status === 'upcoming' ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-gray-100 text-gray-500 border border-gray-200"
                )}>
                    {item.status === 'upcoming' ? 'Em breve' : 'Encerrado'}
                </span>
            )
        }
    ]

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Eventos</h1>
                    <p className="text-gray-500 text-sm mt-1">Gerencie os próximos eventos, webinars e congressos.</p>
                </div>
                <Link href="/cms/events/new">
                    <Button
                        className="bg-orange-500 hover:bg-orange-400 text-white font-bold gap-2 shadow-lg shadow-orange-500/20"
                    >
                        <Plus className="w-4 h-4" /> Novo Evento
                    </Button>
                </Link>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <DataTable
                    columns={columns}
                    data={events}
                    loading={loading}
                    onRowClick={handleEdit}
                />
            </div>
        </div>
    )
}


