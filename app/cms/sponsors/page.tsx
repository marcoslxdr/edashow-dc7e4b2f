'use client'

import React, { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, ShieldCheck, Loader2, Globe, ExternalLink, Image as ImageIcon, Upload, Eye, EyeOff, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/cms/DataTable'
import { saveSponsor, deleteSponsor, toggleSponsorActive, uploadSponsorLogo } from '@/lib/actions/cms-sponsors'


interface Sponsor {
    id: string
    name: string
    logo_url?: string
    logo_path?: string
    website_url?: string
    website?: string
    instagram_url?: string
    description?: string
    active: boolean
    display_order: number
    created_at?: string
    updated_at?: string
}

export default function CMSSponsorsPage() {
    const [sponsors, setSponsors] = useState<Sponsor[]>([])
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [currentSponsor, setCurrentSponsor] = useState<Partial<Sponsor>>({
        name: '',
        logo_url: '',
        website_url: '',
        instagram_url: '',
        display_order: 0,
        active: true
    })
    const [saving, setSaving] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)

    const [selectedIds, setSelectedIds] = useState<string[]>([])

    const fetchSponsors = async () => {
        setLoading(true)
        const res = await fetch('/api/cms/sponsors-list')
        const { data } = await res.json()

        // Normalize logo field names
        const normalizedData = (data || []).map(s => ({
            ...s,
            logo_url: s.logo_url || s.logo_path,
            website_url: s.website_url || s.website,
            instagram_url: s.instagram_url
        }))

        setSponsors(normalizedData)
        setLoading(false)
    }

    useEffect(() => {
        fetchSponsors()
    }, [])

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingLogo(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const logoUrl = await uploadSponsorLogo(formData)
            setCurrentSponsor(prev => ({ ...prev, logo_url: logoUrl, logo_path: logoUrl }))
        } catch (error) {
            console.error('Erro ao fazer upload:', error)
            alert('Erro ao fazer upload da logo')
        }
        setUploadingLogo(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await saveSponsor({
                ...currentSponsor,
                id: currentSponsor.id || 'new',
                logo_path: currentSponsor.logo_url,
                website: currentSponsor.website_url,
                instagram_url: currentSponsor.instagram_url
            })
            setIsEditing(false)
            setCurrentSponsor({
                name: '',
                logo_url: '',
                website_url: '',
                instagram_url: '',
                display_order: 0,
                active: true
            })
            fetchSponsors()
        } catch (error) {
            console.error('Erro ao salvar patrocinador:', error)
            alert('Erro ao salvar patrocinador')
        }
        setSaving(false)
    }

    const handleEdit = (sponsor: Sponsor) => {
        setCurrentSponsor({
            ...sponsor,
            logo_url: sponsor.logo_url || sponsor.logo_path,
            website_url: sponsor.website_url || sponsor.website,
            instagram_url: sponsor.instagram_url
        })
        setIsEditing(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este patrocinador?')) return
        try {
            await deleteSponsor(id)
            fetchSponsors()
        } catch (error) {
            console.error('Erro ao deletar:', error)
            alert('Erro ao deletar patrocinador')
        }
    }

    const handleToggleActive = async (id: string, active: boolean) => {
        try {
            await toggleSponsorActive(id, !active)
            fetchSponsors()
        } catch (error) {
            console.error('Erro ao alternar status:', error)
        }
    }

    // Bulk Actions
    const handleBulkDelete = async () => {
        if (!confirm(`Excluir ${selectedIds.length} patrocinadores?`)) return
        try {
            const { bulkDeleteSponsors } = await import('@/lib/actions/cms-sponsors')
            await bulkDeleteSponsors(selectedIds)
            setSelectedIds([])
            fetchSponsors()
        } catch (error) {
            console.error('Erro ao excluir em massa:', error)
            alert('Erro ao excluir patrocinadores')
        }
    }

    const handleBulkToggle = async (active: boolean) => {
        try {
            const { bulkToggleSponsorActive } = await import('@/lib/actions/cms-sponsors')
            await bulkToggleSponsorActive(selectedIds, active)
            setSelectedIds([])
            fetchSponsors()
        } catch (error) {
            console.error('Erro ao alterar status em massa:', error)
            alert('Erro ao atualizar status')
        }
    }

    const columns = [
        {
            key: 'drag',
            label: '',
            render: () => (
                <GripVertical className="w-4 h-4 text-gray-300 cursor-move" />
            )
        },
        {
            key: 'name',
            label: 'Patrocinador',
            render: (item: Sponsor) => (
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white p-2 flex items-center justify-center border border-gray-100 shadow-sm">
                        {item.logo_url || item.logo_path ?
                            <img
                                src={item.logo_url || item.logo_path}
                                className="max-w-full max-h-full object-contain"
                                alt={item.name}
                            /> :
                            <ImageIcon className="text-gray-300 w-5 h-5" />
                        }
                    </div>
                    <div>
                        <span className="font-bold text-gray-900 block">{item.name}</span>
                        {!item.active && (
                            <span className="text-xs text-gray-400 italic">Inativo</span>
                        )}
                    </div>
                </div>
            )
        },
        {
            key: 'active',
            label: 'Status',
            render: (item: Sponsor) => (
                <div className="flex items-center gap-2">
                    <Switch
                        checked={item.active}
                        onCheckedChange={() => handleToggleActive(item.id, item.active)}
                    />
                    <span className="text-xs text-gray-500">
                        {item.active ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
            )
        },
        {
            key: 'display_order',
            label: 'Ordem',
            render: (item: Sponsor) => (
                <span className="font-mono text-sm text-gray-500">{item.display_order}</span>
            )
        },
        {
            key: 'link',
            label: 'Site',
            render: (item: Sponsor) => item.website_url || item.website ? (
                <a
                    href={item.website_url || item.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-500 flex items-center gap-1 font-medium"
                >
                    Ver Site <ExternalLink className="w-3 h-3" />
                </a>
            ) : (
                <span className="text-gray-400">-</span>
            )
        }
    ]

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Patrocinadores</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Gerencie os logotipos e parceiros exibidos no site. Total: {sponsors.length} patrocinadores
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setCurrentSponsor({
                            name: '',
                            logo_url: '',
                            website_url: '',
                            instagram_url: '',
                            display_order: sponsors.length + 1,
                            active: true
                        })
                        setIsEditing(true)
                    }}
                    className="bg-orange-500 hover:bg-orange-400 text-white font-bold gap-2 shadow-lg shadow-orange-500/20"
                >
                    <Plus className="w-4 h-4" /> Novo Patrocinador
                </Button>
            </div>

            {selectedIds.length > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-orange-800 font-medium">
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs font-bold">{selectedIds.length}</span>
                        itens selecionados
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white border-orange-200 text-orange-700 hover:bg-orange-100"
                            onClick={() => handleBulkToggle(true)}
                        >
                            <Eye className="w-4 h-4 mr-2" /> Ativar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white border-orange-200 text-orange-700 hover:bg-orange-100"
                            onClick={() => handleBulkToggle(false)}
                        >
                            <EyeOff className="w-4 h-4 mr-2" /> Inativar
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={handleBulkDelete}
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <DataTable
                        columns={columns}
                        data={sponsors}
                        loading={loading}
                        onRowClick={handleEdit}
                        selectedItems={selectedIds}
                        onSelectionChange={setSelectedIds}
                    />
                </div>

                <div className={cn(
                    "bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit sticky top-24 transition-all",
                    !isEditing && "opacity-50 pointer-events-none grayscale"
                )}>
                    <div className="flex items-center gap-2 mb-6">
                        <ShieldCheck className="w-4 h-4 text-orange-500" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                            {currentSponsor.id ? 'Editar Parceria' : 'Nova Parceria'}
                        </h2>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        {/* Logo Upload */}
                        <div className="space-y-2">
                            <Label className="text-gray-400 text-[10px] font-bold uppercase">Logo</Label>
                            <div className="flex flex-col gap-3">
                                {currentSponsor.logo_url && (
                                    <div className="w-full h-32 rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center p-4">
                                        <img
                                            src={currentSponsor.logo_url}
                                            alt="Preview"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <label className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                            disabled={uploadingLogo}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full"
                                            disabled={uploadingLogo}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.currentTarget.parentElement?.querySelector('input')?.click()
                                            }}
                                        >
                                            {uploadingLogo ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : (
                                                <Upload className="w-4 h-4 mr-2" />
                                            )}
                                            Fazer Upload
                                        </Button>
                                    </label>
                                </div>
                                <Input
                                    value={currentSponsor.logo_url || ''}
                                    onChange={(e) => setCurrentSponsor(prev => ({ ...prev, logo_url: e.target.value }))}
                                    placeholder="ou cole a URL da logo..."
                                    className="bg-gray-50 border-gray-100 text-gray-500 text-xs focus:bg-white transition-colors"
                                />
                            </div>
                        </div>

                        {/* Company Name */}
                        <div className="space-y-2">
                            <Label className="text-gray-400 text-[10px] font-bold uppercase">Nome da Empresa</Label>
                            <Input
                                value={currentSponsor.name || ''}
                                onChange={(e) => setCurrentSponsor(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Ex: Hospital Central"
                                className="bg-gray-50 border-gray-100 text-gray-900 focus:bg-white transition-colors"
                                required
                            />
                        </div>

                        {/* Website */}
                        <div className="space-y-2">
                            <Label className="text-gray-400 text-[10px] font-bold uppercase">Endereço Web</Label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                <Input
                                    value={currentSponsor.website_url || ''}
                                    onChange={(e) => setCurrentSponsor(prev => ({ ...prev, website_url: e.target.value }))}
                                    placeholder="https://www.exemplo.com.br"
                                    className="pl-8 bg-gray-50 border-gray-100 text-gray-900 focus:bg-white transition-colors"
                                />
                            </div>
                        </div>

                        {/* Instagram */}
                        <div className="space-y-2">
                            <Label className="text-gray-400 text-[10px] font-bold uppercase">Instagram</Label>
                            <div className="relative">
                                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                <Input
                                    value={currentSponsor.instagram_url || ''}
                                    onChange={(e) => setCurrentSponsor(prev => ({ ...prev, instagram_url: e.target.value }))}
                                    placeholder="https://www.instagram.com/perfil"
                                    className="pl-8 bg-gray-50 border-gray-100 text-gray-900 focus:bg-white transition-colors"
                                />
                            </div>
                        </div>

                        {/* Display Order */}
                        <div className="space-y-2">
                            <Label className="text-gray-400 text-[10px] font-bold uppercase">Ordem de Exibição</Label>
                            <Input
                                type="number"
                                value={currentSponsor.display_order || 0}
                                onChange={(e) => setCurrentSponsor(prev => ({ ...prev, display_order: parseInt(e.target.value) }))}
                                className="bg-gray-50 border-gray-100 text-gray-900 w-24 focus:bg-white transition-colors"
                            />
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                            <Label className="text-gray-700 text-sm font-medium">Ativo no site</Label>
                            <Switch
                                checked={currentSponsor.active ?? true}
                                onCheckedChange={(checked) => setCurrentSponsor(prev => ({ ...prev, active: checked }))}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 flex gap-2">
                            <Button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {currentSponsor.id ? 'Atualizar' : 'Criar Parceria'}
                            </Button>
                            {currentSponsor.id && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleDelete(currentSponsor.id!)}
                                    className="border-red-100 text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setIsEditing(false)
                                setCurrentSponsor({
                                    name: '',
                                    logo_url: '',
                                    website_url: '',
                                    instagram_url: '',
                                    display_order: 0,
                                    active: true
                                })
                            }}
                            className="w-full text-gray-400 text-xs hover:bg-gray-50"
                        >
                            Cancelar
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ')
}
