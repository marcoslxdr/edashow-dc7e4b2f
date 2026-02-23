'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { submitPreviewReview } from '@/lib/actions/cms-preview'

function normalizePostContent(html: string): string {
    if (!html) return ''
    let content = html.trim()
    content = content.replace(/<\/?blockquote[^>]*>/gi, '')
    content = content.trim()
    if (!content) return ''
    if (!content.includes('<p>') && !content.includes('<h1>') && !content.includes('<h2>') &&
        !content.includes('<h3>') && !content.includes('<ul>') && !content.includes('<ol>')) {
        const paragraphs = content
            .split(/\n\n+/)
            .filter(p => p.trim())
            .map(p => `<p>${p.trim()}</p>`)
            .join('\n')
        return paragraphs
    }
    return content
}

interface PreviewContentProps {
    post: any
    tokenData: any
    token: string
}

export function PreviewContent({ post, tokenData, token }: PreviewContentProps) {
    const [showReviewPanel, setShowReviewPanel] = useState(false)
    const [comment, setComment] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [reviewResult, setReviewResult] = useState<'approved' | 'rejected' | null>(
        tokenData.status !== 'pending' ? tokenData.status : null
    )
    const [error, setError] = useState('')

    const alreadyReviewed = tokenData.status !== 'pending'

    const handleReview = async (decision: 'approved' | 'rejected') => {
        setIsSubmitting(true)
        setError('')
        try {
            await submitPreviewReview(token, decision, comment || undefined)
            setReviewResult(decision)
            setShowReviewPanel(false)
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar revisão.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const authorName = post.author?.name || 'Redação'
    const isRedacao = authorName.includes('Redação') || authorName.includes('Redacao')

    return (
        <div className="min-h-screen bg-white pb-[200px]">
            {/* Top Preview Banner */}
            <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200">
                <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-sm font-medium text-amber-800">
                        Preview do rascunho &mdash; Este conteúdo ainda não foi publicado
                    </span>
                </div>
            </div>

            {/* Cover Image */}
            {post.featured_image && (
                <div className="relative w-full aspect-video max-h-[500px] overflow-hidden">
                    <Image
                        src={post.featured_image.url}
                        alt={post.featured_image.alt_text || post.title}
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                </div>
            )}

            {/* Post Content */}
            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Category */}
                {post.category && (
                    <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-4">
                        {post.category.name}
                    </span>
                )}

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-4">
                    {post.title}
                </h1>

                {/* Excerpt */}
                {post.excerpt && (
                    <p className="text-lg text-slate-600 leading-relaxed font-serif mb-6">
                        {post.excerpt}
                    </p>
                )}

                {/* Author */}
                <div className="flex items-center gap-3 mb-8 pb-8 border-b border-slate-200">
                    <Avatar className="h-10 w-10">
                        {isRedacao ? (
                            <AvatarImage src="/images/eda-redacao.png" alt={authorName} />
                        ) : post.author?.photo_url ? (
                            <AvatarImage src={post.author.photo_url} alt={authorName} />
                        ) : (
                            <AvatarImage src="/images/eda-redacao.png" alt="EDA Show Logo" />
                        )}
                        <AvatarFallback>{authorName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-slate-900">{authorName}</p>
                        <p className="text-sm text-slate-500">Rascunho</p>
                    </div>
                </div>

                {/* Content */}
                <div
                    className="prose prose-lg max-w-none mb-8 tiptap-content"
                    dangerouslySetInnerHTML={{ __html: normalizePostContent(post.content || '') }}
                />

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-slate-200">
                        {post.tags.map((tag: string) => (
                            <span
                                key={tag}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Review Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
                {/* Already reviewed */}
                {(alreadyReviewed || reviewResult) && (
                    <div className="max-w-3xl mx-auto px-4 py-5">
                        <div className={`flex items-center justify-center gap-3 p-4 rounded-xl ${
                            (reviewResult || tokenData.status) === 'approved'
                                ? 'bg-green-50 text-green-800'
                                : 'bg-red-50 text-red-800'
                        }`}>
                            {(reviewResult || tokenData.status) === 'approved' ? (
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            ) : (
                                <XCircle className="w-6 h-6 text-red-600" />
                            )}
                            <div className="text-center">
                                <p className="font-semibold">
                                    {(reviewResult || tokenData.status) === 'approved'
                                        ? 'Post aprovado e publicado!'
                                        : 'Post rejeitado'}
                                </p>
                                {alreadyReviewed && tokenData.reviewer_name && (
                                    <p className="text-sm opacity-80">
                                        por {tokenData.reviewer_name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Review panel */}
                {!alreadyReviewed && !reviewResult && (
                    <>
                        {!showReviewPanel ? (
                            <div className="max-w-3xl mx-auto px-4 py-4">
                                <Button
                                    onClick={() => setShowReviewPanel(true)}
                                    className="w-full min-h-[44px] text-base font-medium"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Revisar este post
                                </Button>
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
                                {/* Comment field */}
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Comentário (opcional)"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                    rows={2}
                                />

                                {error && (
                                    <p className="text-sm text-red-600">{error}</p>
                                )}

                                {/* Action buttons */}
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => handleReview('rejected')}
                                        disabled={isSubmitting}
                                        variant="outline"
                                        className="flex-1 min-h-[44px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <XCircle className="w-4 h-4 mr-2" />
                                                Rejeitar
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() => handleReview('approved')}
                                        disabled={isSubmitting}
                                        className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Aprovar
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
