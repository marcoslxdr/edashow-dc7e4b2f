import { getPostBySlug, getPostBySlugAnyStatus, getImageUrl, getSponsors } from '@/lib/supabase/api'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizePostContent } from '@/lib/utils/post-content'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Tag, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PostSidebar } from '@/components/post-sidebar'
import BannerDisplay from '@/components/BannerDisplay'
import { PostImageGallery } from '@/components/post-image-gallery'
import { RelatedPosts } from '@/components/related-posts'
import { SocialShare } from '@/components/social-share'
import { MobileQuickShare } from '@/components/mobile-quick-share'
import { DraftPreviewBanner } from '@/components/DraftPreviewBanner'

// Força renderização dinâmica para evitar erros de serialização durante build
export const dynamic = 'force-dynamic'
export const dynamicParams = true

/**
 * Extrai o ID de um vídeo do YouTube a partir de uma URL
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Converte URLs do YouTube em embeds responsivos
 */
function embedYouTubeLinks(html: string): string {
  // Match YouTube URLs that are standalone (in their own <p> tag or as plain text on a line)
  // Pattern 1: URLs inside <a> tags within <p> tags
  html = html.replace(
    /<p[^>]*>\s*<a[^>]*href=["'](https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[^"']+)["'][^>]*>[^<]*<\/a>\s*<\/p>/gi,
    (match, url) => {
      const videoId = extractYouTubeId(url)
      if (videoId) {
        return `<div class="youtube-embed"><iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
      }
      return match
    }
  )

  // Pattern 2: Plain YouTube URLs inside <p> tags (not wrapped in <a>)
  html = html.replace(
    /<p[^>]*>\s*(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[^\s<]+)\s*<\/p>/gi,
    (match, url) => {
      const videoId = extractYouTubeId(url)
      if (videoId) {
        return `<div class="youtube-embed"><iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
      }
      return match
    }
  )

  // Pattern 3: Plain YouTube URLs that are standalone text (not in HTML tags)
  html = html.replace(
    /(?:^|\n)\s*(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[^\s<\n]+)\s*(?:\n|$)/gi,
    (match, url) => {
      const videoId = extractYouTubeId(url)
      if (videoId) {
        return `\n<div class="youtube-embed"><iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>\n`
      }
      return match
    }
  )

  return html
}

/**
 * Converte texto com formatação simples (markdown-like) para HTML
 */
