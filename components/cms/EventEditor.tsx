'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, Calendar, MapPin, Loader2, Link as LinkIcon, Save, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import { saveEvent, deleteEvent } from '@/lib/actions/cms-events'
import { getGalleryByEventId } from '@/lib/actions/cms-event-photos'
import { CoverImageUpload } from './CoverImageUpload'
import { EventStepper, type EventEditorStep } from './EventStepper'
import { EventGalleryPanel } from './EventGalleryPanel'
import { EventVideosPanel } from './EventVideosPanel'
import { EventPostsPanel } from './EventPostsPanel'
import { getEventVideos } from '@/lib/actions/cms-event-videos'
import { getEventPosts } from '@/lib/actions/cms-event-posts'
import { toast } from 'sonner'
import Link from 'next/link'

interface EventEditorProps {
    event?: any
}

/** ISO date strings from Postgres can shift calendar day when parsed as UTC; keep YYYY-MM-DD stable for <input type="date">. */
function formatDateInputValue(value: string | undefined | null): string {
    if (!value) return ''
    const s = String(value)
    const ymd = s.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function buildInitialEvent(evt?: any) {
    const base = {
        title: '',
        slug: '',
        event_date: '',
        location: '',
        description: '',
        status: 'upcoming',
        registration_url: '',
        cover_image_url: '',
    }
    if (!evt) return base
    return {
        ...base,
        ...evt,
        title: evt.title ?? '',
        slug: evt.slug ?? '',
        event_date: evt.event_date ?? '',
        location: evt.location ?? '',
        description: typeof evt.description === 'string' ? evt.description : '',
        status: evt.status ?? 'upcoming',
        registration_url: evt.registration_url ?? '',
        cover_image_url: evt.cover_image_url ?? '',
    }
}

export function EventEditor({ event }: EventEditorProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [activeStep, setActiveStep] = useState<EventEditorStep>('details')
    const [gallery, setGallery] = useState<any>(null)
    const [galleryLoading, setGalleryLoading] = useState(false)
    const [eventVideos, setEventVideos] = useState<any[]>([])
    const [videosLoading, setVideosLoading] = useState(false)
    const [postCount, setPostCount] = useState(0)
    const [currentEvent, setCurrentEvent] = useState<any>(() => buildInitialEvent(event))

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault()
        setLoading(true)
        try {
            const saved = await saveEvent(currentEvent)
            setCurrentEvent((prev: any) => ({ ...prev, ...saved }))
            if (!currentEvent.id && saved?.id) {
                toast.success('Evento criado. Você pode anexar galeria, vídeos e posts quando quiser.')
                router.replace(`/cms/events/${saved.id}`)
            } else {
                toast.success('Evento salvo com sucesso!')
                router.refresh()
            }
        } catch (error) {
            console.error('Erro ao salvar evento:', error)
            const message = error instanceof Error ? error.message : 'Erro ao salvar evento.'
            toast.error(message)
        }
        setLoading(false)
    }

    const handleDelete = async () => {
        if (!confirm('Tem certeza que deseja excluir este evento?')) return
        try {
            await deleteEvent(currentEvent.id)
            toast.success('Evento excluído!')
            router.push('/cms/events')
        } catch (error) {
            console.error('Erro ao excluir:', error)
            toast.error('Erro ao excluir evento.')
        }
    }

    const fetchGallery = async () => {
        if (!currentEvent.id) return
        setGalleryLoading(true)
        try {
            const data = await getGalleryByEventId(currentEvent.id)
            setGallery(data ?? null)
        } catch (error) {
            console.error('Erro ao buscar galeria:', error)
        }
        setGalleryLoading(false)
    }

    const fetchPostCount = async () => {
        if (!currentEvent.id) return
        try {
            const posts = await getEventPosts(currentEvent.id)
            setPostCount(posts.length)
        } catch {
            setPostCount(0)
        }
    }

    const fetchVideos = async () => {
        if (!currentEvent.id) return
        setVideosLoading(true)
        try {
            const data = await getEventVideos(currentEvent.id)
            setEventVideos(data)
        } catch (error) {
            console.error('Erro ao buscar vídeos:', error)
        }
        setVideosLoading(false)
    }

    useEffect(() => {
        if (currentEvent.id) {
            fetchGallery()
            fetchVideos()
            fetchPostCount()
        }
    }, [currentEvent.id])

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/cms/events">
                        <Button variant="ghost" size="icon" className="hover:bg-gray-100">
                            <ArrowLeft className="w-5 h-5 text-gray-500" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {currentEvent.id ? 'Editar Evento' : 'Novo Evento'}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {currentEvent.id ? 'Gerencie os detalhes do evento.' : 'Preencha as informações para criar um novo evento.'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {currentEvent.id && (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            className="bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={() => handleSave()}
                        disabled={loading}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold min-w-[140px]"
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {currentEvent.id ? 'Salvar' : 'Criar Evento'}
                    </Button>
                </div>
            </div>

            <EventStepper
                activeStep={activeStep}
                onStepChange={setActiveStep}
                eventId={currentEvent.id}
                photoCount={gallery?.photos?.length || 0}
                videoCount={eventVideos.length}
                postCount={postCount}
            />

            {activeStep === 'details' && (
                <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                            <div className="space-y-2">
                                <Label>Nome do Evento</Label>
                                <Input
                                    value={currentEvent.title}
                                    onChange={(e) =>
                                        setCurrentEvent((prev: any) => ({
                                            ...prev,
                                            title: e.target.value,
                                        }))
                                    }
                                    placeholder="Ex: Congresso Saúde Digital 2026"
                                    className="text-lg font-medium"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Slug (URL pública)</Label>
                                <Input
                                    value={currentEvent.slug ?? ''}
                                    onChange={(e) =>
                                        setCurrentEvent((prev: any) => ({
                                            ...prev,
                                            slug: e.target.value,
                                        }))
                                    }
                                    placeholder="Deixe em branco para gerar automaticamente a partir do nome"
                                    className="font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500">
                                    Ex.: <span className="font-mono">/events/seu-slug-aqui</span>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <textarea
                                    value={currentEvent.description}
                                    onChange={(e) =>
                                        setCurrentEvent((prev: any) => ({
                                            ...prev,
                                            description: e.target.value,
                                        }))
                                    }
                                    className="w-full bg-white border border-gray-200 rounded-md p-3 text-gray-700 text-sm min-h-[150px] outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
                                    placeholder="Descreva os detalhes do evento, programação, palestrantes, etc..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Imagem de Capa</Label>
                                <CoverImageUpload
                                    value={currentEvent.cover_image_url}
                                    onChange={(url) =>
                                        setCurrentEvent((prev: any) => ({
                                            ...prev,
                                            cover_image_url: url ?? '',
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3">Detalhes</h3>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase">Status</Label>
                                <select
                                    value={currentEvent.status}
                                    onChange={(e) =>
                                        setCurrentEvent((prev: any) => ({
                                            ...prev,
                                            status: e.target.value,
                                        }))
                                    }
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-md px-3 h-10 outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="upcoming">Em breve</option>
                                    <option value="past">Encerrado</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase">Data</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="date"
                                        value={formatDateInputValue(currentEvent.event_date)}
                                        onChange={(e) =>
                                            setCurrentEvent((prev: any) => ({
                                                ...prev,
                                                event_date: e.target.value,
                                            }))
                                        }
                                        className="pl-9"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase">Localização</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        value={currentEvent.location}
                                        onChange={(e) =>
                                            setCurrentEvent((prev: any) => ({
                                                ...prev,
                                                location: e.target.value,
                                            }))
                                        }
                                        placeholder="Local ou Online"
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-gray-500 uppercase">Link de Inscrição</Label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        value={currentEvent.registration_url}
                                        onChange={(e) =>
                                            setCurrentEvent((prev: any) => ({
                                                ...prev,
                                                registration_url: e.target.value,
                                            }))
                                        }
                                        placeholder="https://..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </form>
            )}

            {activeStep === 'gallery' && currentEvent.id && (
                <EventGalleryPanel
                    eventId={currentEvent.id}
                    onGalleryChange={() => {
                        fetchGallery()
                    }}
                />
            )}

            {activeStep === 'videos' && currentEvent.id && (
                videosLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <EventVideosPanel
                        eventId={currentEvent.id}
                        videos={eventVideos}
                        onChange={fetchVideos}
                    />
                )
            )}

            {activeStep === 'posts' && currentEvent.id && (
                <EventPostsPanel eventId={currentEvent.id} />
            )}
        </div>
    )
}
