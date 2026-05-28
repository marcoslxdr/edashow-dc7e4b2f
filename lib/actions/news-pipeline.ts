'use server'

/**
 * News Pipeline - Pesquisa noticias, reescreve com IA, salva como rascunho
 * Usado pelo cron /api/cron/cowork-news
 */

import { openrouter, MODELS } from '@/lib/ai/openrouter'
import { searchImages, downloadAndSaveImage } from '@/lib/images/image-service'
import { savePost } from '@/lib/actions/cms-posts'
import { notifyOwner } from '@/lib/evolution/client'
import { getEditorialYear, getEditorialYearPromptBlock } from '@/lib/ai/editorial-year'

// ─── Types ───────────────────────────────────────────────────────────

interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
}

interface RewrittenArticle {
  title: string
  excerpt: string
  content: string
  suggestedTags: string[]
}

export interface NewsPipelineResult {
  id: string | null
  title: string
  slug: string
  previewUrl: string
  sourceUrl: string
  hasImage: boolean
  error?: string
}

export interface NewsPipelineConfig {
  topic?: string
  count?: number
  siteUrl?: string
}

// ─── Google News RSS Search ──────────────────────────────────────────

export async function searchGoogleNews(topic: string, count: number = 5): Promise<NewsItem[]> {
  const query = encodeURIComponent(`${topic} ${getEditorialYear()}`)
  const url = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EdaShowBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`Google News RSS error: ${response.status}`)
  }

  const xml = await response.text()

  // Parse XML items
  const items: NewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null && items.length < count * 2) {
    const itemXml = match[1]
    const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1] || ''
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || ''
    const source = itemXml.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || ''
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''

    if (title && link) {
      items.push({ title: decodeXmlEntities(title), link, source, pubDate })
    }
  }

  return items.slice(0, count * 2) // Return extra for fallback
}

// ─── Article Content Extraction ──────────────────────────────────────

export async function extractArticleContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return ''

    let html = await response.text()

    // Remove noise
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    html = html.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    html = html.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')

    // Try article or main first
    const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    const base = article || main || html

    // Extract paragraphs
    const paras: string[] = []
    const paraRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
    let paraMatch
    while ((paraMatch = paraRegex.exec(base)) !== null) {
      const text = paraMatch[1].replace(/<[^>]+>/g, '').trim()
      if (text.length > 60) {
        paras.push(text)
      }
    }

    return paras.slice(0, 20).join('\n\n')
  } catch {
    return ''
  }
}

// ─── AI Rewriting ────────────────────────────────────────────────────

async function rewriteNewsArticle(content: string, topic: string): Promise<RewrittenArticle> {
  const prompt = `Escreva um artigo original e completo sobre: ${topic}

Contexto temporal: ${getEditorialYearPromptBlock()}

Use este conteudo como base e inspiracao:
---
${content.slice(0, 2500)}
---

Retorne APENAS JSON com:
{
  "title": "titulo SEO atrativo",
  "excerpt": "resumo ate 160 caracteres",
  "content": "HTML com h2 h3 p ul li strong em. Minimo 800 palavras. Use aspas simples em atributos HTML.",
  "suggestedTags": ["tag1","tag2","tag3","tag4","tag5"]
}`

  const result = await openrouter.generateJSON<RewrittenArticle>(prompt, {
    systemPrompt: 'Voce e um jornalista especializado em saude suplementar e planos de saude no Brasil. Escreva artigos originais, informativos e em portugues brasileiro. Retorne apenas JSON valido.',
    model: MODELS.GEMINI_25_FLASH,
    maxTokens: 4000,
    temperature: 0.7,
  })

  return result
}

// ─── Image Search & Upload ───────────────────────────────────────────

