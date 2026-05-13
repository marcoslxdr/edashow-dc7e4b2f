/**
 * Script para gerar 5 posts com IA e enviar para WhatsApp
 *
 * Executa: npx tsx scripts/generate-and-send-5-posts.ts
 *
 * Requer .env.local com:
 * - OPENROUTER_API_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - EVOLUTION_API_URL (opcional, para envio WhatsApp)
 * - EVOLUTION_API_KEY (opcional, para envio WhatsApp)
 * - EVOLUTION_INSTANCE (opcional, para envio WhatsApp)
 * - WHATSAPP_NUMBERS (opcional, números separados por vírgula)
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'
const OPENROUTER_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || ''
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'edashow'
const WHATSAPP_NUMBERS = process.env.WHATSAPP_NUMBERS || ''

// 5 temas sobre planos de saúde
const TOPICS = [
  {
    topic: 'Como escolher o melhor plano de saúde para sua família em 2026',
    keywords: ['plano de saúde familiar', 'escolher plano de saúde', 'custo-benefício'],
  },
  {
    topic: 'Telemedicina no plano de saúde: o que mudou em 2026',
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

interface GeneratedPost {
  title: string
  slug: string
  content: string
  excerpt: string
  metaDescription: string
  suggestedTags: string[]
  suggestedCategory?: string
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function generatePostWithAI(topic: string, keywords: string[]): Promise<GeneratedPost> {
  const systemPrompt = `Você é um redator especialista em saúde e planos de saúde do Brasil. 
Escreva em português do Brasil (PT-BR) com tom profissional, amigável e acessível.
Use parágrafos curtos, subtítulos (H2, H3) e listas para facilitar a leitura.
Otimize para SEO com a palavra-chave no título, primeiro parágrafo e subtítulos.
Responda APENAS em JSON válido. Escape corretamente caracteres especiais.`

  const userPrompt = `Gere um post completo sobre: ${topic}

Palavras-chave: ${keywords.join(', ')}

Requisitos:
- Título irresistível entre 50-60 caracteres
- Conteúdo completo em HTML (use <p>, <h2>, <h3>, <ul>, <li>)
- Mínimo de 600 palavras
- Resumo otimizado de até 155 caracteres
- Meta descrição focada em conversão
- 5 a 8 tags relevantes

Retorne no formato JSON:
{
  "title": "...",
  "content": "...",
  "excerpt": "...",
  "metaDescription": "...",
  "suggestedTags": ["..."],
  "suggestedCategory": "..."
}`

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
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
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Resposta vazia da OpenRouter API')
  }

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    // Tenta extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
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
    suggestedCategory: parsed.suggestedCategory || parsed.category || 'Saúde',
  }
}

async function savePostToSupabase(post: GeneratedPost) {
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
      status: 'published',
      featured_home: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.log(`   ⚠️  Erro ao salvar no Supabase: ${error.message}`)
    return null
  }

  return data
}

async function sendToWhatsApp(message: string, number: string) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return { success: false, error: 'Evolution API não configurada' }
  }

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
        delay: 1000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function main() {
  console.log('🤖 EDA Show - Gerador de Posts com IA + WhatsApp\n')

  // Validações
  if (!OPENROUTER_API_KEY) {
    console.error('❌ Erro: OPENROUTER_API_KEY não configurada no .env.local')
    process.exit(1)
  }

  console.log(`✅ OpenRouter configurado (modelo: ${OPENROUTER_MODEL})`)

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('⚠️  Supabase não configurado - posts serão gerados mas não salvos no banco')
  } else {
    console.log('✅ Supabase configurado')
  }

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.log('⚠️  Evolution API não configurada - posts não serão enviados para WhatsApp')
    console.log('   Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e WHATSAPP_NUMBERS no .env.local')
  } else {
    console.log('✅ Evolution API configurada')
  }

  console.log('')

  const generatedPosts: GeneratedPost[] = []

  // Gera 5 posts
  for (let i = 0; i < TOPICS.length; i++) {
    const { topic, keywords } = TOPICS[i]
    console.log(`\n📝 Gerando post ${i + 1}/5: ${topic}`)

    try {
      const post = await generatePostWithAI(topic, keywords)
      generatedPosts.push(post)

      console.log(`   ✅ Título: ${post.title}`)
      console.log(`   🏷️  Tags: ${post.suggestedTags.join(', ')}`)

      // Salva no Supabase
      const saved = await savePostToSupabase(post)
      if (saved) {
        console.log(`   💾 Salvo no Supabase (ID: ${saved.id})`)
      }
    } catch (error) {
      console.error(`   ❌ Erro ao gerar post:`, error instanceof Error ? error.message : error)
    }

    // Delay entre gerações
    if (i < TOPICS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log(`\n✨ ${generatedPosts.length} posts gerados com sucesso!`)

  // Envia para WhatsApp
  if (generatedPosts.length > 0 && WHATSAPP_NUMBERS) {
    const numbers = WHATSAPP_NUMBERS.split(',').map(n => n.trim()).filter(Boolean)

    if (numbers.length > 0 && EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      console.log(`\n📱 Enviando ${generatedPosts.length} posts para ${numbers.length} número(s)...`)

      for (const number of numbers) {
        for (let i = 0; i < generatedPosts.length; i++) {
          const post = generatedPosts[i]
          const message = `*${post.title}*

${post.excerpt}

🔗 Leia mais em: ${process.env.NEXT_PUBLIC_SERVER_URL || 'https://edashow.com.br'}/blog/${post.slug}`

          console.log(`   📤 Enviando post ${i + 1} para ${number}...`)
          const result = await sendToWhatsApp(message, number)

          if (result.success) {
            console.log(`   ✅ Enviado com sucesso!`)
          } else {
            console.log(`   ❌ Falha: ${result.error}`)
          }

          // Delay entre envios
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
      }
    }
  }

  console.log('\n🎉 Processo concluído!')
}

main().catch(error => {
  console.error('Erro fatal:', error)
  process.exit(1)
})
