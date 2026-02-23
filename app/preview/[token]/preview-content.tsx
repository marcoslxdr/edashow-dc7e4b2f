'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Calendar, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PostSidebar } from '@/components/post-sidebar'
import { normalizePostContent } from '@/lib/utils/post-content'
import { submitPreviewReview } from '@/lib/actions/cms-preview'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface PreviewContentProps {
    post: any
    tokenData: any
    token: string
    sponsors: any[]
}

export function PreviewContent({ post, tokenData, token, sponsors }: PreviewContentProps) {
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
    const dateToShow = post.published_at || post.created_at

    return (
        <div className="min-h-screen bg-background pb-[160px]">
            {/* Top Preview Banner */}
            <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 shadow-sm">
                <div className="container mx-auto px-4 py-2.5 flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-sm font-medium text-amber-800">
                        Preview do rascunho &mdash; Este conteúdo ainda não foi publicado
                    </span>
                </div>
            </div>

            {/* Hero Header com Imagem Destacada - Identico ao site real */}
            {post.featured_image ? (
                <section className="relative w-full h-[60vh] min-h-[400px] overflow-hidden">
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={post.featured_image.url}
                            alt={post.featured_image.alt_text || post.title}
                            fill
                            className="object-cover"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-black/20" />
                    </div>

                    <div className="container relative z-10 h-full mx-auto px-4 flex flex-col justify-end pb-12">
                        <div className="max-w-4xl">
                            {/* Categorias */}
                            <div className="flex items-center gap-2 mb-6">
                                {post.category && (
                                    <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-semibold uppercase tracking-wider">
                                        {post.category.name}
                                    </span>
                                )}
                            </div>

                            {/* Titulo Principal */}
                            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight shadow-text">
                                {post.title}
                            </h1>

                            {/* Meta informacoes */}
                            <div className="flex flex-wrap items-center gap-6 text-slate-200">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border-none">
                                        {isRedacao ? (
                                            <AvatarImage src="/images/eda-redacao.png" alt={authorName} className="object-cover" />
                                        ) : post.author?.photo_url ? (
                                            <AvatarImage src={post.author.photo_url} alt={authorName} className="object-cover" />
                                        ) : (
                                            <AvatarFallback>
                                                {authorName.charAt(0)}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                    <span className="font-medium text-white">{authorName}</span>
                                </div>

                                {dateToShow && (
                                    <div className="flex items-center gap-2 text-sm opacity-90">
                                        <Calendar className="h-4 w-4" />
                                        <time dateTime={dateToShow}>
                                            {format(new Date(dateToShow), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                        </time>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            ) : (
                /* Header Fallback (sem imagem) */
                <header className="container mx-auto px-4 py-12">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center gap-2 mb-4">
                            {post.category && (
                                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                                    {post.category.name}
                                </span>
                            )}
                        </div>

                        <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-slate-900">
                            {post.title}
                        </h1>

                        {post.excerpt && (
                            <p className="text-xl text-slate-600 mb-6 leading-relaxed">
                                {post.excerpt}
                            </p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-slate-500">
                            {dateToShow && (
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <time dateTime={dateToShow}>
                                        {format(new Date(dateToShow), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                    </time>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
            )}

            {/* Grid Layout: Conteudo Principal + Sidebar */}
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Coluna Principal */}
                    <article className="lg:col-span-8">
                        {/* Resumo do Post */}
                        {post.featured_image && post.excerpt && (
                            <p className="text-xl text-slate-700 leading-relaxed font-serif mb-8 whitespace-pre-line">
                                {post.excerpt}
                            </p>
                        )}

                        {/* Conteudo do Artigo */}
                        <div
                            className="prose prose-lg max-w-none mb-8 tiptap-content"
                            dangerouslySetInnerHTML={{ __html: normalizePostContent(post.content || '') }}
                        />

                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                            <div className="mb-8 pt-8 border-t border-slate-200">
                                <div className="flex items-center gap-2 mb-4">
                                    <Tag className="h-5 w-5 text-slate-600" />
                                    <h3 className="font-semibold text-slate-900">Tags</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {post.tags.map((tag: string, index: number) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Informacoes do Autor */}
                        {post.author && (
                            <div className="border-t border-slate-200 pt-8 mt-8">
                                <h3 className="text-2xl font-bold mb-6 text-slate-900">Sobre o Autor</h3>
                                <div className="flex gap-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
                                    <Avatar className="h-24 w-24 shrink-0">
                                        {isRedacao ? (
                                            <AvatarImage src="/images/eda-redacao.png" alt={authorName} className="object-cover" />
                                        ) : post.author.photo_url ? (
                                            <AvatarImage
                                                src={post.author.photo_url}
                                                alt={authorName}
                                                className="object-cover"
                                            />
                                        ) : (
                                            <AvatarImage
                                                src="/images/eda-redacao.png"
                                                alt="EDA Show Logo"
                                                className="object-cover"
                                            />
                                        )}
                                        <AvatarFallback className="bg-white">
                                            <Image
                                                src="/images/eda-redacao.png"
                                                alt="EDA Show Logo"
                                                width={80}
                                                height={80}
                                                className="object-contain p-2"
                                            />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="font-bold text-xl text-slate-900 mb-1">{authorName}</p>
                                        <p className="text-sm text-slate-700 leading-relaxed mb-4">{post.author.bio}</p>
                                        <div className="flex gap-4 pt-2 border-t border-slate-200">
                                            {post.author.twitter_url && (
                                                <a
                                                    href={post.author.twitter_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-primary hover:text-primary/80 font-medium hover:underline transition-colors"
                                                >
                                                    Twitter
                                                </a>
                                            )}
                                            {post.author.instagram_url && (
                                                <a
                                                    href={post.author.instagram_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-primary hover:text-primary/80 font-medium hover:underline transition-colors"
                                                >
                                                    Instagram
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </article>

                    {/* Sidebar */}
                    <aside className="lg:col-span-4">
                        <div className="sticky top-16">
                            <PostSidebar sponsors={sponsors} />
                        </div>
                    </aside>
                </div>
            </div>

            {/* Bottom Review Bar - Fixed */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
                {/* Already reviewed */}
                {(alreadyReviewed || reviewResult) && (
                    <div className="container mx-auto px-4 py-5">
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
                            <div className="container mx-auto px-4 py-4">
                                <div className="flex gap-3 max-w-xl mx-auto">
                                    <Button
                                        onClick={() => handleReview('rejected')}
                                        disabled={isSubmitting}
                                        variant="outline"
                                        className="flex-1 min-h-[48px] text-base font-medium text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <XCircle className="w-5 h-5 mr-2" />
                                        Rejeitar
                                    </Button>
                                    <Button
                                        onClick={() => setShowReviewPanel(true)}
                                        className="flex-1 min-h-[48px] text-base font-medium bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        <CheckCircle2 className="w-5 h-5 mr-2" />
                                        Aprovar e Publicar
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="container mx-auto px-4 py-4">
                                <div className="max-w-xl mx-auto space-y-3">
                                    <p className="text-sm font-medium text-slate-700">
                                        Confirmar aprovação e publicação
                                    </p>
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
                                            onClick={() => setShowReviewPanel(false)}
                                            variant="outline"
                                            className="flex-1 min-h-[44px]"
                                        >
                                            Cancelar
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
                                                    Confirmar Publicação
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
