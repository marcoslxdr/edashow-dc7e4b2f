'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { Tag, Plus, X, Sparkles, Loader2, Save, Trash2, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getKeywordSuggestions, checkAIConfiguration } from '@/lib/actions/ai-posts'
import {
    getKeywordGroups,
    createKeywordGroup,
    deleteKeywordGroup,
    addKeywordToGroup,
    removeKeywordFromGroup,
    getKeywordCategories,
    type KeywordGroup
} from '@/lib/actions/keywords'

export function KeywordsTab() {
    const [groups, setGroups] = useState<KeywordGroup[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [activeCategory, setActiveCategory] = useState<string>('todas')
    const [topicInput, setTopicInput] = useState('')
    const [categoryInput, setCategoryInput] = useState('geral')
    const [manualKeyword, setManualKeyword] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSuggesting, setIsSuggesting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [suggestedKeywords, setSuggestedKeywords] = useState<{
        primary: string[]
        secondary: string[]
        longTail: string[]
    } | null>(null)

    // Load groups from Supabase
    const loadGroups = async (category?: string) => {
        try {
            const [data, cats] = await Promise.all([
                getKeywordGroups(category === 'todas' ? undefined : category),
                getKeywordCategories()
            ])
            setGroups(data)
            setCategories(cats)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar keywords')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadGroups(activeCategory)
    }, [activeCategory])

    const handleSuggest = async () => {
        if (!topicInput.trim()) return
        setIsSuggesting(true)
        setError(null)
        setSuggestedKeywords(null)

        try {
            const config = await checkAIConfiguration()
            if (!config.configured) {
                setError('API de IA não configurada. Adicione OPENCODE_API_KEY ao .env')
                return
            }
            const suggestions = await getKeywordSuggestions(topicInput)
            setSuggestedKeywords(suggestions)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar sugestes')
        } finally {
            setIsSuggesting(false)
        }
    }

    const handleSaveGroup = async () => {
        if (!suggestedKeywords || !topicInput.trim()) return
        setError(null)

        const allKeywords = [
            ...suggestedKeywords.primary,
            ...suggestedKeywords.secondary,
            ...suggestedKeywords.longTail
        ]

        try {
            await createKeywordGroup(topicInput, allKeywords, categoryInput)
            setTopicInput('')
            setCategoryInput('geral')
            setSuggestedKeywords(null)
            await loadGroups(activeCategory)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar grupo')
        }
    }

    const handleAddManual = async () => {
        if (!manualKeyword.trim()) return
        setError(null)

        try {
            const generalGroup = groups.find(g => g.topic === 'Geral')
            if (generalGroup) {
                await addKeywordToGroup(generalGroup.id, manualKeyword.trim())
            } else {
                await createKeywordGroup('Geral', [manualKeyword.trim()], 'geral')
            }
            setManualKeyword('')
            await loadGroups(activeCategory)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao adicionar keyword')
        }
    }

    const handleDeleteGroup = (groupId: string) => {
        startTransition(async () => {
            try {
                await deleteKeywordGroup(groupId)
                setGroups(prev => prev.filter(g => g.id !== groupId))
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro ao deletar grupo')
            }
        })
    }

    const handleRemoveKeyword = (groupId: string, keyword: string) => {
        startTransition(async () => {
            try {
                const result = await removeKeywordFromGroup(groupId, keyword)
                if (result === null) {
                    // Group was deleted (empty)
                    setGroups(prev => prev.filter(g => g.id !== groupId))
                } else {
                    setGroups(prev =>
                        prev.map(g => g.id === groupId ? result : g)
                    )
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro ao remover keyword')
            }
        })
    }

    const totalKeywords = groups.reduce((sum, g) => sum + g.keywords.length, 0)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <p className="text-sm text-gray-500 mb-1">Grupos</p>
                    <p className="text-3xl font-bold text-gray-900">{groups.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <p className="text-sm text-gray-500 mb-1">Total de Keywords</p>
                    <p className="text-3xl font-bold text-orange-600">{totalKeywords}</p>
                </div>
            </div>

            {/* Category Filter */}
            {categories.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <button
                        onClick={() => setActiveCategory('todas')}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                            activeCategory === 'todas'
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        Todas
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize",
                                activeCategory === cat
                                    ? "bg-orange-500 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* AI Suggestion */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Sugerir com IA</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Digite um tpico e a IA sugerir palavras-chave principais, secundrias e long-tail
                </p>

                <div className="flex gap-2 mb-4">
                    <Input
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
                        placeholder="Ex: sade dental, plano de sade, medicina preventiva..."
                        className="bg-gray-50 border-gray-200 focus:ring-orange-500"
                        disabled={isSuggesting}
                    />
                    <Button
                        onClick={handleSuggest}
                        disabled={!topicInput.trim() || isSuggesting}
                        className="bg-orange-500 hover:bg-orange-600 shrink-0"
                    >
                        {isSuggesting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        <span className="ml-2">Sugerir</span>
                    </Button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
                        {error}
                        <button onClick={() => setError(null)} className="ml-2 underline">Fechar</button>
                    </div>
                )}

                {suggestedKeywords && (
                    <div className="space-y-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                        {[
                            { label: 'Principais', items: suggestedKeywords.primary, color: 'bg-orange-500 text-white' },
                            { label: 'Secundrias', items: suggestedKeywords.secondary, color: 'bg-orange-200 text-orange-800' },
                            { label: 'Long-tail', items: suggestedKeywords.longTail, color: 'bg-white text-orange-700 border border-orange-200' }
                        ].map(({ label, items, color }) => items.length > 0 && (
                            <div key={label}>
                                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">{label}</p>
                                <div className="flex flex-wrap gap-2">
                                    {items.map(kw => (
                                        <span key={kw} className={cn("px-3 py-1 rounded-full text-sm font-medium", color)}>
                                            {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <div className="flex gap-2 mt-3">
                            <Input
                                value={categoryInput}
                                onChange={(e) => setCategoryInput(e.target.value)}
                                placeholder="Categoria (ex: sade, tecnologia...)"
                                className="bg-white border-orange-200 focus:ring-orange-500 text-sm"
                            />
                            <Button
                                onClick={handleSaveGroup}
                                className="bg-orange-500 hover:bg-orange-600 shrink-0"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Salvar grupo
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Add */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Manualmente</h2>
                <div className="flex gap-2">
                    <Input
                        value={manualKeyword}
                        onChange={(e) => setManualKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
                        placeholder="Digite uma palavra-chave..."
                        className="bg-gray-50 border-gray-200 focus:ring-orange-500"
                    />
                    <Button
                        variant="outline"
                        onClick={handleAddManual}
                        disabled={!manualKeyword.trim()}
                        className="shrink-0 border-orange-300 text-orange-600 hover:bg-orange-50"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Ser adicionada ao grupo "Geral" automaticamente
                </p>
            </div>

            {/* Keyword Groups */}
            {groups.length > 0 ? (
                <div className="space-y-4">
                    {groups.map(group => (
                        <div key={group.id} className={cn(
                            "bg-white rounded-xl border border-gray-200 shadow-sm p-6",
                            isPending && "opacity-60 pointer-events-none"
                        )}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-orange-100 rounded-lg">
                                        <Tag className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900">{group.topic}</h3>
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
                                        {group.keywords.length} keywords
                                    </span>
                                    {group.category && group.category !== 'geral' && (
                                        <span className="text-xs text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full font-medium capitalize">
                                            {group.category}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDeleteGroup(group.id)}
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {group.keywords.map(kw => (
                                    <span
                                        key={kw}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm group/tag hover:bg-gray-200 transition-colors"
                                    >
                                        {kw}
                                        <button
                                            onClick={() => handleRemoveKeyword(group.id, kw)}
                                            className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-500 ml-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-gray-400">
                    <Tag className="w-14 h-14 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">Nenhuma keyword salva ainda</p>
                    <p className="text-sm mt-1">Use a IA para sugerir ou adicione manualmente</p>
                </div>
            )}
        </div>
    )
}
