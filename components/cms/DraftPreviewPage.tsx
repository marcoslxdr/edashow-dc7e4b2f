'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PostSidebar } from '@/components/post-sidebar'
import BannerDisplay from '@/components/BannerDisplay'
import { SocialShare } from '@/components/social-share'
import { normalizePostContent } from '@/lib/utils/post-content'
import { publishPost } from '@/lib/actions/cms-posts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    ArrowLeft,
    Calendar,
    Tag,
    Send,
    Loader2,
    Check,
    Copy,
    ExternalLink,
    Eye,
    ArrowRight
} from 'lucide-react'

interface DraftPreviewPageProps {
    post: any
    sponsors: any[]
}

export function DraftPreviewPage({ post, sponsors }: DraftPreviewPageProps) {
    const router = useRouter()
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishedSlug, setPublishedSlug] = useState<string | null>(
        post.status === 'published' ? post.slug : null
    )
    const [copied, setCopied] = useState(false)

    const siteUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || ''

    const handlePublish = async () => {
        if (isPublishing) return
        setIsPublishing(true)
        try {
            const result = await publishPost(post.id)
            setPublishedSlug(result.slug)
        } catch (error: any) {
            console.error('Erro ao publicar:', error)
            alert(`Erro ao publicar: ${error?.message || 'Erro desconhecido'}`)
        } finally {
            setIsPublishing(false)
        }
    }

    const handleCopyLink = () => {
        if (!publishedSlug) return
        const url = `${siteUrl}/posts/${publishedSlug}`
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const isPublished = !!publishedSlug

    return (
        <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto">
            {/* Barra de acao flutuante */}
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    {/* Esquerda: Badge + Voltar */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/cms/posts/${post.id}`)}
                            className="gap-2 text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Voltar ao editor</span>
                        </Button>

                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-orange-500" />
                            {isPublished ? (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Publicado
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold uppercase tracking-wider">
                                    Rascunho - Preview
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Direita: Acoes */}
                    <div className="flex items-center gap-2">
                        {isPublished ? (
                            <>
                                {/* Link publicado */}
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border text-sm text-gray-600">
                                    <span className="max-w-[200px] truncate">/posts/{publishedSlug}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyLink}
                                    className="gap-2"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4 text-green-600" />
                                            <span className="hidden sm:inline">Copiado!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            <span className="hidden sm:inline">Copiar link</span>
                                        </>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => window.open(`/posts/${publishedSlug}`, '_blank')}
                                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span className="hidden sm:inline">Abrir post</span>
                                </Button>
                            </>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
                            >
                                {isPublishing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Publicando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Publicar</span>
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Conteudo do post - replica o layout de app/posts/[slug]/page.tsx */}
            <div className="min-h-screen bg-background">
                {/* Hero Header com Imagem Destacada */}
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
                                <Link href="/" className="inline-block mb-8">
                                    <Button variant="ghost" className="text-white hover:bg-white/10 gap-2 pl-0">
                                        <ArrowLeft className="h-4 w-4" />
                                        Voltar
                                    </Button>
                                </Link>

                                <div className="flex items-center gap-2 mb-6">
                                    {post.category && (
                                        <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-semibold uppercase tracking-wider">
                                            {post.category.title || post.category.name}
                                        </span>
                                    )}
                                    {post.featured_home && (
                                        <span className="px-3 py-1 bg-yellow-400 text-yellow-950 rounded-full text-sm font-bold">
                                            DESTAQUE
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight shadow-text">
                                    {post.title}
                                </h1>

                                <div className="flex flex-wrap items-center gap-6 text-slate-200">
                                    {post.author && (
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border-none">
                                                {(post.author.name?.includes('Redacao') || post.author.name?.includes('Redacao')) ? (
                                                    <AvatarImage src="/images/eda-redacao.png" alt={post.author.name} className="object-cover" />
                                                ) : post.author.photo_url ? (
                                                    <AvatarImage src={post.author.photo_url} alt={post.author.name} className="object-cover" />
                                                ) : (
                                                    <AvatarFallback>
                                                        {post.author.name?.charAt(0) || 'E'}
                                                    </AvatarFallback>
                                                )}
                                            </Avatar>
                                            <span className="font-medium text-white">{post.author.name}</span>
                                        </div>
                                    )}

                                    {post.published_at && (
                                        <div className="flex items-center gap-2 text-sm opacity-90">
                                            <Calendar className="h-4 w-4" />
                                            <time dateTime={post.published_at}>
                                                {format(new Date(post.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                            </time>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                ) : (
                    <header className="container mx-auto px-4 py-12">
                        <div className="max-w-4xl mx-auto">
                            <Link href="/" className="inline-block mb-8">
                                <Button variant="ghost" className="gap-2 pl-0">
                                    <ArrowLeft className="h-4 w-4" />
                                    Voltar
                                </Button>
                            </Link>

                            <div className="flex items-center gap-2 mb-4">
                                {post.category && (
                                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                                        {post.category.title || post.category.name}
                                    </span>
                                )}
                                {post.featured_home && (
                                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                        Destaque
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
                                {post.published_at && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <time dateTime={post.published_at}>
                                            {format(new Date(post.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
                        {/* Coluna Principal - Conteudo do Artigo */}
                        <article className="lg:col-span-8">
                            {/* Banner Publicitario - Topo do Artigo */}
                            <div className="mb-8">
                                <BannerDisplay location="article_top" />
                            </div>

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

                            {/* Banner In-Article */}
                            <div className="my-12">
                                <BannerDisplay location="article_content" />
                            </div>

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
                                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Compartilhamento Social */}
                            <SocialShare
                                url={`/posts/${post.slug}`}
                                title={post.title}
                                description={post.excerpt}
                            />

                            {/* Informacoes do Autor */}
                            {post.author && (
                                <div className="border-t border-slate-200 pt-8 mt-8">
                                    <h3 className="text-2xl font-bold mb-6 text-slate-900">Sobre o Autor</h3>
                                    <div className="flex gap-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
                                        <Avatar className="h-24 w-24 shrink-0">
                                            {(post.author.name?.includes('Redacao') || post.author.name?.includes('Redacao')) ? (
                                                <AvatarImage src="/images/eda-redacao.png" alt={post.author.name} className="object-cover" />
                                            ) : post.author.photo_url ? (
                                                <AvatarImage
                                                    src={post.author.photo_url}
                                                    alt={post.author.name}
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
                                            <p className="font-bold text-xl text-slate-900 mb-1">{post.author.name}</p>
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
                            <div className="sticky top-6">
                                <PostSidebar sponsors={sponsors} />
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    )
}
