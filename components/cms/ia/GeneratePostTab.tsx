'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Sparkles,
    Loader2,
    ChevronRight,
    ChevronLeft,
    Lightbulb,
    FileText,
    Send,
    Check,
    Plus,
    X,
    Wand2,
    Image as ImageIcon,
    RefreshCw,
    Database
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
    generateAIPost,
    getKeywordSuggestions,
    checkAIConfiguration
} from '@/lib/actions/ai-posts'
import { getKeywordGroups, type KeywordGroup } from '@/lib/actions/keywords'
import { CoverImageGenerator } from '@/components/cms/ai/CoverImageGenerator'

type ToneType = 'professional' | 'casual' | 'formal' | 'friendly'

interface GeneratedPost {
    title: string
    slug: string
    excerpt: string
    content: string
    metaDescription: string
    suggestedTags: string[]
    suggestedCategory?: string
    categoryId?: string
    seoScore?: number
}

const toneOptions: Array<{ id: ToneType; label: string; description: string }> = [
    { id: 'professional', label: 'Profissional', description: 'Sério e informativo' },
    { id: 'casual', label: 'Casual', description: 'Amigável e descontraído' },
    { id: 'formal', label: 'Formal', description: 'Técnico e acadêmico' },
    { id: 'friendly', label: 'Amigável', description: 'Acolhedor e acessível' }
]

