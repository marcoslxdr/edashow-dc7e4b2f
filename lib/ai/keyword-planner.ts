/**
 * Keyword Planner Service
 * Suggests keywords and analyzes topics for SEO optimization
 */

import { z } from 'zod'
import { opencode, getPostModel, getFastModel } from './opencode'

function getModel(model?: string): string {
    return model ? getPostModel(model) : getFastModel()
}

export interface KeywordSuggestion {
    primary: string[]
    secondary: string[]
    longTail: string[]
}

const KeywordSuggestionSchema = z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()),
    longTail: z.array(z.string()),
})

/**
 * Suggest keywords for a topic
 */
export async function suggestKeywords(
    topic: string,
    context?: string
): Promise<KeywordSuggestion> {
    const prompt = `Analise o seguinte tópico e sugira palavras-chave relevantes para SEO em português brasileiro.

Tópico: ${topic}
${context ? `Contexto: ${context}` : ''}

Considere:
- Palavras-chave que pessoas buscariam no Google
- Variações e sinônimos
- Palavras-chave de cauda longa (long-tail) mais específicas

Responda estritamente com um objeto JSON contendo:
- "primary": array de até 3 palavras-chave principais
- "secondary": array de até 5 palavras-chave secundárias
- "longTail": array de até 5 palavras-chave de cauda longa`

    const content = await opencode.generate(prompt, {
        systemPrompt: "Você é um especialista em SEO. Responda estritamente com JSON.",
        model: getModel(),
        jsonMode: true,
    })

    const cleaned = content.replace(/^```json\s*/g, '').replace(/\s*```$/g, '').trim()
    const parsed = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned)
    return KeywordSuggestionSchema.parse(parsed)
}

// ... rest of the file ...

const TopicAnalysisSchema = z.object({
    mainTopic: z.string(),
    relatedTopics: z.array(z.string()),
    searchIntent: z.enum(['informational', 'navigational', 'transactional', 'commercial']),
    difficulty: z.enum(['low', 'medium', 'high']),
    suggestedAngle: z.string()
})

const ContentIdeaSchema = z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
    type: z.enum(['article', 'guide', 'listicle', 'how-to', 'news'])
})

const ContentIdeasResponseSchema = z.object({
    ideas: z.array(ContentIdeaSchema)
})

export interface TopicAnalysis extends z.infer<typeof TopicAnalysisSchema> {}
export interface ContentIdea extends z.infer<typeof ContentIdeaSchema> {}

/**
 * Analyze a topic for content strategy
 */
export async function analyzeTopic(topic: string): Promise<TopicAnalysis> {
    const content = await opencode.generate(
        `Analise o seguinte tópico para estratégia de conteúdo: ${topic}

Responda com JSON contendo:
- "mainTopic": string, o tópico principal
- "relatedTopics": array de strings, tópicos relacionados
- "searchIntent": "informational" | "navigational" | "transactional" | "commercial"
- "difficulty": "low" | "medium" | "high"
- "suggestedAngle": string, abordagem sugerida`,
        { systemPrompt: "Você é um estrategista de conteúdo SEO.", model: getModel(), jsonMode: true }
    )
    const cleaned = content.replace(/^```json\s*/g, '').replace(/\s*```$/g, '').trim()
    return TopicAnalysisSchema.parse(JSON.parse(cleaned))
}

/**
 * Generate content ideas based on a main topic
 */
export async function generateContentIdeas(
    topic: string,
    count: number = 5
): Promise<ContentIdea[]> {
    const prompt = `Gere ${count} ideias de conteúdo para o portal EDA Show sobre: ${topic}
    Para cada ideia, considere diferentes formatos e ângulos únicos.

Responda com JSON contendo:
- "ideas": array de objetos, cada um com:
  - "title": string
  - "description": string
  - "keywords": array de strings
  - "type": "article" | "guide" | "listicle" | "how-to" | "news"`

    const content = await opencode.generate(prompt, {
        systemPrompt: "Você é um editor criativo.",
        model: getModel(),
        jsonMode: true,
    })
    const cleaned = content.replace(/^```json\s*/g, '').replace(/\s*```$/g, '').trim()
    const object = ContentIdeasResponseSchema.parse(JSON.parse(cleaned))
    return object.ideas
}

// Removing legacy/unused functions for simplicity in this migration
// analyzeKeywordCompetition, suggestRelatedTopics, extractKeywords can be refactored later if needed
