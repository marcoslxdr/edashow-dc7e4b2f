/**
 * Content Rewriter Service
 * Rewrites and adapts content from external sources
 */

import { openrouter, MODELS } from './openrouter'
import { sql } from '@/lib/db/client'

export interface RewriteConfig {
    sourceContent: string
    sourceUrl?: string
    keywords?: string[]
    tone?: 'professional' | 'casual' | 'formal' | 'friendly'
    guidelines?: string
    preserveLength?: boolean
}

export interface RewrittenContent {
    title: string
    content: string
    excerpt: string
    originalLength: number
    newLength: number
    similarityEstimate: number
}

/**
 * Get rewriting guidelines from settings
 */
async function getRewriteGuidelines(): Promise<string> {
    try {
        const rows = await sql`SELECT setting_value FROM ai_settings WHERE setting_key = 'rewrite_guidelines' LIMIT 1`
        if (rows && rows[0]?.setting_value) {
            const val = rows[0].setting_value
            return typeof val === 'string' ? JSON.parse(val) : val
        }
    } catch {
        // Use default guidelines
    }

    return `Ao reescrever conteúdo:
- Manter todas as informações factuais corretas
- Usar linguagem própria e original
- Adaptar o tom para o portal EDA Show
- Manter a estrutura lógica do conteúdo
- Otimizar para SEO quando possível`
}

/**
 * Rewrite content from an external source
 */
export async function rewriteContent(config: RewriteConfig): Promise<RewrittenContent> {
    const defaultGuidelines = await getRewriteGuidelines()
    const guidelines = config.guidelines || defaultGuidelines

    const toneDescriptions = {
        professional: 'profissional e informativo',
        casual: 'casual e acessível',
        formal: 'formal e acadêmico',
        friendly: 'amigável e conversacional'
    }

    const prompt = `Reescreva o seguinte conteúdo de forma completamente original, mantendo a precisão das informações:

${config.sourceUrl ? `Fonte original: ${config.sourceUrl}` : ''}

Conteúdo original:
${config.sourceContent}

Diretrizes de reescrita:
${guidelines}

Tom desejado: ${toneDescriptions[config.tone || 'professional']}
${config.keywords?.length ? `Palavras-chave para incluir: ${config.keywords.join(', ')}` : ''}
${config.preserveLength ? 'Manter aproximadamente o mesmo tamanho.' : ''}

Requisitos:
1. O texto deve ser COMPLETAMENTE reescrito (não apenas parafrasear)
2. Manter todas as informações importantes
3. Usar estrutura diferente quando apropriado
4. Incluir formatação Markdown adequada
5. Gerar um título novo e atraente
6. Criar um excerpt de 2-3 frases

Responda em JSON:
{
  "title": "novo título original",
  "content": "conteúdo reescrito em Markdown",
  "excerpt": "resumo de 2-3 frases"
}`

    const result = await openrouter.generateJSON<{
        title: string
        content: string
        excerpt: string
    }>(prompt, {
        model: MODELS.CLAUDE_SONNET, // Use better model for rewriting
        temperature: 0.7,
        maxTokens: 4000
    })

    return {
        title: result.title || 'Título',
        content: result.content || '',
        excerpt: result.excerpt || '',
        originalLength: config.sourceContent.length,
        newLength: (result.content || '').length,
        similarityEstimate: 0.2 // Estimated low similarity after rewrite
    }
}

/**
 * Adapt content tone
 */
export async function adaptTone(
    content: string,
    fromTone: string,
    toTone: 'professional' | 'casual' | 'formal' | 'friendly'
): Promise<string> {
    const prompt = `Adapte o tom do seguinte texto de "${fromTone}" para "${toTone}":

${content}

Mantenha toda a informação, apenas ajuste o tom e estilo de escrita.
Retorne apenas o texto adaptado em Markdown.`

    return openrouter.generate(prompt, {
        model: MODELS.CLAUDE_HAIKU,
        temperature: 0.5,
        maxTokens: 4000
    })
}

/**
 * Expand content with more details
 */
export async function expandContent(
    content: string,
    sections?: string[]
): Promise<string> {
    const sectionsInfo = sections?.length
        ? `Seções para expandir ou adicionar: ${sections.join(', ')}`
        : 'Expanda onde fizer sentido adicionar mais detalhes'

    const prompt = `Expanda o seguinte conteúdo com mais detalhes e informações:

${content}

${sectionsInfo}

Requisitos:
1. Mantenha a estrutura base
2. Adicione informações relevantes e úteis
3. Não invente dados ou estatísticas
4. Mantenha o tom original
5. Use Markdown para formatação

Retorne o conteúdo expandido.`

    return openrouter.generate(prompt, {
        model: MODELS.CLAUDE_HAIKU,
        temperature: 0.6,
        maxTokens: 6000
    })
}

/**
 * Summarize long content
 */
export async function summarizeContent(
    content: string,
    targetLength: 'short' | 'medium' | 'long' = 'medium'
): Promise<string> {
    const lengthGuide = {
        short: '1-2 parágrafos',
        medium: '3-4 parágrafos',
        long: '5-6 parágrafos mantendo detalhes importantes'
    }

    const prompt = `Resuma o seguinte conteúdo em ${lengthGuide[targetLength]}:

${content}

Mantenha os pontos mais importantes e informações essenciais.
Retorne apenas o resumo.`

    return openrouter.generate(prompt, {
        model: MODELS.CLAUDE_HAIKU,
        temperature: 0.4,
        maxTokens: 2000
    })
}

/**
 * Check content originality (basic check)
 */
export async function checkOriginality(
    content: string,
    sourceContent?: string
): Promise<{
    originalityScore: number
    issues: string[]
    suggestions: string[]
}> {
    const prompt = `Analise a originalidade do seguinte texto${sourceContent ? ' comparado à fonte original' : ''}:

Texto a analisar:
${content.substring(0, 2000)}

${sourceContent ? `Texto fonte (para comparação):\n${sourceContent.substring(0, 2000)}` : ''}

Avalie:
1. Se o texto parece original ou muito similar a conteúdo padrão
2. Se há frases que parecem copiadas
3. Qualidade da reescrita (se for uma versão reescrita)

Responda em JSON:
{
  "originalityScore": 0 a 100,
  "issues": ["problema 1", "problema 2"],
  "suggestions": ["sugestão para melhorar originalidade"]
}`

    return openrouter.generateJSON(prompt, {
        model: MODELS.CLAUDE_HAIKU,
        temperature: 0.2
    })
}

/**
 * Fetch and extract content from URL
 */
export async function fetchContentFromUrl(url: string): Promise<{
    title: string
    content: string
    success: boolean
    error?: string
}> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'EDAShow-Bot/1.0'
            }
        })

        if (!response.ok) {
            return {
                title: '',
                content: '',
                success: false,
                error: `Failed to fetch: ${response.statusText}`
            }
        }

        const html = await response.text()

        // Basic extraction using AI
        const prompt = `Extraia o título e conteúdo principal do seguinte HTML:

${html.substring(0, 8000)}

Ignore menus, sidebars, footers e anúncios.
Retorne apenas o conteúdo editorial principal.

Responda em JSON:
{
  "title": "título do artigo",
  "content": "conteúdo principal do artigo"
}`

        const result = await openrouter.generateJSON<{
            title: string
            content: string
        }>(prompt, {
            model: MODELS.CLAUDE_HAIKU,
            temperature: 0.2,
            maxTokens: 4000
        })

        return {
            title: result.title || '',
            content: result.content || '',
            success: true
        }
    } catch (error) {
        return {
            title: '',
            content: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}
