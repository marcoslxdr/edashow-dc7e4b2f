/**
 * Script para diagnosticar e reenviar posts para WhatsApp
 *
 * Executa: npx tsx scripts/diagnose-and-send-whatsapp.ts
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

async function request<T>(path: string, method: 'GET' | 'POST' = 'POST', body?: unknown): Promise<T> {
  if (!EVOLUTION_API_URL) throw new Error('EVOLUTION_API_URL não configurada')
  if (!EVOLUTION_API_KEY) throw new Error('EVOLUTION_API_KEY não configurada')

  const url = `${EVOLUTION_API_URL}${path}`
  console.log(`   🌐 ${method} ${url}`)

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })

  const responseText = await res.text()

  if (!res.ok) {
    throw new Error(`Evolution API ${res.status}: ${responseText}`)
  }

  try {
    return JSON.parse(responseText) as T
  } catch {
    return responseText as T
  }
}

async function getInstanceStatus() {
  try {
    const data = await request<{ instance?: { state?: string }; status?: string }>(
      `/instance/connectionState/${EVOLUTION_INSTANCE}`,
      'GET'
    )
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function getInstanceInfo() {
  try {
    const data = await request<any>(
      `/instance/fetchInstances`,
      'GET'
    )
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function checkNumber(number: string) {
  try {
    const data = await request<any>(
      `/chat/whatsappNumbers/${EVOLUTION_INSTANCE}`,
      'POST',
      {
        numbers: [number.replace(/\D/g, '')]
      }
    )
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function sendText(number: string, text: string) {
  try {
    const data = await request<{ key?: { id?: string } }>(
      `/message/sendText/${EVOLUTION_INSTANCE}`,
      'POST',
      {
        number: number.replace(/\D/g, ''),
        text,
        delay: 1000,
      }
    )
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function main() {
  console.log('🔍 EDA Show - Diagnóstico WhatsApp + Reenvio\n')

  // Validações
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error('❌ Erro: Evolution API não configurada')
    process.exit(1)
  }

  console.log('📋 Configurações:')
  console.log(`   URL: ${EVOLUTION_API_URL}`)
  console.log(`   Instance: ${EVOLUTION_INSTANCE}`)
  console.log(`   Número(s): ${WHATSAPP_NUMBERS}`)
  console.log('')

  // 1. Verifica status da instância
  console.log('1️⃣ Verificando status da instância...')
  const status = await getInstanceStatus()
  if (status.success) {
    console.log('   ✅ Status:', JSON.stringify(status.data, null, 2))
  } else {
    console.log('   ❌ Erro:', status.error)
  }
  console.log('')

  // 2. Lista instâncias
  console.log('2️⃣ Listando instâncias...')
  const instances = await getInstanceInfo()
  if (instances.success) {
    console.log('   ✅ Instâncias:', JSON.stringify(instances.data, null, 2).substring(0, 1000))
  } else {
    console.log('   ❌ Erro:', instances.error)
  }
  console.log('')

  // 3. Verifica número
  const numbers = WHATSAPP_NUMBERS.split(',').map(n => n.trim()).filter(Boolean)
  for (const number of numbers) {
    console.log(`3️⃣ Verificando número ${number}...`)
    const check = await checkNumber(number)
    if (check.success) {
      console.log('   ✅ Resultado:', JSON.stringify(check.data, null, 2))
    } else {
      console.log('   ❌ Erro:', check.error)
    }
    console.log('')
  }

  // 4. Envia mensagem de teste
  console.log('4️⃣ Enviando mensagem de teste...')
  for (const number of numbers) {
    const testResult = await sendText(number, '🤖 Teste EDA Show - Conexão OK!')
    if (testResult.success) {
      console.log(`   ✅ Teste enviado para ${number}:`, JSON.stringify(testResult.data, null, 2))
    } else {
      console.log(`   ❌ Falha no teste para ${number}:`, testResult.error)
    }
  }
  console.log('')

  // 5. Busca e envia posts
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('⚠️  Supabase não configurado - pulando envio de posts')
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log('5️⃣ Buscando posts do Supabase...')
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('   ❌ Erro:', error.message)
    return
  }

  if (!posts || posts.length === 0) {
    console.log('   ⚠️  Nenhum post encontrado')
    return
  }

  console.log(`   ✅ ${posts.length} posts encontrados\n`)

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://edashow.com.br'

  for (const number of numbers) {
    console.log(`📤 Enviando ${posts.length} posts para ${number}...\n`)

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      const message = `*${post.title}*\n\n${post.excerpt || ''}\n\n🔗 Leia mais em: ${baseUrl}/blog/${post.slug}`

      console.log(`   ${i + 1}. ${post.title}`)
      const result = await sendText(number, message)

      if (result.success) {
        console.log(`   ✅ Enviado! ID: ${result.data?.key?.id || 'N/A'}`)
      } else {
        console.log(`   ❌ Falha: ${result.error}`)
      }

      if (i < posts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
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