async function findAndUploadCoverImage(title: string): Promise<string> {
  // Translate title keywords to English for better Pexels results
  const keywordsPrompt = `Given this Portuguese article title about health insurance: "${title}"
Return ONLY a short English search query (3-5 words) for finding a relevant stock photo. Just the keywords, nothing else.`

  let query = 'health insurance medical plan'
  try {
    query = await openrouter.generate(keywordsPrompt, {
      model: MODELS.GEMINI_25_FLASH,
      maxTokens: 50,
      temperature: 0.3,
    })
    query = query.replace(/['"]/g, '').trim().slice(0, 80)
  } catch {
    // Use default query
  }

  const result = await searchImages({
    query,
    provider: 'pexels',
    orientation: 'landscape',
    perPage: 3,
  })

  if (result.images.length === 0) return ''

  const { publicUrl } = await downloadAndSaveImage(result.images[0], 'cowork')
  return publicUrl
}

// ─── Slug Generation ─────────────────────────────────────────────────

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

// ─── XML Entity Decoding ─────────────────────────────────────────────

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
}

// ─── Source URL Resolution ───────────────────────────────────────────

async function resolveSourceUrl(googleNewsUrl: string, title: string): Promise<string> {
  // Google News RSS links redirect through Google. Try to follow the redirect.
  try {
    const response = await fetch(googleNewsUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EdaShowBot/1.0)' },
    })
    const finalUrl = response.url
    // If we got to a real article (not still on google.com)
    if (!finalUrl.includes('news.google.com')) {
      return finalUrl
    }
  } catch {
    // Fallback: search DuckDuckGo for the title
  }

  // DuckDuckGo search as fallback
  try {
    const query = encodeURIComponent(title)
    const ddgResponse = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await ddgResponse.text()
    const linkMatch = html.match(/href="(https?:\/\/(?!duckduckgo)[^"]+)"/)
    if (linkMatch) return linkMatch[1]
  } catch {
    // Use Google News URL as fallback
  }

  return googleNewsUrl
}

// ─── Main Pipeline ───────────────────────────────────────────────────

export async function runNewsPipeline(
  config: NewsPipelineConfig = {}
): Promise<{ posts: NewsPipelineResult[]; whatsappMessage: string }> {
  const topic = config.topic || 'saude suplementar'
  const count = config.count || 5
  const siteUrl = config.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://edashow.com.br'

  console.log(`[NEWS] Starting pipeline: "${topic}" x${count}`)

  // 1. Search Google News
  const newsItems = await searchGoogleNews(topic, count)
  console.log(`[NEWS] Found ${newsItems.length} news items`)

  const posts: NewsPipelineResult[] = []
  let processed = 0

  for (const item of newsItems) {
    if (processed >= count) break

    console.log(`[NEWS] Processing ${processed + 1}/${count}: ${item.title.slice(0, 60)}`)

    try {
      // 2. Resolve real URL and extract content
      const sourceUrl = await resolveSourceUrl(item.link, item.title)
      let content = await extractArticleContent(sourceUrl)

      // If extraction failed, use the title + source as seed
      if (content.length < 200) {
        content = `Titulo: ${item.title}\nFonte: ${item.source}\nTema: ${topic}`
      }

      // 3. Rewrite with AI
      const article = await rewriteNewsArticle(content, item.title)
      const slug = generateSlug(article.title)

      // 4. Find and upload cover image
      let coverImageUrl = ''
      try {
        coverImageUrl = await findAndUploadCoverImage(article.title)
      } catch (e) {
        console.warn(`[NEWS] Image failed for "${article.title.slice(0, 40)}":`, e)
      }

      // 5. Save as draft
      const savedPost = await savePost({
        id: 'new',
        title: article.title,
        slug,
        excerpt: article.excerpt,
        content: article.content,
        cover_image_url: coverImageUrl,
        source_url: sourceUrl,
        tags: article.suggestedTags,
        status: 'draft',
        featured_home: false,
        category_id: null,
        columnist_id: null,
      })

      posts.push({
        id: savedPost?.id || null,
        title: article.title,
        slug,
        previewUrl: `${siteUrl}/posts/${slug}`,
        sourceUrl,
        hasImage: !!coverImageUrl,
      })

      processed++
      console.log(`[NEWS] Saved: ${article.title.slice(0, 50)} (${savedPost?.id})`)
    } catch (error) {
      console.error(`[NEWS] Failed: ${item.title.slice(0, 50)}:`, error)
      // Continue to next article
    }
  }

  // 6. Format WhatsApp message
  const whatsappMessage = formatWhatsAppMessage(posts, siteUrl)

  // 7. Send via Evolution API (WhatsApp)
  if (posts.length > 0) {
    const sent = await notifyOwner(whatsappMessage)
    if (sent.success) {
      console.log(`[NEWS] WhatsApp enviado (id: ${sent.messageId})`)
    } else {
      console.warn(`[NEWS] WhatsApp falhou: ${sent.error}`)
    }
  }

  return { posts, whatsappMessage }
}

// ─── WhatsApp Message Formatter ──────────────────────────────────────

function formatWhatsAppMessage(posts: NewsPipelineResult[], siteUrl: string): string {
  if (posts.length === 0) return '⚠️ Nenhum rascunho gerado hoje.'

  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

  let message = `📰 *Novos Rascunhos — ${today}*\n`

  posts.forEach((post, i) => {
    const emoji = emojis[i] || `${i + 1}.`
    message += `\n${emoji} *${post.title}*\n🔗 ${post.previewUrl}\n`
  })

  message += `\n⚠️ _Todos como rascunho. Revisar antes de publicar._`

  return message
}
