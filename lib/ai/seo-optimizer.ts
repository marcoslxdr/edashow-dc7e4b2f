/**
 * SEO Optimizer Service
 * Analyzes and optimizes content for search engine optimization
 */

import { opencode, MODELS } from './opencode'

export interface SEOAnalysis {
    score: number
    issues: SEOIssue[]
    suggestions: string[]
    readabilityScore: number
    keywordDensity: Record<string, number>
}

export interface SEOIssue {
    type: 'error' | 'warning' | 'info'
    message: string
    fix?: string
}

export interface OptimizedMeta {
    title: string
    description: string
    ogTitle: string
    ogDescription: string
    keywords: string[]
}

/**
 * Analyze content for SEO
 */
export async function analyzeSEO(
    title: string,
    content: string,
    targetKeywords: string[],
    excerpt?: string
): Promise<SEOAnalysis> {
    const prompt = `Analise o seguinte conteúdo para SEO:

Título: ${title}
${excerpt ? `Meta description atual: ${excerpt}` : ''}
Palavras-chave alvo: ${targetKeywords.join(', ')}

Conteúdo:
${content.substring(0, 3000)}

Analise:
1. Uso das palavras-chave (densidade e posicionamento)
2. Estrutura de headings (H1, H2, H3)
3. Tamanho do título e meta description
4. Legibilidade do texto
5. Links internos/externos (se mencionados)
6. Formatação geral

Responda em JSON:
{
  "score": 0 a 100,
  "issues": [
    {
      "type": "error ou warning ou info",
      "message": "descrição do problema",
      "fix": "como corrigir"
    }
  ],
  "suggestions": ["sugestão de melhoria 1", "sugestão 2"],
  "readabilityScore": 0 a 100,
  "keywordDensity": {
    "palavra-chave": 0.5
  }
}`

    return opencode.generateJSON<SEOAnalysis>(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.3
    })
}

/**
 * Optimize content for SEO
 */
export async function optimizeContent(
    content: string,
    targetKeywords: string[],
    guidelines?: string
): Promise<string> {
    const prompt = `Otimize o seguinte conteúdo para SEO, mantendo a naturalidade:

Palavras-chave alvo: ${targetKeywords.join(', ')}
${guidelines ? `Diretrizes adicionais: ${guidelines}` : ''}

Conteúdo original:
${content}

Faça:
1. Inclua palavras-chave naturalmente (sem keyword stuffing)
2. Melhore a estrutura com subtítulos H2/H3 quando apropriado
3. Quebre parágrafos muito longos
4. Adicione listas quando fizer sentido
5. Mantenha o tom e informação original

Retorne apenas o conteúdo otimizado em Markdown.`

    return opencode.generate(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.5,
        maxTokens: 4000
    })
}

/**
 * Generate optimized meta tags
 */
export async function generateOptimizedMeta(
    title: string,
    content: string,
    targetKeywords: string[]
): Promise<OptimizedMeta> {
    const prompt = `Gere meta tags otimizadas para SEO:

Título atual: ${title}
Palavras-chave: ${targetKeywords.join(', ')}
Conteúdo (início): ${content.substring(0, 1500)}

Requisitos:
- Title: 50-60 caracteres, inclua palavra-chave principal
- Description: 150-160 caracteres, atraente e descritiva
- OG Title: pode ser ligeiramente diferente, mais atraente para redes sociais
- OG Description: adaptada para compartilhamento social

Responda em JSON:
{
  "title": "título SEO otimizado",
  "description": "meta description",
  "ogTitle": "título para Open Graph",
  "ogDescription": "descrição para Open Graph",
  "keywords": ["palavras-chave relevantes"]
}`

    return opencode.generateJSON<OptimizedMeta>(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.5
    })
}

/**
 * Suggest internal links
 */
export async function suggestInternalLinks(
    content: string,
    availablePosts: Array<{ title: string; slug: string; excerpt?: string }>
): Promise<Array<{ anchor: string; targetSlug: string; reason: string }>> {
    if (availablePosts.length === 0) return []

    const postsInfo = availablePosts
        .slice(0, 20) // Limit to avoid token overflow
        .map(p => `- ${p.title} (/posts/${p.slug})${p.excerpt ? `: ${p.excerpt.substring(0, 50)}` : ''}`)
        .join('\n')

    const prompt = `Sugira links internos para o seguinte conteúdo:

Conteúdo:
${content.substring(0, 2000)}

Posts disponíveis para linkar:
${postsInfo}

Identifique até 5 oportunidades de link interno onde faz sentido contextual.

Responda em JSON:
{
  "links": [
    {
      "anchor": "texto âncora sugerido",
      "targetSlug": "slug-do-post",
      "reason": "por que faz sentido linkar aqui"
    }
  ]
}`

    const result = await opencode.generateJSON<{
        links: Array<{ anchor: string; targetSlug: string; reason: string }>
    }>(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.4
    })

    return result.links || []
}

/**
 * Check for duplicate content
 */
export async function checkDuplicateContent(
    newContent: string,
    existingContents: string[]
): Promise<{
    isDuplicate: boolean
    similarityScore: number
    mostSimilarIndex?: number
}> {
    if (existingContents.length === 0) {
        return { isDuplicate: false, similarityScore: 0 }
    }

    const prompt = `Compare o novo conteúdo com os existentes e identifique se há duplicidade:

Novo conteúdo:
${newContent.substring(0, 1000)}

Conteúdos existentes:
${existingContents.map((c, i) => `[${i}]: ${c.substring(0, 500)}`).join('\n\n')}

Responda em JSON:
{
  "isDuplicate": true ou false (se > 50% similar),
  "similarityScore": 0 a 100,
  "mostSimilarIndex": índice do mais similar (ou null)
}`

    return opencode.generateJSON(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.2
    })
}

/**
 * Generate alt text for images
 */
export async function generateAltText(
    imageContext: string,
    surroundingText?: string
): Promise<string> {
    const prompt = `Gere um texto alternativo (alt text) para uma imagem:

Contexto da imagem: ${imageContext}
${surroundingText ? `Texto ao redor: ${surroundingText.substring(0, 200)}` : ''}

Requisitos:
- Descritivo e conciso (máximo 125 caracteres)
- Inclua palavras-chave relevantes quando natural
- Descreva o que a imagem mostra
- Seja útil para leitores de tela

Responda apenas com o alt text.`

    return opencode.generate(prompt, {
        maxTokens: 50,
        temperature: 0.3
    })
}

/**
 * Generate FAQ schema from content
 */
export async function generateFAQ(content: string): Promise<Array<{
    question: string
    answer: string
}>> {
    const prompt = `Extraia ou gere perguntas frequentes (FAQ) baseadas no conteúdo:

${content.substring(0, 2500)}

Gere até 5 perguntas e respostas relevantes que poderiam ser buscadas.

Responda em JSON:
{
  "faq": [
    {
      "question": "Pergunta?",
      "answer": "Resposta concisa."
    }
  ]
}`

    const result = await opencode.generateJSON<{
        faq: Array<{ question: string; answer: string }>
    }>(prompt, {
        model: MODELS.DEEPSEEK_V4_FLASH,
        temperature: 0.5
    })

    return result.faq || []
}
