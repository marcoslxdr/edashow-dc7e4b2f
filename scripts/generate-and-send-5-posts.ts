/**
 * Script para gerar 5 posts com IA, gerar imagem de capa e enviar para WhatsApp
 * Fluxo completo: IA -> Imagem -> Draft -> Preview Link -> WhatsApp
 *
 * Executa: npx tsx scripts/generate-and-send-5-posts.ts
 *
 * Requer .env.local com:
 * - OPENROUTER_API_KEY
 * - OPENROUTER_IMAGE_MODEL (opcional, default: google/gemini-2.5-flash-image)
 * - PEXELS_API_KEY (opcional, fallback de imagem)
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - NEXT_PUBLIC_SERVER_URL (ou https://edashow.com.br)
 * - EVOLUTION_API_URL
 * - EVOLUTION_API_KEY
 * - EVOLUTION_INSTANCE
 * - WHATSAPP_NUMBERS
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'
const OPENROUTER_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash'
const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image'
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || ''

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BUCKET = process.env.SUPABASE_BUCKET || 'media'

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || ''
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'edashow'
const WHATSAPP_NUMBERS = process.env.WHATSAPP_NUMBERS || ''
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'https://edashow.com.br'

function buildTopics(): { topic: string; keywords: string[] }[] {
  const y = new Date().getFullYear()
  return [
    {
      topic: `Como escolher o melhor plano de saúde para sua família em ${y}`,
      keywords: ['plano de saúde familiar', 'escolher plano de saúde', 'custo-benefício'],
    },
    {
      topic: `Telemedicina no plano de saúde: o que mudou em ${y}`,
      keywords: ['telemedicina', 'plano de saúde digital', 'consulta online'],
    },
    {
      topic: 'Entenda a carência do plano de saúde e como reduzi-la',
      keywords: ['carência plano de saúde', 'prazo de carência', 'portabilidade'],
    },
    {
      topic: 'Planos de saúde para MEI e autônomos: guia completo',
      keywords: ['plano de saúde MEI', 'plano de saúde autônomo', 'plano de saúde barato'],
    },
    {
      topic: 'O que fazer quando o plano de saúde nega cobertura',
      keywords: ['plano de saúde negou cobertura', 'direitos beneficiário', 'ANS'],
    },
  ]
}

interface GeneratedPost {
  id?: string
  title: string
  slug: string
  content: string
  excerpt: string
  metaDescription: string
  suggestedTags: string[]
  coverImageUrl?: string
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function sanitizeJSON(raw: string): string {
  // Remove bad control characters that break JSON parsing
  return raw.replace(/[\x00-\x1F\x7F]/g, '')
}

async function generatePostWithAI(topic: string, keywords: string[]): Promise<GeneratedPost> {
  const y = new Date().getFullYear()
  const systemPrompt = `Você é um redator especialista em saúde e planos de saúde do Brasil.
Escreva em português do Brasil (PT-BR) com tom profissional, amigável e acessível.
Use parágrafos curtos, subtítulos (H2, H3) e listas para facilitar a leitura.
Otimize para SEO com a palavra-chave no título, primeiro parágrafo e subtítulos.
O conteúdo deve refletir o cenário atual de ${y} no Brasil (regulamentação, mercado e exemplos vigentes).
Responda APENAS em JSON válido. NÃO use caracteres de controle no JSON.`

  const userPrompt = `Gere um post completo sobre: ${topic}

Palavras-chave: ${keywords.join(', ')}

Requisitos:
- Título irresistível entre 50-60 caracteres
- Conteúdo completo em HTML (use <p>, <h2>, <h3>, <ul>, <li>)
- Mínimo de 600 palavras
- Resumo otimizado de até 155 caracteres
- Meta descrição focada em conversão
- 5 a 8 tags relevantes

Retorne APENAS JSON válido SEM caracteres de controle:
{"title": "...", "content": "<p>...</p>", "excerpt": "...", "metaDescription": "...", "suggestedTags": ["..."]}`

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SERVER_URL,
      'X-Title': 'EDA Show CMS',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${error}`)
  }

  const data = await response.json()
  let content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Resposta vazia da OpenRouter API')
  }

  content = sanitizeJSON(content)

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(sanitizeJSON(jsonMatch[0]))
    } else {
      throw new Error('Falha ao parsear JSON da resposta')
    }
  }

  const title = parsed.title || topic
  const slug = generateSlug(title)

  return {
    title,
    slug,
    content: parsed.content || parsed.body || '',
    excerpt: parsed.excerpt || parsed.summary || '',
    metaDescription: parsed.metaDescription || parsed.meta_description || '',
    suggestedTags: parsed.suggestedTags || parsed.tags || [],
  }
}

// ─── IMAGE GENERATION ───

async function generateImagePrompt(title: string, content?: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return `Professional blog cover image for: ${title}`

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SERVER_URL,
      'X-Title': 'EDA Show CMS'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating image generation prompts. Generate a single, detailed prompt in English for creating a professional blog cover image. The image should be clean, modern, and suitable for a healthcare/wellness blog. Return ONLY the prompt text, nothing else.'
        },
        {
          role: 'user',
          content: `Create an image generation prompt for a blog post titled: "${title}"${content ? `\n\nContent excerpt: ${content.slice(0, 300)}` : ''}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    return `Professional blog cover image for: ${title}`
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || `Professional blog cover image for: ${title}`
}

async function generateGeminiImage(title: string, content?: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null

  try {
    const promptText = await generateImagePrompt(title, content)
    const imagePrompt = `Generate a professional, high-quality blog cover image. ${promptText}. The image should be photorealistic, well-lit, with a clean modern aesthetic suitable for a professional blog.`

    console.log(`   🎨 Gerando imagem com Gemini...`)
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SERVER_URL,
        'X-Title': 'EDA Show CMS'
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: 'user', content: imagePrompt }],
        modalities: ['text', 'image'],
        max_tokens: 4096,
        temperature: 0.8
      })
    })

    if (!response.ok) {
      console.log(`   ⚠️ Gemini API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message
    if (!message) return null

    let base64Image: string | null = null
    let mimeType = 'image/png'

    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          const match = part.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/)
          if (match) { mimeType = match[1]; base64Image = match[2]; break }
        }
        if (part.type === 'image' && part.data) {
          base64Image = part.data
          if (part.mime_type) mimeType = part.mime_type
          break
        }
      }
    }

    if (!base64Image && Array.isArray(message.images)) {
      for (const img of message.images) {
        if (img.type === 'image_url' && img.image_url?.url) {
          const match = img.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/)
          if (match) { mimeType = match[1]; base64Image = match[2]; break }
        }
      }
    }

    if (!base64Image) {
      console.log(`   ⚠️ Gemini não retornou imagem`)
      return null
    }

    const buffer = Buffer.from(base64Image, 'base64')
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png'
    const filename = `covers/gemini-${Date.now()}.${ext}`

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: mimeType, upsert: true })

    if (uploadError) {
      console.log(`   ⚠️ Erro upload: ${uploadError.message}`)
      return null
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename)
    console.log(`   ✅ Imagem Gemini gerada!`)
    return urlData.publicUrl
  } catch (e: any) {
    console.log(`   ⚠️ Gemini falhou: ${e.message}`)
    return null
  }
}

async function searchPexels(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY) return null
  try {
    console.log(`   🔍 Buscando no Pexels: "${query}"`)
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { 'Authorization': PEXELS_API_KEY } }
    )
    if (!response.ok) return null

    const data = await response.json()
    const photo = data.photos?.[0]
    if (!photo) return null

    const imageUrl = photo.src.large2x || photo.src.large
    console.log(`   📥 Baixando imagem Pexels...`)

    const imgResp = await fetch(imageUrl)
    if (!imgResp.ok) return null

    const blob = await imgResp.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const extension = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg'
    const filename = `covers/pexels-${Date.now()}-${photo.id}.${extension}`

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: blob.type || 'image/jpeg', upsert: false })

    if (uploadError) {
      console.log(`   ⚠️ Erro upload Pexels: ${uploadError.message}`)
      return null
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename)
    console.log(`   ✅ Imagem Pexels salva!`)
    return urlData.publicUrl
  } catch (e: any) {
    console.log(`   ⚠️ Pexels falhou: ${e.message}`)
    return null
  }
}

async function getCoverImage(title: string, content?: string): Promise<string | null> {
  // Try Gemini first
  let url = await generateGeminiImage(title, content)
  if (url) return url

  // Fallback to Pexels
  console.log(`   🔄 Tentando Pexels como fallback...`)
  const keywords = title.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5)
    .join(' ')

  url = await searchPexels(`${keywords} healthcare medical`)
  return url
}

// ─── SUPABASE ───

async function savePostToSupabase(post: GeneratedPost): Promise<{ id: string } | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('   ⚠️  Supabase não configurado - post não salvo no banco')
    return null
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const { data, error } = await supabase
    .from('posts')
    .insert({
      title: post.title,
      slug: post.slug,
      subtitle: post.excerpt.substring(0, 120),
      content: post.content,
      excerpt: post.excerpt,
      tags: post.suggestedTags,
      cover_image_url: post.coverImageUrl || null,
      status: 'draft',
      featured_home: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.log(`   ⚠️  Erro ao salvar no Supabase: ${error.message}`)
    return null
  }

  return data
}

// ─── WHATSAPP ───

async function sendToWhatsApp(post: GeneratedPost) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.log('   ⚠️  Evolution API não configurada - pulando WhatsApp')
    return
  }

  const numbers = WHATSAPP_NUMBERS.split(',').map(n => n.trim()).filter(Boolean)
  if (numbers.length === 0) {
    console.log('   ⚠️  Nenhum número de WhatsApp configurado')
    return
  }

  // VALIDAÇÃO: sem imagem = não envia
  if (!post.coverImageUrl) {
    console.log(`   ⛔ Post SEM IMAGEM — NÃO será enviado via WhatsApp`)
    return
  }

  if (!post.id) {
    console.log(`   ⛔ Post sem ID — NÃO será enviado via WhatsApp`)
    return
  }

  const previewUrl = `${SERVER_URL}/preview/${post.id}`
  const message = `*${post.title}*

${post.excerpt}

🔗 Preview: ${previewUrl}`

  for (const number of numbers) {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: number.replace(/\D/g, ''),
          text: message,
          delay: 2000,
        }),
      })

      if (response.ok) {
        console.log(`   ✅ WhatsApp enviado para ${number}`)
      } else {
        const error = await response.text()
        console.log(`   ❌ WhatsApp falhou para ${number}: ${error.substring(0, 200)}`)
      }
    } catch (error: any) {
      console.log(`   ❌ Erro WhatsApp: ${error.message}`)
    }
  }
}

// ─── MAIN ───

async function main() {
  console.log('🤖 EDA Show - Gerador de Posts com IA + Imagem + WhatsApp\n')

  // Validações
  if (!OPENROUTER_API_KEY) {
    console.error('❌ Erro: OPENROUTER_API_KEY não configurada no .env.local')
    process.exit(1)
  }

  console.log(`✅ OpenRouter configurado (modelo: ${OPENROUTER_MODEL})`)
  console.log(`🎨 Image model: ${IMAGE_MODEL}`)

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('⚠️  Supabase não configurado - posts serão gerados mas não salvos no banco')
  } else {
    console.log('✅ Supabase configurado')
  }

  if (!PEXELS_API_KEY) {
    console.log('⚠️  Pexels não configurado - sem fallback de imagem')
  }

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.log('⚠️  Evolution API não configurada - posts não serão enviados para WhatsApp')
  } else {
    console.log('✅ Evolution API configurada')
    console.log(`📞 Números: ${WHATSAPP_NUMBERS || 'nenhum'}`)
  }

  console.log('')

  const generatedPosts: GeneratedPost[] = []

  const TOPICS = buildTopics()

  // Gera 5 posts
  for (let i = 0; i < TOPICS.length; i++) {
    const { topic, keywords } = TOPICS[i]
    console.log(`\n📝 [${i + 1}/5] Gerando post: ${topic}`)

    try {
      // 1. Gera conteúdo
      const post = await generatePostWithAI(topic, keywords)
      console.log(`   ✅ Título: ${post.title}`)
      console.log(`   🏷️  Tags: ${post.suggestedTags.join(', ')}`)

      // 2. Gera imagem de capa
      console.log(`   🎨 Gerando imagem de capa...`)
      post.coverImageUrl = await getCoverImage(post.title, post.content)

      // 3. Salva no Supabase como DRAFT
      const saved = await savePostToSupabase(post)
      if (saved) {
        post.id = saved.id
        console.log(`   💾 Salvo como draft no Supabase (ID: ${saved.id})`)
      }

      generatedPosts.push(post)
    } catch (error: any) {
      console.error(`   ❌ Erro ao gerar post:`, error.message || error)
    }

    // Delay entre gerações
    if (i < TOPICS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }

  console.log(`\n✨ ${generatedPosts.length} posts gerados com sucesso!`)

  // 4. Envia para WhatsApp (somente posts com imagem)
  if (generatedPosts.length > 0 && EVOLUTION_API_URL && EVOLUTION_API_KEY) {
    console.log(`\n📱 Enviando posts para WhatsApp...`)
    console.log(`   ⛔ Posts SEM imagem serão IGNORADOS\n`)

    for (let i = 0; i < generatedPosts.length; i++) {
      const post = generatedPosts[i]
      console.log(`   [${i + 1}] ${post.title}`)
      await sendToWhatsApp(post)

      if (i < generatedPosts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  // Resumo final
  const withImage = generatedPosts.filter(p => !!p.coverImageUrl)
  const withoutImage = generatedPosts.filter(p => !p.coverImageUrl)

  console.log(`\n📊 RESUMO:`)
  console.log(`   Total gerados: ${generatedPosts.length}`)
  console.log(`   Com imagem: ${withImage.length}`)
  console.log(`   Sem imagem: ${withoutImage.length}`)
  console.log(`   Enviados WhatsApp: ${withImage.length}`)

  console.log('\n🎉 Processo concluído!')
}

main().catch(error => {
  console.error('Erro fatal:', error)
  process.exit(1)
})
