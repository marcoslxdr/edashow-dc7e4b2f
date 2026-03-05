'use client'

import React, { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, ExternalLink, Loader2, Image as ImageIcon, Calendar, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/cms/DataTable'
import { saveBanner, deleteBanner } from '@/lib/actions/cms-banners'

import type { Banner, BannerLocation } from '@/lib/types/banner'
import { BANNER_LOCATIONS } from '@/lib/types/banner'

export default function CMSBannersPage() {
    const [banners, setBanners] = useState<Banner[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        title: '',
        link_url: '',
        location: 'home_hero' as BannerLocation,
        start_date: new Date().toISOString().slice(0, 16),
        end_date: '',
        is_active: true,
        display_order: 0,
    })

    useEffect(() => {
        fetchBanners()
    }, [])

    async function fetchBanners() {
        try {
            const res = await fetch('/api/cms/banners')
            const { banners } = await res.json()
            setBanners(banners || [])
        } catch (error) {
            console.error('Error fetching banners:', error)
        } finally {
            setLoading(false)
        }
    }

    const selectedLocation = BANNER_LOCATIONS.find(loc => loc.value === formData.location)

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        const form = new FormData(e.target as HTMLFormElement)
        if (editingBanner) {
            form.append('id', editingBanner.id)
        }

        const result = await saveBanner(form)

        if (result.success) {
            await fetchBanners()
            resetForm()
        } else {
            alert('Erro ao salvar banner: ' + (result.error?.message || 'Erro desconhecido'))
        }

        setSaving(false)
    }

    function handleEdit(banner: Banner) {
        setEditingBanner(banner)
        setFormData({
            title: banner.title,
            link_url: banner.link_url,
            location: banner.location,
            start_date: new Date(banner.start_date).toISOString().slice(0, 16),
            end_date: banner.end_date ? new Date(banner.end_date).toISOString().slice(0, 16) : '',
            is_active: banner.is_active,
            display_order: banner.display_order,
        })
        setImagePreview(banner.image_path)
        setShowForm(true)
    }

    async function handleDelete(id: string) {
        if (!confirm('Tem certeza que deseja excluir este banner?')) return

        const result = await deleteBanner(id)
        if (result.success) {
            await fetchBanners()
        } else {
            alert('Erro ao excluir banner')
        }
    }

    function resetForm() {
        setEditingBanner(null)
        setFormData({
            title: '',
            link_url: '',
            location: 'home_hero',
            start_date: new Date().toISOString().slice(0, 16),
            end_date: '',
            is_active: true,
            display_order: 0,
        })
        setImagePreview(null)
        setShowForm(false)
    }

    function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const columns = [
        {
            key: 'image',
            label: 'Preview',
            render: (item: Banner) => (
                <div className="w-20 h-12 bg-gray-100 rounded overflow-hidden border border-gray-100 shadow-sm">
                    <img src={item.image_path} alt={item.title} className="w-full h-full object-cover" />
                </div>
            )
        },
        {
            key: 'title',
            label: 'Título',
            render: (item: Banner) => (
                <div>
                    <p className="font-bold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500">{BANNER_LOCATIONS.find(l => l.value === item.location)?.label}</p>
                </div>
            )
        },
        {
            key: 'link_url',
            label: 'Link',
            render: (item: Banner) => (
                <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-500 flex items-center gap-1 text-sm font-medium">
                    <ExternalLink className="w-3 h-3" />
                    Ver
                </a>
            )
        },
        {
            key: 'dimensions',
            label: 'Dimensões',
            render: (item: Banner) => (
                <span className="text-sm text-gray-500">{item.width}x{item.height}px</span>
            )
        },
        {
            key: 'dates',
            label: 'Período',
            render: (item: Banner) => (
                <div className="text-xs text-gray-400">
                    <p>Início: {new Date(item.start_date).toLocaleDateString('pt-BR')}</p>
                    {item.end_date && <p>Fim: {new Date(item.end_date).toLocaleDateString('pt-BR')}</p>}
                </div>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (item: Banner) => {
                const now = new Date()
                const start = new Date(item.start_date)
                const end = item.end_date ? new Date(item.end_date) : null
                const isActive = item.is_active && start <= now && (!end || end >= now)

                return (
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isActive
                        ? "bg-green-50 text-green-600 border border-green-100"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}>
                        {isActive ? 'Ativo' : 'Inativo'}
                    </span>
                )
            }
        },
    ]

    const actions = [
        {
            label: 'Editar',
            icon: Edit2,
            onClick: handleEdit,
            variant: 'ghost' as const
        },
        {
            label: 'Excluir',
            icon: Trash2,
            onClick: (item: Banner) => handleDelete(item.id),
            variant: 'ghost' as const,
            className: 'text-red-500 hover:text-red-600 hover:bg-red-50'
        }
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Publicidades</h1>
                    <p className="text-gray-500 mt-1">Gerencie os banners publicitários do site</p>
                </div>
                <Button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Banner
                </Button>
            </div>

            {showForm && (
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-orange-500" />
                        {editingBanner ? 'Editar Banner' : 'Novo Banner'}
                    </h2>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Title */}
                            <div className="md:col-span-2">
                                <Label htmlFor="title" className="text-gray-400 text-[10px] font-bold uppercase">Título/Nome do Banner</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="bg-gray-50 border-gray-100 text-gray-900 mt-1 focus:bg-white transition-colors"
                                    placeholder="Ex: Banner Patrocinador Principal - Dezembro 2024"
                                    required
                                />
                            </div>

                            {/* Image Upload */}
                            <div className="md:col-span-2">
                                <Label htmlFor="image" className="text-gray-400 text-[10px] font-bold uppercase">Imagem do Banner</Label>
                                <div className="mt-2 space-y-3">
                                    <Input
                                        id="image"
                                        name="image"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="bg-gray-50 border-gray-100 text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-orange-500 file:text-white file:cursor-pointer focus:bg-white transition-colors"
                                        required={!editingBanner}
                                    />
                                    {imagePreview && (
                                        <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                                            <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Preview:</p>
                                            <img src={imagePreview} alt="Preview" className="max-h-48 rounded" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Link URL */}
                            <div className="md:col-span-2">
                                <Label htmlFor="link_url" className="text-gray-400 text-[10px] font-bold uppercase">URL de Destino</Label>
                                <Input
                                    id="link_url"
                                    name="link_url"
                                    type="url"
                                    value={formData.link_url}
                                    onChange={e => setFormData({ ...formData, link_url: e.target.value })}
                                    className="bg-gray-50 border-gray-100 text-gray-900 mt-1 focus:bg-white transition-colors"
                                    placeholder="https://exemplo.com"
                                    required
                                />
                            </div>

                            {/* Location */}
                            <div>
                                <Label htmlFor="location" className="text-gray-400 text-[10px] font-bold uppercase">Localização</Label>
                                <select
                                    id="location"
                                    name="location"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value as BannerLocation })}
                                    className="w-full bg-gray-50 border border-gray-100 text-gray-900 rounded-md px-3 py-2 mt-1 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-orange-500"
                                    required
                                >
                                    {BANNER_LOCATIONS.map(loc => (
                                        <option key={loc.value} value={loc.value}>{loc.label}</option>
                                    ))}
                                </select>
                                {selectedLocation && (
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Dimensões recomendadas: {selectedLocation.dimensions.width}x{selectedLocation.dimensions.height}px
                                    </p>
                                )}
                            </div>

                            {/* Display Order */}
                            <div>
                                <Label htmlFor="display_order" className="text-gray-400 text-[10px] font-bold uppercase">Ordem de Exibição</Label>
                                <Input
                                    id="display_order"
                                    name="display_order"
                                    type="number"
                                    value={formData.display_order}
                                    onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                                    className="bg-gray-50 border-gray-100 text-gray-900 mt-1 focus:bg-white transition-colors"
                                    min="0"
                                    required
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Menor número aparece primeiro</p>
                            </div>

                            {/* Start Date */}
                            <div>
                                <Label htmlFor="start_date" className="text-gray-400 text-[10px] font-bold uppercase">Data de Início</Label>
                                <Input
                                    id="start_date"
                                    name="start_date"
                                    type="datetime-local"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    className="bg-gray-50 border-gray-100 text-gray-900 mt-1 focus:bg-white transition-colors"
                                    required
                                />
                            </div>

                            {/* End Date */}
                            <div>
                                <Label htmlFor="end_date" className="text-gray-400 text-[10px] font-bold uppercase">Data de Fim (opcional)</Label>
                                <Input
                                    id="end_date"
                                    name="end_date"
                                    type="datetime-local"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                    className="bg-gray-50 border-gray-100 text-gray-900 mt-1 focus:bg-white transition-colors"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Deixe vazio para sem data de término</p>
                            </div>

                            {/* Hidden fields for dimensions */}
                            <input type="hidden" name="width" value={selectedLocation?.dimensions.width || 0} />
                            <input type="hidden" name="height" value={selectedLocation?.dimensions.height || 0} />
                            <input type="hidden" name="is_active" value={formData.is_active.toString()} />

                            {/* Active Status */}
                            <div className="md:col-span-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-5 h-5 rounded border-gray-200 bg-gray-50 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-sm font-medium text-gray-600">Banner ativo</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100">
                            <Button
                                type="submit"
                                disabled={saving}
                                className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>Salvar Banner</>
                                )}
                            </Button>
                            <Button
                                type="button"
                                onClick={resetForm}
                                variant="outline"
                                className="border-gray-200 text-gray-500 hover:bg-gray-50"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white border border-gray-200 shadow-sm rounded-xl">
                <DataTable
                    data={banners}
                    columns={columns}
                    actions={actions}
                    emptyMessage="Nenhum banner cadastrado"
                />
            </div>
        </div>
    )
}
