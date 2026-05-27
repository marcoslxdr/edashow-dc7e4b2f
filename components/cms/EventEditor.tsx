'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, Calendar, MapPin, Loader2, Link as LinkIcon, Save, ArrowLeft, Camera, Image as ImageIcon, Youtube, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import { saveEvent, deleteEvent } from '@/lib/actions/cms-events'
import { getGalleryByEventId, createOrUpdateGallery, deleteGallery } from '@/lib/actions/cms-event-photos'
import { CoverImageUpload } from './CoverImageUpload'
import { GalleryUploader } from './GalleryUploader'
import { GalleryPhotoGrid } from './GalleryPhotoGrid'
import { EventVideosEditor } from './EventVideosEditor'
import { getEventVideos } from '@/lib/actions/cms-event-videos'
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
    const [activeTab, setActiveTab] = useState<'details' | 'gallery' | 'videos'>('details')
    const [gallery, setGallery] = useState<any>(null)
    const [galleryLoading, setGalleryLoading] = useState(false)
    const [galleryForm, setGalleryForm] = useState({
        title: 'Galeria de Fotos',
        description: '',
        is_public: true,
        contact_email: '',
        contact_whatsapp: '',
        drive_download_url: '',
    })
    const [eventVideos, setEventVideos] = useState<any[]>([])
    const [videosLoading, setVideosLoading] = useState(false)
    const [currentEvent, setCurrentEvent] = useState<any>(() => buildInitialEvent(event))

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault()
        setLoading(true)
        try {
            const saved = await saveEvent(currentEvent)
            setCurrentEvent((prev: any) => ({ ...prev, ...saved }))
            toast.success('Evento salvo com sucesso!')
            if (!currentEvent.id && saved?.id) {
                router.replace(`/cms/events/${saved.id}`)
            } else {
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
            if (data) {
                setGallery(data)
                setGalleryForm({
                    title: data.title || 'Galeria de Fotos',
                    description: data.description || '',
                    is_public: data.is_public !== false,
                    contact_email: data.contact_email || '',
                    contact_whatsapp: data.contact_whatsapp || '',
                    drive_download_url: data.drive_download_url || '',
                })
            }
        } catch (error) {
            console.error('Erro ao buscar galeria:', error)
        }
        setGalleryLoading(false)
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
        }
    }, [currentEvent.id])

    const handleSaveGallery = async () => {
        if (!currentEvent.id) {
            toast.error('Salve o evento (Criar Evento) antes de configurar a galeria.')
            return
        }
        try {
            const data = {
                id: gallery?.id,
                event_id: currentEvent.id,
                ...galleryForm
            }
            const result = await createOrUpdateGallery(data)
            setGallery(result)
            await fetchGallery()
            toast.success('Galeria salva com sucesso!')
        } catch (error) {
            console.error('Erro ao salvar galeria:', error)
            const message = error instanceof Error ? error.message : 'Erro ao salvar galeria'
            toast.error(message)
        }
    }

    const handleDeleteGallery = async () => {
        if (!gallery?.id) return
        if (!confirm('Tem certeza que deseja excluir toda a galeria? Todas as fotos serão removidas.')) return
        
        try {
            await deleteGallery(gallery.id)
            setGallery(null)
            setGalleryForm({
                title: 'Galeria de Fotos',
                description: '',
                is_public: true,
                contact_email: '',
                contact_whatsapp: '',
                drive_download_url: '',
            })
            toast.success('Galeria excluída!')
        } catch (error) {
            console.error('Erro ao excluir galeria:', error)
            toast.error('Erro ao excluir galeria')
        }
    }

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

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
                <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'details'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Detalhes do Evento
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('gallery')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'gallery'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Camera className="w-4 h-4" />
                    Galeria de Fotos
                    {gallery && <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full">{gallery.photos?.length || 0}</span>}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('videos')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'videos'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Youtube className="w-4 h-4" />
                    Vídeos
                    {eventVideos.length > 0 && (
                        <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full">
                            {eventVideos.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'details' && (
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

            {activeTab === 'gallery' && (
                <div className="space-y-6">
                    {!currentEvent.id && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Use <strong>Criar Evento</strong> acima para salvar o evento primeiro. Depois você pode criar a galeria de fotos.
                        </div>
                    )}
                    {galleryLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                        </div>
                    ) : (
                        <>
                            {/* Gallery Settings */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Camera className="w-5 h-5 text-orange-500" />
                                    Configurações da Galeria
                                </h3>
                                <p className="text-sm text-gray-500">
                                    As fotos enviadas recebem marca d&apos;água automaticamente na versão pública.
                                </p>

                                <div className="space-y-2">
                                    <Label>Título da Galeria</Label>
                                    <Input
                                        value={galleryForm.title}
                                        onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })}
                                        placeholder="Galeria de Fotos"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Descrição</Label>
                                    <textarea
                                        value={galleryForm.description}
                                        onChange={(e) => setGalleryForm({ ...galleryForm, description: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-md p-3 text-gray-700 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
                                        placeholder="Descrição opcional da galeria..."
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label>Galeria Pública</Label>
                                    <Switch
                                        checked={galleryForm.is_public}
                                        onCheckedChange={(checked) => setGalleryForm({ ...galleryForm, is_public: checked })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Download className="w-4 h-4 text-gray-400" />
                                        Link do Google Drive (download das fotos)
                                    </Label>
                                    <Input
                                        value={galleryForm.drive_download_url}
                                        onChange={(e) =>
                                            setGalleryForm({ ...galleryForm, drive_download_url: e.target.value })
                                        }
                                        placeholder="https://drive.google.com/drive/folders/..."
                                    />
                                    <p className="text-xs text-gray-500">
                                        Link compartilhado do Drive para o visitante baixar as fotos em alta qualidade.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Email de Contato</Label>
                                        <Input
                                            value={galleryForm.contact_email}
                                            onChange={(e) => setGalleryForm({ ...galleryForm, contact_email: e.target.value })}
                                            placeholder="contato@exemplo.com"
                                            type="email"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>WhatsApp de Contato</Label>
                                        <Input
                                            value={galleryForm.contact_whatsapp}
                                            onChange={(e) => setGalleryForm({ ...galleryForm, contact_whatsapp: e.target.value })}
                                            placeholder="(11) 99999-9999"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <Button
                                        type="button"
                                        onClick={handleSaveGallery}
                                        disabled={!currentEvent.id}
                                        className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        Salvar Galeria
                                    </Button>
                                    {gallery?.id && (
                                        <Button
                                            variant="destructive"
                                            onClick={handleDeleteGallery}
                                            className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Excluir Galeria
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Photo Upload */}
                            {gallery?.id && (
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <ImageIcon className="w-5 h-5 text-orange-500" />
                                        Enviar Fotos
                                    </h3>
                                    <GalleryUploader
                                        galleryId={gallery.id}
                                        onUploadComplete={fetchGallery}
                                    />
                                </div>
                            )}

                            {/* Photo Grid */}
                            {gallery?.photos?.length > 0 && (
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <ImageIcon className="w-5 h-5 text-orange-500" />
                                        Fotos ({gallery.photos.length})
                                    </h3>
                                    <GalleryPhotoGrid
                                        photos={gallery.photos}
                                        onUpdate={fetchGallery}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {activeTab === 'videos' && (
                <div className="space-y-6">
                    {!currentEvent.id && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Use <strong>Criar Evento</strong> acima para salvar o evento antes de anexar vídeos.
                        </div>
                    )}
                    {videosLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                        </div>
                    ) : currentEvent.id ? (
                        <EventVideosEditor
                            eventId={currentEvent.id}
                            videos={eventVideos}
                            onChange={fetchVideos}
                        />
                    ) : null}
                </div>
            )}
        </div>
    )
}
