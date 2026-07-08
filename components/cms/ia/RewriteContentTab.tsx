'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    RefreshCw,
    Loader2,
    Link2,
    FileText,
    Database,
    ArrowRight,
    Send,
    Copy,
    Check,
    AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { rewriteFromSource, fetchUrlContent, checkAIConfiguration } from '@/lib/actions/ai-posts'

type InputMode = 'url' | 'text' | 'post'
type ToneType = 'professional' | 'casual' | 'formal' | 'friendly'

interface Post {
    id: string
    title: string
    content: string
    excerpt?: string
}

interface RewrittenResult {
    title: string
    content: string
    excerpt: string
    originalLength: number
    newLength: number
    similarityEstimate: number
}

const toneOptions: Array<{ id: ToneType; label: string }> = [
    { id: 'professional', label: 'Profissional' },
    { id: 'casual', label: 'Casual' },
    { id: 'formal', label: 'Formal' },
    { id: 'friendly', label: 'Amigável' }
]

export function RewriteContentTab() {
    const router = useRouter()

    // State
    const [inputMode, setInputMode] = useState<InputMode>('url')
    const [url, setUrl] = useState('')
    const [text, setText] = useState('')
    const [selectedPostId, setSelectedPostId] = useState('')
    const [posts, setPosts] = useState<Post[]>([])

    const [tone, setTone] = useState<ToneType>('professional')
    const [keywords, setKeywords] = useState('')

    const [isLoading, setIsLoading] = useState(false)
    const [isFetchingUrl, setIsFetchingUrl] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [originalContent, setOriginalContent] = useState<{ title: string; content: string } | null>(null)
    const [rewrittenContent, setRewrittenContent] = useState<RewrittenResult | null>(null)
    const [copied, setCopied] = useState(false)

    // Fetch posts for dropdown
    useEffect(() => {
        async function loadPosts() {
            try {
                const response = await fetch('/api/posts?limit=50')
                if (response.ok) {
                    const data = await response.json()
                    setPosts(data.posts || [])
                }
            } catch {
                // Silently fail - posts dropdown is optional
            }
        }
        loadPosts()
    }, [])

    // Fetch URL content
    const handleFetchUrl = async () => {
        if (!url.trim()) return

        setIsFetchingUrl(true)
        setError(null)

        try {
            const result = await fetchUrlContent(url)

            if (!result.success) {
                setError(result.error || 'Erro ao buscar conteúdo da URL')
                return
            }

            setOriginalContent({
                title: result.title,
                content: result.content
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar URL')
        } finally {
            setIsFetchingUrl(false)
        }
    }

    // Handle post selection
    const handlePostSelect = (postId: string) => {
        setSelectedPostId(postId)
        const post = posts.find(p => p.id === postId)
        if (post) {
            setOriginalContent({
                title: post.title,
                content: post.content
            })
        }
    }

    // Handle text input
    const handleTextInput = (value: string) => {
        setText(value)
        if (value.trim()) {
            setOriginalContent({
                title: 'Conteúdo Colado',
                content: value
            })
        } else {
            setOriginalContent(null)
        }
    }

    // Rewrite content
    const handleRewrite = async () => {
        if (!originalContent?.content) {
            setError('Nenhum conteúdo para reescrever')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const config = await checkAIConfiguration()
            if (!config.configured) {
                setError('API de IA não configurada. Configure OPENCODE_API_KEY.')
                return
            }

            const result = await rewriteFromSource({
                sourceContent: originalContent.content,
                sourceUrl: inputMode === 'url' ? url : undefined,
                keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
                tone
            })

            setRewrittenContent(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao reescrever conteúdo')
        } finally {
            setIsLoading(false)
        }
    }

    // Copy to clipboard
    const handleCopy = async () => {
        if (!rewrittenContent) return

        const textToCopy = `# ${rewrittenContent.title}\n\n${rewrittenContent.content}`
        await navigator.clipboard.writeText(textToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Send to editor
    const handleSendToEditor = () => {
        if (!rewrittenContent) return

        const post = {
            title: rewrittenContent.title,
            excerpt: rewrittenContent.excerpt,
            content: rewrittenContent.content,
            slug: rewrittenContent.title
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
        }

        sessionStorage.setItem('ai_generated_post', JSON.stringify(post))
        router.push('/cms/posts/new?fromAI=true')
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Input Mode Selection */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Fonte do conteúdo</h2>
                <div className="flex gap-3 mb-6">
                    <button
                        onClick={() => {
                            setInputMode('url')
                            setOriginalContent(null)
                            setRewrittenContent(null)
                        }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                            inputMode === 'url'
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        <Link2 className="w-4 h-4" />
                        URL
                    </button>
                    <button
                        onClick={() => {
                            setInputMode('text')
                            setOriginalContent(null)
                            setRewrittenContent(null)
                        }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                            inputMode === 'text'
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        <FileText className="w-4 h-4" />
                        Texto
                    </button>
                    <button
                        onClick={() => {
                            setInputMode('post')
                            setOriginalContent(null)
                            setRewrittenContent(null)
                        }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                            inputMode === 'post'
                                ? "bg-orange-500 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        <Database className="w-4 h-4" />
                        Post Existente
                    </button>
                </div>

                {/* URL Input */}
                {inputMode === 'url' && (
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <Input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://exemplo.com/artigo"
                                className="flex-1 bg-gray-50 border-gray-200 focus:bg-white focus:ring-orange-500"
                            />
                            <Button
                                onClick={handleFetchUrl}
                                disabled={!url.trim() || isFetchingUrl}
                                className="bg-orange-500 hover:bg-orange-600"
                            >
                                {isFetchingUrl ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Link2 className="w-4 h-4 mr-2" />
                                        Buscar
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Text Input */}
                {inputMode === 'text' && (
                    <Textarea
                        value={text}
                        onChange={(e) => handleTextInput(e.target.value)}
                        placeholder="Cole o conteúdo que deseja reescrever..."
                        className="min-h-[200px] bg-gray-50 border-gray-200 focus:bg-white focus:ring-orange-500"
                    />
                )}

                {/* Post Selector */}
                {inputMode === 'post' && (
                    <select
                        value={selectedPostId}
                        onChange={(e) => handlePostSelect(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                        <option value="">Selecione um post...</option>
                        {posts.map((post) => (
                            <option key={post.id} value={post.id}>
                                {post.title}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Configuration & Content Display */}
            {originalContent && (
                <>
                    {/* Configuration */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Configurações de Reescrita</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tom de voz</label>
                                <div className="flex gap-2">
                                    {toneOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => setTone(option.id)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                                tone === option.id
                                                    ? "bg-orange-500 text-white"
                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Palavras-chave (opcional)
                                </label>
                                <Input
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    placeholder="Separadas por vírgula..."
                                    className="bg-gray-50 border-gray-200 focus:bg-white focus:ring-orange-500"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button
                                onClick={handleRewrite}
                                disabled={isLoading}
                                className="bg-orange-500 hover:bg-orange-600"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                )}
                                Reescrever
                            </Button>
                        </div>
                    </div>

                    {/* Side by Side Comparison */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Original */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                                <h3 className="font-semibold text-gray-900">Original</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {originalContent.content.length.toLocaleString()} caracteres
                                </p>
                            </div>
                            <div className="p-6 max-h-[500px] overflow-y-auto">
                                <h4 className="font-medium text-gray-900 mb-3">{originalContent.title}</h4>
                                <div className="text-sm text-gray-600 whitespace-pre-wrap">
                                    {originalContent.content.substring(0, 2000)}
                                    {originalContent.content.length > 2000 && '...'}
                                </div>
                            </div>
                        </div>

                        {/* Rewritten */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Reescrito</h3>
                                        {rewrittenContent && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                {rewrittenContent.newLength.toLocaleString()} caracteres
                                            </p>
                                        )}
                                    </div>
                                    {rewrittenContent && (
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                                {copied ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 max-h-[500px] overflow-y-auto">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
                                        <p className="text-sm text-gray-500">Reescrevendo conteúdo...</p>
                                    </div>
                                ) : rewrittenContent ? (
                                    <>
                                        <h4 className="font-medium text-gray-900 mb-2">{rewrittenContent.title}</h4>
                                        <p className="text-sm text-orange-600 mb-4 italic">{rewrittenContent.excerpt}</p>
                                        <div className="text-sm text-gray-600 whitespace-pre-wrap">
                                            {rewrittenContent.content}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                        <ArrowRight className="w-8 h-8 mb-3" />
                                        <p className="text-sm">Clique em "Reescrever" para começar</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {rewrittenContent && (
                        <div className="mt-6 flex justify-end">
                            <Button
                                onClick={handleSendToEditor}
                                className="bg-orange-500 hover:bg-orange-600"
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Enviar para Editor
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
