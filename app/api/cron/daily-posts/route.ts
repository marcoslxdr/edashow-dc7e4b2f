import { NextResponse } from 'next/server'
import { generateAIPost } from '@/lib/actions/ai-posts'
import { generateAICoverImage, getAICoverSuggestions, selectAICoverImage } from '@/lib/actions/ai-images'
import { selectRandomKeywords } from '@/lib/constants/health-insurance-keywords'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const ADDITIONAL_INSTRUCTIONS = `Foque no contexto brasileiro de planos de saúde.
Mencione a ANS (Agência Nacional de Saúde Suplementar) quando relevante.
Inclua dicas práticas e acionáveis para o leitor.
Use exemplos reais do mercado brasileiro.
O conteúdo deve ser educativo e ajudar consumidores a tomar decisões informadas.
Pesquise informações atualizadas sobre o tema.`

interface SavedPost {
  id: string
  title: string
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
    return
  }

  const numbers = numbersRaw.split(',').map(n => n.trim()).filter(Boolean)
  if (numbers.length === 0) return

    const lines = posts.map((p, i) => {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']
    return `${emojis[i]} ${p.title}\n🔗 https://edashow.com.br/preview/${p.id}`
  }).join('\n\n')

  const message = `📰 *${posts.length} Rascunhos Publicados — Planos de Saúde*\n_EDA Show | ${date}_\n\n${lines}\n\n📝 _Posts como rascunho — revisar antes de publicar_`

  for (const number of numbers) {
    try {
      const response = await fetch(`${evoUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'apikey': evoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number, text: message }),
      })

      const result = await response.json()
      console.log(`[DAILY] WhatsApp sent to ${number}:`, result?.key?.id || 'OK')
    } catch (error) {
      console.error(`[DAILY] WhatsApp error for ${number}:`, error)
    }
  }
}

async function generateOnePost(keyword: string, errors: FailedPost[]): Promise<SavedPost | null> {
  try {
    const post = await generateAIPost({
      topic: keyword,
      wordCount: 1000,
      tone: 'professional',
      autoCategorize: true,
      additionalInstructions: ADDITIONAL_INSTRUCTIONS,
    })

    let coverImageUrl = ''

    try {
      const geminiResult = await generateAICoverImage({
        title: post.title,
        content: post.content,
      })
      if (geminiResult.url && !geminiResult.error) {
        coverImageUrl = geminiResult.url
      }
    } catch (e: any) {
      console.log(`[DAILY] Gemini image failed for "${keyword}": ${e?.message || e}, trying Pexels`)
    }

    if (!coverImageUrl) {
      try {
        const imageResult = await getAICoverSuggestions({
          title: post.title,
          content: post.content,
          count: 1,
        })
        if (imageResult.images.length > 0) {
          const saved = await selectAICoverImage(
            imageResult.images[0].url,
            imageResult.images[0].source as 'pexels' | 'unsplash' | 'gemini'
          )
          if (saved.url) coverImageUrl = saved.url
        }
      } catch (e: any) {
        console.log(`[DAILY] Pexels image failed for "${keyword}": ${e?.message || e}`)
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[DAILY] Supabase not configured')
      return null
    }

    const slug = post.slug || post.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const saveRes = await fetch(`${supabaseUrl}/rest/v1/posts`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        title: post.title,
        slug,
        excerpt: post.excerpt,
        content: post.content,
        cover_image_url: coverImageUrl || null,
        tags: post.suggestedTags || [],
        status: 'draft',
        columnist_id: null,
        featured_home: false,
      }),
    })

    if (!saveRes.ok) {
      const errText = await saveRes.text()
      console.error(`[DAILY] Save failed for "${keyword}":`, errText)
      errors.push({ keyword, error: `Erro ao salvar: ${errText.substring(0, 200)}` })
      return null
    }

    const saved = await saveRes.json()
    const savedPost = Array.isArray(saved) ? saved[0] : saved

    return { id: savedPost?.id, title: post.title }
  } catch (error: any) {
    const msg = error?.message || error?.toString() || 'Erro desconhecido'
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

  const count = 5
  const keywords = selectRandomKeywords(count)
  const savedPosts: SavedPost[] = []
  const errors: FailedPost[] = []

  console.log(`[DAILY] Starting ${count} posts: ${keywords.join(', ')}`)

  for (const keyword of keywords) {
    const post = await generateOnePost(keyword, errors)
    if (post) {
      savedPosts.push(post)
      console.log(`[DAILY] Generated: ${post.title}`)
    }
  }

  const today = new Date().toLocaleDateString('pt-BR')

  await sendWhatsAppReport(savedPosts, today)

  return NextResponse.json({
    success: true,
    total: savedPosts.length,
    keywords,
    posts: savedPosts,
    errors: errors.length > 0 ? errors : undefined,
    whatsapp: !!(process.env.EVOLUTION_API_URL && (process.env.WHATSAPP_NUMBERS || process.env.WHATSAPP_NUMBER)),
    timestamp: new Date().toISOString(),
  })
}
