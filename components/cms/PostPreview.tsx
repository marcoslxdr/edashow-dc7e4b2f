'use client'

import React from 'react'
import { Smartphone, Monitor, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PostPreviewProps {
    post: {
        title: string
        content: string
        excerpt: string
        cover_image_url: string
        category?: string
    }
    readingTime?: number
    wordCount?: number
}

export function PostPreview({ post, readingTime, wordCount }: PostPreviewProps) {
    const [viewMode, setViewMode] = React.useState<'mobile' | 'desktop'>('desktop')

    return (
        <div className="flex flex-col h-full">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-gray-900">Pré-visualização ao Vivo</h3>

                    {/* View Mode Toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('desktop')}
                            className={cn(
                                "p-1 rounded-md transition-all",
                                viewMode === 'desktop' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                            )}
                            title="Visualização Desktop"
                        >
                            <Monitor className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setViewMode('mobile')}
                            className={cn(
                                "p-1 rounded-md transition-all",
                                viewMode === 'mobile' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                            )}
                            title="Visualização Mobile"
                        >
                            <Smartphone className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Metrics Badge */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
                    <Clock className="w-3 h-3" />
                    <span className="font-medium">{readingTime || 1} min</span>
                </div>
            </div>

            {/* Content Preview Area */}
            <div className={cn(
                "flex-1 overflow-y-auto bg-gray-50 rounded-xl transition-all duration-300 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent",
                viewMode === 'desktop' ? "p-6" : "p-4"
            )}>
                <div className={cn(
                    "bg-white shadow-lg mx-auto transition-all duration-300 overflow-hidden",
                    viewMode === 'desktop'
                        ? "w-full rounded-xl"
                        : "w-[320px] rounded-[2rem] border-4 border-gray-300"
                )}>
                    {/* Fake Mobile Status Bar */}
                    {viewMode === 'mobile' && (
                        <div className="h-4 w-full bg-gray-100 flex justify-center items-center">
                            <div className="w-16 h-2 bg-gray-300 rounded-full" />
                        </div>
                    )}

                    {/* Article Content */}
                    <div className={cn(
                        "space-y-4",
                        viewMode === 'desktop' ? "p-6" : "p-4"
                    )}>
                        {/* Category Badge */}
                        {post.category && (
                            <div className="inline-block">
                                <span className="text-orange-500 font-bold text-xs uppercase tracking-wider">
                                    {post.category}
                                </span>
                            </div>
                        )}

                        {/* Title */}
                        <h1 className={cn(
                            "font-extrabold text-gray-900 leading-tight",
                            viewMode === 'desktop'
                                ? "text-2xl md:text-3xl"
                                : "text-lg"
                        )}>
                            {post.title || 'Título do Post'}
                        </h1>

                        {/* Excerpt */}
                        {post.excerpt && (
                            <p className={cn(
                                "text-slate-400 font-medium",
                                viewMode === 'desktop' ? "text-base" : "text-sm"
                            )}>
                                {post.excerpt}
                            </p>
                        )}

                        {/* Cover Image */}
                        {post.cover_image_url && (
                            <div className={cn(
                                "relative overflow-hidden bg-gray-100 border border-gray-200",
                                viewMode === 'desktop' ? "aspect-video rounded-xl" : "aspect-video rounded-lg"
                            )}>
                                <img
                                    src={post.cover_image_url}
                                    alt={post.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Content */}
                        <div
                            className={cn(
                                "prose prose-orange max-w-none tiptap-content",
                                viewMode === 'desktop'
                                    ? "prose-base"
                                    : "prose-sm"
                            )}
                            dangerouslySetInnerHTML={{
                                __html: post.content || '<p class="text-gray-400 italic text-sm">Comece a escrever para ver o conteúdo...</p>'
                            }}
                        />

                        {/* Reading Time & Word Count at bottom */}
                        {(readingTime || wordCount) && (
                            <div className="pt-4 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
                                {readingTime && (
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{readingTime} min de leitura</span>
                                    </div>
                                )}
                                {wordCount && (
                                    <>
                                        <span>•</span>
                                        <span>{wordCount} palavras</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