function convertMarkdownToHtml(text: string): string {
  let content = text

  // Bold: **text** ou __text__
  content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  content = content.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Italic: *text* ou _text_ (somente quando delimitado por espaço ou início/fim de linha)
  content = content.replace(/(^|\s)\*([^\s*](?:[^*]*[^\s*])?)\*(\s|$)/gm, '$1<em>$2</em>$3')
  content = content.replace(/(^|\s)_([^\s_](?:[^_]*[^\s_])?)_(\s|$)/gm, '$1<em>$2</em>$3')

  // Strikethrough: ~~text~~
  content = content.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Inline code: `code`
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Headings: # ## ###
  content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Horizontal rules: --- or ***
  content = content.replace(/^(?:---|\*\*\*|___)$/gm, '<hr />')

  // Blockquotes: > text
  content = content.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
  // Merge consecutive blockquotes
  content = content.replace(/<\/blockquote>\n<blockquote>/g, '\n')

  // Unordered lists: - item or • item or * item (at start of line)
  content = content.replace(/^(?:[•\-\*])\s+(.+)$/gm, '<li>$1</li>')
  content = content.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  // Links: [text](url)
  content = content.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // Convert plain URLs to links (skip if already inside HTML tags)
  content = content.replace(
    /(^|[\s>])(https?:\/\/[^\s<>"]+)/gm,
    (match, prefix, url) => {
      // Skip if this URL is already inside an href or src attribute
      if (prefix === '"' || prefix === "'") return match
      return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    }
  )

  return content
}

/**
 * Normaliza o HTML do conteúdo do post
 * Suporta conteúdo HTML do TipTap, markdown e texto simples
 * Embeds automáticos do YouTube
 */
function normalizePostContent(html: string): string {
  if (!html) return ''

  let content = html.trim()
  if (!content) return ''

  // Detecta se o conteúdo é predominantemente HTML (do TipTap) ou texto simples/markdown
  const hasHtmlTags = /<(?:p|h[1-6]|ul|ol|div|blockquote|pre|table|figure)[^>]*>/i.test(content)

  if (!hasHtmlTags) {
    // Conteúdo é texto simples ou markdown - converter para HTML
    content = convertMarkdownToHtml(content)

    // Envolve linhas soltas em parágrafos (que não são já tags HTML)
    const lines = content.split(/\n\n+/)
    content = lines
      .map(line => {
        const trimmed = line.trim()
        if (!trimmed) return ''
        // Se já é uma tag de bloco, não envolve em <p>
        if (/^<(?:h[1-6]|ul|ol|li|blockquote|div|hr|pre|table|figure)[\s>]/i.test(trimmed)) {
          return trimmed
        }
        // Converte quebras de linha simples em <br>
        const withBreaks = trimmed.replace(/\n/g, '<br />')
        return `<p>${withBreaks}</p>`
      })
      .filter(Boolean)
      .join('\n')
  } else {
    // Conteúdo HTML - aplicar conversão markdown dentro de parágrafos para conteúdo misto
    // (ex: texto com **bold** dentro de tags <p>)
    content = content.replace(
      /(<p[^>]*>)(.*?)(<\/p>)/gs,
      (match, open, inner, close) => {
        let processed = inner
        processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>')
        processed = processed.replace(/(^|\s)\*([^\s*](?:[^*]*[^\s*])?)\*(\s|$)/gm, '$1<em>$2</em>$3')
        processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>')
        return `${open}${processed}${close}`
      }
    )
  }

  // Embed YouTube links
  content = embedYouTubeLinks(content)

  return content
}

interface PostPageProps {
  params: Promise<{
    slug: string
  }>
}

/**
 * Verifica se o usuário atual é admin/editor autenticado.
 */
async function isAuthenticatedEditor(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    return !!roleData && (roleData.role === 'admin' || roleData.role === 'editor')
  } catch {
    return false
  }
}

// Metadados da página
export async function generateMetadata({ params }: PostPageProps) {
  const { slug } = await params
  let post = await getPostBySlug(slug)

  // Se não encontrou publicado, tenta buscar rascunho para editor
  if (!post) {
    const isEditor = await isAuthenticatedEditor()
    if (isEditor) {
      post = await getPostBySlugAnyStatus(slug)
    }
  }

  if (!post) {
    return {
      title: 'Post não encontrado',
    }
  }

  // Rascunhos não devem ser indexados
  if (post.status !== 'published') {
    return {
      title: `[Rascunho] ${post.title} | EdaShow`,
      robots: { index: false, follow: false },
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://edashow.com.br'
  const postUrl = `${siteUrl}/posts/${slug}`

  // Usa a imagem destacada do post, ou a imagem de capa, ou o logo padrão
  const imageUrl = post.featured_image?.url ||
    post.cover_image_url ||
    '/placeholder-logo.svg'

  return {
    metadataBase: new URL(siteUrl),
    title: `${post.title} | EdaShow`,
    description: post.excerpt || 'Leia mais no EdaShow',
    openGraph: {
      type: 'article',
      locale: 'pt_BR',
      url: postUrl,
      title: post.title,
      description: post.excerpt || 'Leia mais no EdaShow',
      siteName: 'EDA.Show',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt || 'Leia mais no EdaShow',
      images: [imageUrl],
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params
  let post = await getPostBySlug(slug)
  let isDraftPreview = false

  // Se não encontrou post publicado, tenta buscar rascunho para editores
  if (!post) {
    const isEditor = await isAuthenticatedEditor()
    if (isEditor) {
      post = await getPostBySlugAnyStatus(slug)
      if (post && post.status !== 'published') {
        isDraftPreview = true
      }
    }
  }

  if (!post) {
    notFound()
  }

  // Buscar patrocinadores ativos
  const sponsors = await getSponsors({
    active: true
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Banner de preview de rascunho */}
      {isDraftPreview && <DraftPreviewBanner postId={post.id} postSlug={slug} />}

      {/* Hero Header com Imagem Destacada */}
      {post.featured_image ? (
        <section className="relative w-full h-[60vh] min-h-[400px] overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <Image
              src={post.featured_image.url}
              alt={post.featured_image.alt_text || post.title}
              fill
              className="object-cover"
              priority
            />
            {/* Overlay Gradiente */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-black/20" />
          </div>

          <div className="container relative z-10 h-full mx-auto px-4 flex flex-col justify-end pb-12">
            <div className="max-w-4xl">
              {/* Botão Voltar (Estilo Light) */}
              <Link href="/" className="inline-block mb-8">
                <Button variant="ghost" className="text-white hover:bg-white/10 gap-2 pl-0">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </Link>

              {/* Categorias e Tags */}
              <div className="flex items-center gap-2 mb-6">
                {post.category && (
                  <span className="px-3 py-1 bg-primary text-white rounded-full text-sm font-semibold uppercase tracking-wider">
                    {post.category.title}
                  </span>
                )}
                {post.featured && (
                  <span className="px-3 py-1 bg-yellow-400 text-yellow-950 rounded-full text-sm font-bold">
                    ⭐ DESTAQUE
                  </span>
                )}
              </div>

              {/* Título Principal */}
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight shadow-text">
                {post.title}
              </h1>

              {/* Meta informações do Header */}
              <div className="flex flex-wrap items-center gap-6 text-slate-200">
                {post.author && (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-none">
                      {(post.author.name?.includes('Redação') || post.author.name?.includes('Redacao')) ? (
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
        /* Header Fallback (sem imagem) */
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
                  {post.category.title}
                </span>
              )}
              {post.featured && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  ⭐ Destaque
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

      {/* Grid Layout: Conteúdo Principal + Sidebar */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Coluna Principal - Conteúdo do Artigo */}
          <article className="lg:col-span-8">
            {/* Banner Publicitário - Topo do Artigo */}
            <div className="mb-8">
              <BannerDisplay location="article_top" />
            </div>

            {/* Resumo do Post (apenas se tiver imagem de capa, se não tiver, já aparece no header fallback) */}
            {post.featured_image && post.excerpt && (
              <p className="text-xl text-slate-700 leading-relaxed font-serif mb-8 whitespace-pre-line">
                {post.excerpt}
              </p>
            )}

            {/* Conteúdo do Artigo */}
            <div
              className="prose prose-lg max-w-none mb-8 tiptap-content"
              dangerouslySetInnerHTML={{ __html: normalizePostContent(post.content || '') }}
            />

            {/* Banner In-Article - No meio do conteúdo */}
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
              url={`/posts/${slug}`}
              title={post.title}
              description={post.excerpt}
            />

            {/* Informações do Autor (expandido) - Mantido no final do conteúdo */}
            {post.author && (
              <div className="border-t border-slate-200 pt-8 mt-8">
                <h3 className="text-2xl font-bold mb-6 text-slate-900">Sobre o Autor</h3>
                <div className="flex gap-6 p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <Avatar className="h-24 w-24 shrink-0">
                    {(post.author.name?.includes('Redação') || post.author.name?.includes('Redacao')) ? (
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

          {/* Sidebar - Widgets */}
          <aside className="lg:col-span-4">
            <div className="sticky top-6">
              <PostSidebar sponsors={sponsors} />
            </div>
          </aside>
        </div>

        {/* Posts Relacionados */}
        <div className="max-w-4xl mx-auto">
          {/* RelatedPosts might need update too if it uses Payload internaly */}
          <RelatedPosts currentSlug={slug} />
        </div>

        <MobileQuickShare
          url={`/posts/${slug}`}
          title={post.title}
          description={post.excerpt}
        />
      </div>
    </div>
  )
}


