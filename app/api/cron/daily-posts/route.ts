import { NextResponse } from 'next/server'
import { generateAIPost } from '@/lib/actions/ai-posts'
import { getAICoverSuggestions, selectAICoverImage } from '@/lib/actions/ai-images'
import { savePost } from '@/lib/actions/cms-posts'
import { pickImageForKeyword } from '@/lib/images/image-bank-picker'
import { getProductionAdditionalInstructions } from '@/lib/ai/editorial-year'
import {
  getDailyKeywordCount,
  selectKeywordsForDailyRun,
} from '@/lib/post-generation/keywords'
import { logPostGeneration } from '@/lib/post-generation/log'
import { isDailyPostsEnabled } from '@/lib/feature-flags'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const ADDITIONAL_INSTRUCTIONS = getProductionAdditionalInstructions()

interface SavedPost {
  id: string
  title: string
  keyword: string
  hasImage: boolean
  imageSource: string
  durationMs: number
}

interface FailedPost {
  keyword: string
  error: string
}

async function sendWhatsAppReport(posts: SavedPost[], date: string) {
  const evoUrl = process.env.EVOLUTION_API_URL
  const evoKey = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE || 'marcos'
  const numbersRaw = process.env.WHATSAPP_NUMBERS || process.env.WHATSAPP_NUMBER || ''

  if (!evoUrl || !evoKey || !numbersRaw) {
    console.log('[DAILY] Evolution API not configured, skipping WhatsApp')
    return { sent: 0, skipped: posts.length }
  }

  const numbers = numbersRaw.split(',').map((n) => n.trim()).filter(Boolean)
  if (numbers.length === 0) return { sent: 0, skipped: posts.length }

  const postsWithImage = posts.filter((p) => p.hasImage)
  const postsWithoutImage = posts.filter((p) => !p.hasImage)

  if (postsWithImage.length === 0) {
    console.log('[DAILY] Nenhum post com imagem — nada será enviado no WhatsApp')
    return { sent: 0, skipped: postsWithoutImage.length }
  }

  const lines = postsWithImage.map((p, i) => {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']
    return `${emojis[i]} ${p.title}\n🔗 https://edashow.com.br/preview/${p.id}`
  }).join('\n\n')

  const skippedText =
    postsWithoutImage.length > 0
      ? `\n\n⚠️ _${postsWithoutImage.length} post(s) gerado(s) mas NÃO enviado(s) por falta de imagem de capa_`
      : ''

  const message = `📰 *${postsWithImage.length} Rascunho(s) — Planos de Saúde*\n_EDA Show | ${date}_\n\n${lines}${skippedText}\n\n📝 _Revisar antes de publicar_`

  let totalSent = 0
  for (const number of numbers) {
    try {
      const response = await fetch(`${evoUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          apikey: evoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number, text: message }),
      })

      const result = await response.json()
      if (response.ok) {
        console.log(`[DAILY] WhatsApp sent to ${number}:`, result?.key?.id || 'OK')
        totalSent++
      } else {
        console.error(`[DAILY] WhatsApp failed for ${number}:`, result)
      }
    } catch (error) {
      console.error(`[DAILY] WhatsApp error for ${number}:`, error)
    }
  }

  return {
    sent: totalSent,
    withImage: postsWithImage.length,
    withoutImage: postsWithoutImage.length,
    skipped: postsWithoutImage.length,
  }
}

async function pickCoverImage(
  keyword: string,
  title: string,
  content: string
): Promise<{ url: string; source: string }> {
  try {
    const bankPick = await pickImageForKeyword(keyword)
    if (bankPick?.publicUrl) {
      console.log(`[DAILY] Image bank: ${bankPick.categorySlug} (${bankPick.provider})`)
      return { url: bankPick.publicUrl, source: 'image-bank' }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`[DAILY] Image bank failed: ${msg}`)
  }

  console.log(`[DAILY] Falling back to live stock...`)
  try {
    const imageResult = await getAICoverSuggestions({ title, content, count: 1 })
    if (imageResult.images.length > 0) {
      const img = imageResult.images[0]
      const saved = await selectAICoverImage(
        img.url,
        img.source as 'pexels' | 'unsplash'
      )
      if (saved.url) {
        return { url: saved.url, source: img.source || 'stock' }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`[DAILY] Stock failed: ${msg}`)
  }

  return { url: '', source: 'none' }
}

async function generateOnePost(keyword: string, errors: FailedPost[]): Promise<SavedPost | null> {
  const startedAt = Date.now()
  console.log(
    JSON.stringify({
      event: 'daily_post_start',
      keyword,
      postModel: process.env.OPENCODE_POST_MODEL || 'kimi-k2.6',
      coverOrder: ['image-bank', 'stock'],
    })
  )

  try {
    const post = await generateAIPost({
      topic: keyword,
      wordCount: 1000,
      tone: 'professional',
      autoCategorize: true,
      additionalInstructions: ADDITIONAL_INSTRUCTIONS,
      context: 'daily-cron',
    })
    console.log(`[DAILY] Post generated: "${post.title}"`)

    const { url: coverImageUrl, source: imageSource } = await pickCoverImage(
      keyword,
      post.title,
      post.content
    )

    if (!coverImageUrl) {
      console.log(`[DAILY] WARNING: No cover for "${post.title}" — salvo sem WhatsApp`)
    }

    const savedPost = await savePost({
      id: 'new',
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: coverImageUrl || null,
      tags: post.suggestedTags || [],
      status: 'draft',
      category_id: post.categoryId || null,
      columnist_id: null,
      featured_home: false,
    })

    const durationMs = Date.now() - startedAt

    await logPostGeneration({
      keyword,
      postId: savedPost?.id,
      pipeline: 'keyword',
      imageSource,
      durationMs,
    })

    console.log(
      JSON.stringify({
        event: 'daily_post_saved',
        keyword,
        postId: savedPost?.id,
        hasImage: !!coverImageUrl,
        imageSource,
        durationMs,
      })
    )

    return {
      id: savedPost?.id,
      title: post.title,
      keyword,
      hasImage: !!coverImageUrl,
      imageSource,
      durationMs,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[DAILY] Failed for keyword "${keyword}":`, msg)
    errors.push({ keyword, error: msg })
    return null
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isDailyPostsEnabled()) {
    console.log('[DAILY] Daily posts disabled — skipping run')
    return NextResponse.json(
      {
        success: false,
        disabled: true,
        message:
          'O cron daily-posts está desabilitado. Defina ENABLE_DAILY_POSTS=true (ou ENABLE_POST_GENERATION=true) para reativar.',
      },
      { status: 503 }
    )
  }

  const runStartedAt = Date.now()
  const count = getDailyKeywordCount()
  const keywords = await selectKeywordsForDailyRun(count)
  const savedPosts: SavedPost[] = []
  const errors: FailedPost[] = []

  console.log(`[DAILY] Starting ${count} posts: ${keywords.join(', ')}`)

  for (const keyword of keywords) {
    const post = await generateOnePost(keyword, errors)
    if (post) savedPosts.push(post)
  }

  const today = new Date().toLocaleDateString('pt-BR')
  const whatsappResult = await sendWhatsAppReport(savedPosts, today)
  const runDurationMs = Date.now() - runStartedAt

  const summary = {
    success: errors.length === 0,
    total: savedPosts.length,
    requested: count,
    keywords,
    posts: savedPosts,
    whatsapp: whatsappResult,
    errors: errors.length > 0 ? errors : undefined,
    runDurationMs,
    timestamp: new Date().toISOString(),
  }

  console.log(JSON.stringify({ event: 'daily_run_complete', ...summary }))

  return NextResponse.json(summary, {
    status: savedPosts.length === 0 ? 500 : 200,
  })
}