export function GeneratePostTab() {
    const router = useRouter()

    const [step, setStep] = useState(1)
    const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Step 1: Topic, Keywords & Tone
    const [topic, setTopic] = useState('')
    const [keywords, setKeywords] = useState<string[]>([])
    const [keywordInput, setKeywordInput] = useState('')
    const [tone, setTone] = useState<ToneType>('professional')
    const [suggestedKeywords, setSuggestedKeywords] = useState<{
        primary: string[]
        secondary: string[]
        longTail: string[]
    } | null>(null)

    // Step 2: Generating
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null)

    // Step 3: Review + Image
    const [coverImageUrl, setCoverImageUrl] = useState<string>('')
    const [showImagePicker, setShowImagePicker] = useState(false)

    // Keyword import from database
    const [showKeywordImport, setShowKeywordImport] = useState(false)
    const [savedGroups, setSavedGroups] = useState<KeywordGroup[]>([])
    const [isLoadingGroups, setIsLoadingGroups] = useState(false)

    const handleLoadSavedKeywords = async () => {
        setIsLoadingGroups(true)
        try {
            const groups = await getKeywordGroups()
            setSavedGroups(groups)
            setShowKeywordImport(true)
        } catch {
            // silently fail
        } finally {
            setIsLoadingGroups(false)
        }
    }

    const handleImportKeywords = (groupKeywords: string[]) => {
        setKeywords(prev => {
            const next = [...prev]
            for (const kw of groupKeywords) {
                if (!next.includes(kw)) next.push(kw)
            }
            return next
        })
    }

    const handleAddKeyword = () => {
        if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
            setKeywords([...keywords, keywordInput.trim()])
            setKeywordInput('')
        }
    }

    const handleRemoveKeyword = (keyword: string) => {
        setKeywords(keywords.filter(k => k !== keyword))
    }

    const toggleSuggestedKeyword = (keyword: string) => {
        if (keywords.includes(keyword)) {
            handleRemoveKeyword(keyword)
        } else {
            setKeywords([...keywords, keyword])
        }
    }

    const handleSuggestKeywords = async () => {
        if (!topic.trim()) return
        setIsLoadingKeywords(true)
        setError(null)

        try {
            const config = await checkAIConfiguration()
            if (!config.configured) {
                setError('API de IA não configurada. Configure OPENCODE_API_KEY.')
                return
            }

            const suggestions = await getKeywordSuggestions(topic)
            setSuggestedKeywords(suggestions)

            if (suggestions.primary.length > 0) {
                setKeywords(prev => {
                    const next = [...prev]
                    for (const kw of suggestions.primary) {
                        if (!next.includes(kw)) next.push(kw)
                    }
                    return next
                })
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao sugerir keywords')
        } finally {
            setIsLoadingKeywords(false)
        }
    }

    const handleGenerate = async () => {
        setStep(2)
        setIsGenerating(true)
        setError(null)

        try {
            const result = await generateAIPost({
                topic,
                keywords,
                tone,
                wordCount: 1000,
                autoCategorize: true
            })

            setGeneratedPost(result)
            setStep(3)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao gerar post')
            setStep(1)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSendToEditor = () => {
        if (!generatedPost) return

        sessionStorage.setItem('ai_generated_post', JSON.stringify({
            ...generatedPost,
            coverImageUrl: coverImageUrl || undefined
        }))

        router.push('/cms/posts/new?fromAI=true')
    }

    const steps = [
        { number: 1, label: 'Tópico', icon: Lightbulb },
        { number: 2, label: 'Geração', icon: Wand2 },
        { number: 3, label: 'Revisão', icon: FileText }
    ]

    return (
        <div className="max-w-4xl mx-auto">
            {/* Progress Steps */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    {steps.map((s, index) => {
                        const Icon = s.icon
                        const isActive = step === s.number
                        const isCompleted = step > s.number
                        return (
                            <React.Fragment key={s.number}>
                                <div className="flex flex-col items-center">
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                                        isActive && "bg-orange-500 text-white shadow-lg",
                                        isCompleted && "bg-green-500 text-white",
                                        !isActive && !isCompleted && "bg-gray-200 text-gray-500"
                                    )}>
                                        {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                    </div>
                                    <span className={cn(
                                        "text-xs mt-2 font-medium",
                                        isActive && "text-orange-600",
                                        isCompleted && "text-green-600",
                                        !isActive && !isCompleted && "text-gray-500"
                                    )}>
                                        {s.label}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={cn(
                                        "flex-1 h-1 mx-4 rounded",
                                        step > s.number ? "bg-green-500" : "bg-gray-200"
                                    )} />
                                )}
                            </React.Fragment>
                        )
                    })}
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Step 1: Topic, Keywords & Tone */}
            {step === 1 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sobre o que você quer escrever?</h2>
                        <p className="text-sm text-gray-500">
                            Descreva o tópico — serão geradas aproximadamente <strong>1000 palavras</strong>
                        </p>
                    </div>

                    {/* Topic */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tópico</label>
                        <Textarea
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Ex: Os benefícios do clareamento dental para a autoestima..."
                            className="bg-gray-50 border-gray-200 focus:bg-white focus:ring-orange-500 min-h-[90px]"
                        />
                    </div>

                    {/* Keywords */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">Palavras-chave</label>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleLoadSavedKeywords}
                                    disabled={isLoadingGroups}
                                    className="text-gray-600 border-gray-300 hover:bg-gray-50"
                                >
                                    {isLoadingGroups ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <Database className="w-4 h-4 mr-2" />
                                    )}
                                    Importar do Banco
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSuggestKeywords}
                                    disabled={!topic.trim() || isLoadingKeywords}
                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                >
                                    {isLoadingKeywords ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <Sparkles className="w-4 h-4 mr-2" />
                                    )}
                                    Sugerir Keywords
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-2 mb-3">
                            <Input
                                value={keywordInput}
                                onChange={(e) => setKeywordInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                                placeholder="Digite uma palavra-chave..."
                                className="bg-gray-50 border-gray-200 focus:ring-orange-500"
                            />
                            <Button variant="outline" onClick={handleAddKeyword} className="border-gray-200">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        {keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {keywords.map((kw) => (
                                    <span
                                        key={kw}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
                                    >
                                        {kw}
                                        <button onClick={() => handleRemoveKeyword(kw)} className="hover:text-orange-900">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {suggestedKeywords && (
                            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                                <p className="text-sm font-medium text-gray-700">Sugestões da IA:</p>
                                {[
                                    { label: 'Principais', items: suggestedKeywords.primary },
                                    { label: 'Secundárias', items: suggestedKeywords.secondary },
                                    { label: 'Long-tail', items: suggestedKeywords.longTail }
                                ].map(({ label, items }) => items.length > 0 && (
                                    <div key={label}>
                                        <p className="text-xs text-gray-500 mb-1.5">{label}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {items.map((kw) => (
                                                <button
                                                    key={kw}
                                                    onClick={() => toggleSuggestedKeyword(kw)}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-sm transition-colors",
                                                        keywords.includes(kw)
                                                            ? "bg-orange-500 text-white"
                                                            : "bg-white border border-gray-200 text-gray-700 hover:border-orange-300"
                                                    )}
                                                >
                                                    {kw}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Import from Database */}
                        {showKeywordImport && savedGroups.length > 0 && (
                            <div className="p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-100">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-blue-700">Keywords Salvas:</p>
                                    <button
                                        onClick={() => setShowKeywordImport(false)}
                                        className="text-blue-400 hover:text-blue-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                {savedGroups.map(group => (
                                    <div key={group.id}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className="text-xs text-blue-600 font-semibold">
                                                {group.topic}
                                                {group.category !== 'geral' && (
                                                    <span className="ml-2 text-blue-400 font-normal capitalize">({group.category})</span>
                                                )}
                                            </p>
                                            <button
                                                onClick={() => handleImportKeywords(group.keywords)}
                                                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                                            >
                                                Importar todas
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {group.keywords.map(kw => (
                                                <button
                                                    key={kw}
                                                    onClick={() => toggleSuggestedKeyword(kw)}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-sm transition-colors",
                                                        keywords.includes(kw)
                                                            ? "bg-blue-500 text-white"
                                                            : "bg-white border border-blue-200 text-blue-700 hover:border-blue-400"
                                                    )}
                                                >
                                                    {kw}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {showKeywordImport && savedGroups.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-3">
                                Nenhuma keyword salva. Use a aba "Keywords" para criar grupos.
                            </p>
                        )}
                    </div>

                    {/* Tone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Tom de voz</label>
                        <div className="grid grid-cols-2 gap-2">
                            {toneOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setTone(option.id)}
                                    className={cn(
                                        "p-3 rounded-xl border-2 text-left transition-all",
                                        tone === option.id
                                            ? "border-orange-500 bg-orange-50"
                                            : "border-gray-200 hover:border-orange-300"
                                    )}
                                >
                                    <p className={cn(
                                        "font-medium text-sm",
                                        tone === option.id ? "text-orange-700" : "text-gray-900"
                                    )}>
                                        {option.label}
                                    </p>
                                    <p className="text-xs text-gray-500">{option.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            onClick={handleGenerate}
                            disabled={!topic.trim()}
                            className="bg-orange-500 hover:bg-orange-600 px-8"
                            size="lg"
                        >
                            <Wand2 className="w-5 h-5 mr-2" />
                            Gerar Artigo
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 2: Generating */}
            {step === 2 && isGenerating && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-6">
                        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Gerando seu artigo...</h2>
                    <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                        A IA está criando um artigo sobre "{topic}" com aproximadamente 1000 palavras.
                    </p>
                    {keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-center">
                            {keywords.slice(0, 5).map((kw) => (
                                <span key={kw} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                                    {kw}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: Review + Image */}
            {step === 3 && generatedPost && (
                <div className="space-y-6">
                    {/* Summary */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-6">
                        <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
                            Artigo Gerado
                        </span>
                        <h2 className="text-xl font-bold text-gray-900 mt-1 mb-3">{generatedPost.title}</h2>
                        <p className="text-gray-600 text-sm mb-4">{generatedPost.excerpt}</p>
                        {generatedPost.suggestedTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {generatedPost.suggestedTags.map((tag) => (
                                    <span key={tag} className="px-2 py-1 bg-white/70 text-gray-600 rounded text-xs">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cover Image */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Imagem Destacada</h3>

                        {coverImageUrl ? (
                            <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video mb-3">
                                <img
                                    src={coverImageUrl}
                                    alt="Imagem de capa selecionada"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <button
                                        onClick={() => setShowImagePicker(true)}
                                        className="px-3 py-1.5 bg-white/90 text-gray-700 rounded-lg text-sm font-medium hover:bg-white transition-colors flex items-center gap-1.5"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Trocar
                                    </button>
                                    <button
                                        onClick={() => setCoverImageUrl('')}
                                        className="p-1.5 bg-white/90 text-red-500 rounded-lg hover:bg-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowImagePicker(true)}
                                className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-all flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-orange-500"
                            >
                                <ImageIcon className="w-10 h-10" />
                                <div className="text-center">
                                    <p className="font-medium">Selecionar imagem de capa</p>
                                    <p className="text-sm">Gerar com IA (Gemini) ou buscar no Pexels</p>
                                </div>
                            </button>
                        )}
                    </div>

                    {/* Content Preview */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">Conteúdo</h3>
                            <span className="text-xs text-gray-400">
                                {generatedPost.content.split(/\s+/).filter(Boolean).length} palavras
                            </span>
                        </div>
                        <div className="p-6 prose prose-sm max-w-none max-h-[400px] overflow-y-auto">
                            <div dangerouslySetInnerHTML={{
                                __html: generatedPost.content
                                    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                                    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                                    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                    .replace(/\n/g, '<br />')
                            }} />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep(1)}>
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Voltar e Ajustar
                        </Button>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={handleGenerate}>
                                <Wand2 className="w-4 h-4 mr-2" />
                                Gerar Novamente
                            </Button>
                            <Button
                                onClick={handleSendToEditor}
                                className="bg-orange-500 hover:bg-orange-600"
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Enviar para Editor
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cover Image Modal */}
            {showImagePicker && generatedPost && (
                <CoverImageGenerator
                    title={generatedPost.title}
                    content={generatedPost.content}
                    onSelect={(url) => {
                        setCoverImageUrl(url)
                        setShowImagePicker(false)
                    }}
                    onClose={() => setShowImagePicker(false)}
                />
            )}
        </div>
    )
}
