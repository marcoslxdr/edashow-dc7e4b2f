/**
 * Script para enviar posts do Supabase para WhatsApp
 *
 * Executa: npx tsx scripts/send-posts-to-whatsapp.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || ''
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'edashow'
const WHATSAPP_NUMBERS = process.env.WHATSAPP_NUMBERS || ''

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
  console.log('📱 EDA Show - Envio de Posts para WhatsApp\n')

  // Validações
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('❌ Erro: Evolution API não configurada')
    console.log('   Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no .env.local')
    process.exit(1)
  }

  if (!WHATSAPP_NUMBERS) {
    console.error('❌ Erro: WHATSAPP_NUMBERS não configurado')
    process.exit(1)
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Erro: Supabase não configurado')
    process.exit(1)
  }

  console.log('✅ Evolution API configurada')
  console.log(`✅ Número(s): ${WHATSAPP_NUMBERS}`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Busca os últimos 5 posts publicados
  console.log('\n🔍 Buscando últimos 5 posts do Supabase...')
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('❌ Erro ao buscar posts:', error.message)
    process.exit(1)
  }

  if (!posts || posts.length === 0) {
    console.log('⚠️  Nenhum post encontrado no Supabase')
    process.exit(0)
  }

  console.log(`✅ ${posts.length} posts encontrados\n`)

  const numbers = WHATSAPP_NUMBERS.split(',').map(n => n.trim()).filter(Boolean)
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://edashow.com.br'

  // Envia posts
  for (const number of numbers) {
    console.log(`📤 Enviando para ${number}...\n`)

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      const message = `*${post.title}*\n\n${post.excerpt || ''}\n\n🔗 Leia mais em: ${baseUrl}/blog/${post.slug}`

      console.log(`   ${i + 1}. ${post.title}`)
      const result = await sendToWhatsApp(message, number)

      if (result.success) {
        console.log(`   ✅ Enviado com sucesso!`)
      } else {
        console.log(`   ❌ Falha: ${result.error}`)
      }

      // Delay entre envios
      if (i < posts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }

    console.log('')
  }

  console.log('🎉 Processo concluído!')
}

main().catch(error => {
  console.error('Erro fatal:', error)
  process.exit(1)
})
