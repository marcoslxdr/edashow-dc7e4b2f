'use client'

import React, { useState } from 'react'
import { Layers, Loader2, Check, X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { generateAIPost } from '@/lib/actions/ai-posts'
import { generateAICoverImage, getAICoverSuggestions } from '@/lib/actions/ai-images'

type BatchSize = 5 | 10 | 20
type JobStatus = 'pending' | 'generating' | 'saving' | 'done' | 'error'

interface BatchJob {
    topic: string
    status: JobStatus
    title?: string
    error?: string
}

export function BatchGenerateTab() {
    const [topicsText, setTopicsText] = useState('')
    const [batchSize, setBatchSize] = useState<BatchSize>(5)
    const [jobs, setJobs] = useState<BatchJob[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [isDone, setIsDone] = useState(false)

    const topicLines = topicsText
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0)

    const handleStart = async () => {
        const topics = topicLines.slice(0, batchSize)
        if (topics.length === 0) return

        const initialJobs: BatchJob[] = topics.map(topic => ({ topic, status: 'pending' }))
        setJobs(initialJobs)
        setIsRunning(true)
        setIsDone(false)

        for (let i = 0; i < initialJobs.length; i++) {
            setJobs(prev => {
                const updated = [...prev]
                updated[i] = { ...updated[i], status: 'generating' }
                return updated
            })

            try {
                const post = await generateAIPost({
                    topic: initialJobs[i].topic,
                    wordCount: 1000,
                    tone: 'professional',
                    autoCategorize: true
                })

                setJobs(prev => {
                    const updated = [...prev]
                    updated[i] = { ...updated[i], status: 'saving', title: post.title }
                    return updated
                })

                // Try to generate cover image with Gemini, fallback to Pexels
                let coverImageUrl: string | undefined
                try {
                    const geminiResult = await generateAICoverImage({
                        title: post.title,
                        content: post.content
                    })
                    if (geminiResult.url && !geminiResult.error) {
                        coverImageUrl = geminiResult.url
                    }
                } catch {
                    // Gemini failed, try Pexels as fallback
                }
                if (!coverImageUrl) {
                    try {
                        const imageResult = await getAICoverSuggestions({
                            title: post.title,
                            content: post.content,
                            count: 1
                        })
                        if (imageResult.images.length > 0) {
                            coverImageUrl = imageResult.images[0].url
                        }
                    } catch {
                        // Continue without image
                    }
                }

                const response = await fetch('/api/cms/posts/create-draft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...post, coverImageUrl })
                })

                if (!response.ok) throw new Error('Erro ao salvar post')

                setJobs(prev => {
                    const updated = [...prev]
                    updated[i] = { ...updated[i], status: 'done' }
                    return updated
                })
            } catch (err) {
                setJobs(prev => {
                    const updated = [...prev]
                    updated[i] = {
                        ...updated[i],
                        status: 'error',
                        error: err instanceof Error ? err.message : 'Erro desconhecido'
                    }
                    return updated
                })
            }
        }

        setIsRunning(false)
        setIsDone(true)
    }

    const completedCount = jobs.filter(j => j.status === 'done').length
    const errorCount = jobs.filter(j => j.status === 'error').length
    const activeCount = Math.min(topicLines.length, batchSize)

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Geração em Lote</h2>
                    <p className="text-sm text-gray-500">
                        Gere múltiplos artigos de uma vez — 1000 palavras cada, com imagem destacada
                    </p>
                </div>

                {/* Batch Size */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Quantidade de artigos
                    </label>
                    <div className="flex gap-3">
                        {([5, 10, 20] as BatchSize[]).map(size => (
                            <button
                                key={size}
                                onClick={() => setBatchSize(size)}
                                className={cn(
                                    "px-8 py-3 rounded-xl border-2 font-bold text-xl transition-all",
                                    batchSize === size
                                        ? "border-orange-500 bg-orange-50 text-orange-700"
                                        : "border-gray-200 text-gray-600 hover:border-orange-300"
                                )}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Topics Input */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Tópicos (um por linha)
                        </label>
                        <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            topicLines.length >= batchSize
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500"
                        )}>
                            {topicLines.length} / {batchSize}
                        </span>
                    </div>
                    <Textarea
                        value={topicsText}
                        onChange={(e) => setTopicsText(e.target.value)}
                        placeholder={`Ex:\nOs benefícios do clareamento dental\nComo escolher um plano de saúde\nPrimeiros socorros em casa\nTecnologia na medicina moderna`}
                        className="min-h-[180px] bg-gray-50 font-mono text-sm border-gray-200 focus:ring-orange-500"
                        disabled={isRunning}
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                        Serão gerados os primeiros {batchSize} tópicos da lista
                    </p>
                </div>

                <Button
                    onClick={handleStart}
                    disabled={isRunning || topicLines.length === 0}
                    className="bg-orange-500 hover:bg-orange-600 w-full h-12 text-base font-semibold"
                >
                    {isRunning ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Gerando... ({completedCount}/{activeCount})
                        </>
                    ) : (
                        <>
                            <Layers className="w-5 h-5 mr-2" />
                            Gerar {activeCount > 0 ? activeCount : batchSize} Artigos em Lote
                        </>
                    )}
                </Button>
            </div>

            {/* Jobs Progress */}
            {jobs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Progresso</h3>
                        {isDone && (
                            <span className="text-sm text-gray-500">
                                {completedCount} salvos · {errorCount} erros
                            </span>
                        )}
                    </div>

                    {/* Progress bar */}
                    {isRunning && (
                        <div className="mb-4">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-orange-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(completedCount / jobs.length) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2.5">
                        {jobs.map((job, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex items-center gap-3 p-3.5 rounded-lg border transition-colors",
                                    job.status === 'done' && "bg-green-50 border-green-200",
                                    job.status === 'error' && "bg-red-50 border-red-200",
                                    (job.status === 'generating' || job.status === 'saving') && "bg-orange-50 border-orange-200",
                                    job.status === 'pending' && "bg-gray-50 border-gray-200"
                                )}
                            >
                                <div className="w-7 h-7 flex items-center justify-center rounded-full shrink-0">
                                    {job.status === 'done' && (
                                        <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                                            <Check className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                    {job.status === 'error' && (
                                        <div className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center">
                                            <X className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                    {(job.status === 'generating' || job.status === 'saving') && (
                                        <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                                    )}
                                    {job.status === 'pending' && (
                                        <span className="text-sm font-medium text-gray-400">{i + 1}</span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {job.title || job.topic}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {job.status === 'pending' && 'Aguardando...'}
                                        {job.status === 'generating' && 'Gerando conteúdo com IA...'}
                                        {job.status === 'saving' && 'Gerando imagem e salvando...'}
                                        {job.status === 'done' && 'Salvo como rascunho ✓'}
                                        {job.status === 'error' && (job.error || 'Erro ao gerar')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isDone && completedCount > 0 && (
                        <div className="mt-5 pt-5 border-t border-gray-200">
                            <a
                                href="/cms/posts"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-semibold"
                            >
                                Ver {completedCount} Posts Gerados
                                <ChevronRight className="w-4 h-4" />
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
