'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, MapPin, Loader2, Link as LinkIcon, Save, ArrowLeft, Camera, Image as ImageIcon } from 'lucide-react'
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
import { toast } from 'sonner'
import Link from 'next/link'

interface EventEditorProps {
    event?: any
}

export function EventEditor({ event }: EventEditorProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'details' | 'gallery'>('details')
    const [gallery, setGallery] = useState<any>(null)
    const [galleryLoading, setGalleryLoading] = useState(false)
    const [galleryForm, setGalleryForm] = useState({
        title: 'Galeria de Fotos',
        description: '',
        is_public: true,
        contact_email: '',
        contact_whatsapp: ''
    })
    const [currentEvent, setCurrentEvent] = useState<any>(event || {
        title: '',
        event_date: '',
        location: '',
        description: '',
        status: 'upcoming',
        registration_url: '',
        cover_image_url: ''
    })

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await saveEvent(currentEvent)
            toast.success('Evento salvo com sucesso!')
            router.push('/cms/events')
        } catch (error) {
            console.error('Erro ao salvar evento:', error)
            toast.error('Erro ao salvar evento.')
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
                    contact_whatsapp: data.contact_whatsapp || ''
                })
            }
        } catch (error) {
            console.error('Erro ao buscar galeria:', error)
        }
        setGalleryLoading(false)
    }

    useEffect(() => {
        if (currentEvent.id) {
            fetchGallery()
        }
    }, [currentEvent.id])

    const handleSaveGallery = async () => {
        try {
            const data = {
                id: gallery?.id,
                event_id: currentEvent.id,
                ...galleryForm
            }
            const result = await createOrUpdateGallery(data)
            setGallery(result)
            toast.success('Galeria salva com sucesso!')
        } catch (error) {
            console.error('Erro ao salvar galeria:', error)
            toast.error('Erro ao salvar galeria')
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
                contact_whatsapp: ''
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
                        onClick={handleSave}
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
                                    onChange={(e) => setCurrentEvent({ ...currentEvent, title: e.target.value })}
                                    placeholder="Ex: Congresso Saúde Digital 2026"
                                    className="text-lg font-medium"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <textarea
                                    value={currentEvent.description}
                                    onChange={(e) => setCurrentEvent({ ...currentEvent, description: e.target.value })}
                                    className="w-full bg-white border border-gray-200 rounded-md p-3 text-gray-700 text-sm min-h-[150px] outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
                                    placeholder="Descreva os detalhes do evento, programação, palestrantes, etc..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Imagem de Capa</Label>
                                <CoverImageUpload
                                    value={currentEvent.cover_image_url}
                                    onChange={(url) => setCurrentEvent({ ...currentEvent, cover_image_url: url })}
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
                                    onChange={(e) => setCurrentEvent({ ...currentEvent, status: e.target.value })}
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
                                        value={currentEvent.event_date ? new Date(currentEvent.event_date).toISOString().split('T')[0] : ''}
                                        onChange={(e) => setCurrentEvent({ ...currentEvent, event_date: e.target.value })}
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
                                        onChange={(e) => setCurrentEvent({ ...currentEvent, location: e.target.value })}
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
                                        onChange={(e) => setCurrentEvent({ ...currentEvent, registration_url: e.target.value })}
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
                                        onClick={handleSaveGallery}
                                        className="bg-orange-500 hover:bg-orange-600 text-white"
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
        </div>
    )
}
