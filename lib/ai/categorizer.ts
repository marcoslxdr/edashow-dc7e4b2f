/**
 * Auto Categorizer Service
 * Automatically suggests categories and tags for content
 */

import { opencode, MODELS } from './opencode'
import { createAdminClient } from '@/lib/supabase/server'

export interface CategorizationResult {
    category: string
    categoryId?: string
    tags: string[]
    confidence: number
    reasoning: string
}

/**
 * Get all available categories from database
 */
async function getAvailableCategories(): Promise<Array<{ id: string; name: string; slug: string }>> {
    try {
        const supabase = createAdminClient()
        const { data } = await supabase
            .from('categories')
            .select('id, name, slug')
            .order('name')

        return data || []
    } catch {
        // Fallback categories
        return [
            { id: '1', name: 'Notícias', slug: 'noticias' },
            { id: '2', name: 'Análises', slug: 'analises' },
            { id: '3', name: 'Entrevistas', slug: 'entrevistas' },
            { id: '4', name: 'Opinião', slug: 'opiniao' }
        ]
    }
}

/**
 * Categorize content automatically
 */
export async function categorizeContent(
    title: string,
    content: string,
    excerpt?: string
): Promise<CategorizationResult> {
    const categories = await getAvailableCategories()
    const categoryNames = categories.map(c => c.name).join(', ')

    const prompt = `Analise o seguinte conteúdo e sugira a categoria e tags mais apropriadas:

Título: ${title}
${excerpt ? `Resumo: ${excerpt}` : ''}
Conteúdo (início): ${content.substring(0, 1500)}

Categorias disponíveis: ${categoryNames}

Responda em JSON:
{
  "category": "nome exato de uma das categorias disponíveis",
  "tags": ["até 5 tags relevantes"],
  "confidence": 0.0 a 1.0,
  "reasoning": "breve explicação da escolha"
}`

    const result = await opencode.generateJSON<{
        category: string
        tags: string[]
        confidence: number
        reasoning: string
    }>(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.3
    })

    // Find matching category ID
    const matchedCategory = categories.find(
        c => c.name.toLowerCase() === result.category?.toLowerCase() ||
            c.slug.toLowerCase() === result.category?.toLowerCase()
    )

    return {
        category: result.category || categories[0]?.name || 'Notícias',
        categoryId: matchedCategory?.id,
        tags: result.tags || [],
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || ''
    }
}

/**
 * Suggest tags for content
 */
export async function suggestTags(
    title: string,
    content: string,
    existingTags?: string[]
): Promise<string[]> {
    const prompt = `Sugira tags relevantes para o seguinte conteúdo:

Título: ${title}
Conteúdo (início): ${content.substring(0, 1500)}
${existingTags?.length ? `Tags existentes para evitar duplicatas: ${existingTags.join(', ')}` : ''}

Requisitos:
- Até 8 tags
- Relevantes para SEO
- Específicas ao tema de saúde/odontologia quando aplicável
- Em português brasileiro

Responda em JSON: { "tags": ["tag1", "tag2", ...] }`

    const result = await opencode.generateJSON<{ tags: string[] }>(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.4
    })

    return result.tags || []
}

/**
 * Extract named entities from content
 */
export async function extractEntities(content: string): Promise<{
    people: string[]
    organizations: string[]
    locations: string[]
    topics: string[]
}> {
    const prompt = `Extraia entidades nomeadas do seguinte texto:

${content.substring(0, 2000)}

Responda em JSON:
{
  "people": ["nomes de pessoas mencionadas"],
  "organizations": ["empresas, instituições, hospitais"],
  "locations": ["cidades, países, locais"],
  "topics": ["temas principais abordados"]
}`

    return opencode.generateJSON(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.2
    })
}

/**
 * Detect content type
 */
export async function detectContentType(
    title: string,
    content: string
): Promise<{
    type: 'news' | 'opinion' | 'guide' | 'interview' | 'analysis' | 'listicle'
    confidence: number
}> {
    const prompt = `Analise e identifique o tipo de conteúdo:

Título: ${title}
Conteúdo (início): ${content.substring(0, 1000)}

Tipos possíveis:
- news: notícia ou atualização
- opinion: artigo de opinião ou editorial
- guide: guia prático ou tutorial
- interview: entrevista com alguém
- analysis: análise aprofundada
- listicle: lista ou ranking

Responda em JSON:
{
  "type": "tipo identificado",
  "confidence": 0.0 a 1.0
}`

    return opencode.generateJSON(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.2
    })
}

/**
 * Batch categorize multiple posts
 */
export async function batchCategorize(
    posts: Array<{ id: string; title: string; content: string }>
): Promise<Record<string, CategorizationResult>> {
    const results: Record<string, CategorizationResult> = {}

    // Process in batches of 3 to avoid rate limits
    for (let i = 0; i < posts.length; i += 3) {
        const batch = posts.slice(i, i + 3)
        const promises = batch.map(async post => {
            const result = await categorizeContent(post.title, post.content)
            return { id: post.id, result }
        })

        const batchResults = await Promise.all(promises)
        for (const { id, result } of batchResults) {
            results[id] = result
        }
    }

    return results
}
