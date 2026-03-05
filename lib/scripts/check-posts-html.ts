/**
 * Script de diagnóstico para verificar o HTML dos posts
 * Uso: npx tsx lib/scripts/check-posts-html.ts
 */

import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

// Carregar variáveis de ambiente
config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL!

if (!databaseUrl) {
  console.error('❌ Variável de ambiente DATABASE_URL é necessária')
  console.error('   Verifique se o arquivo .env.local existe e contém DATABASE_URL.')
  process.exit(1)
}

const sql = neon(databaseUrl)

async function checkPostsHTML() {
  console.log('🔍 Verificando HTML dos posts publicados...\n')

  const posts = await sql`
    SELECT id, title, content FROM posts
    WHERE status = 'published'
    ORDER BY published_at DESC
    LIMIT 5
  `

  if (!posts || posts.length === 0) {
    console.log('ℹ️  Nenhum post encontrado')
    return
  }

  posts.forEach((post, index) => {
    const contentStart = (post.content as string)?.substring(0, 200) || ''
    const hasBlockquote = contentStart.trim().startsWith('<blockquote>')
    const hasParagraph = contentStart.trim().startsWith('<p>')

    console.log(`\n${index + 1}. **${post.title}** (ID: ${post.id})`)
    console.log(`   URL: /posts/${post.id}`)
    console.log(`   Início do HTML:`)
    console.log(`   ${contentStart}`)

    if (hasBlockquote) {
      console.log(`   ⚠️  COMEÇA COM <blockquote> - Problema confirmado!`)
    } else if (hasParagraph) {
      console.log(`   ✅ COMEÇA COM <p> - HTML correto`)
    } else {
      console.log(`   ❓ Formato desconhecido`)
    }

    const content = post.content as string
    const blockquoteCount = (content?.match(/<blockquote>/g) || []).length
    const paragraphCount = (content?.match(/<p>/g) || []).length

    console.log(`   Estatísticas: ${paragraphCount} <p>, ${blockquoteCount} <blockquote>`)
  })

  console.log('\n---')
  console.log('✨ Verificação concluída!')
}

checkPostsHTML().catch(console.error)
