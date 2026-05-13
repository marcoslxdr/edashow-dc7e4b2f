/**
 * Content Generator Service
 * Uses OpenRouter (via custom client) to generate post content, titles, excerpts, and meta tags
 */

import { z } from 'zod'
import { openrouter } from './openrouter'
import { createAdminClient } from '@/lib/supabase/server'
import { POST_GENERATION_PROMPT } from './prompts'
import { ContextAssembler } from './context-engine/assembler'

export interface PostGenerationConfig {
    topic: string
    keywords?: string[]
    tone?: 'professional' | 'casual' | 'formal' | 'friendly'
    personaId?: string
    wordCount?: number
    additionalInstructions?: string
    model?: string
    includeBrandVoice?: boolean
    includeSeoRules?: boolean
}

export interface GeneratedPost {
    title: string
    slug: string
    excerpt: string
    content: string
    metaDescription: string
    suggestedTags: string[]
    suggestedCategory?: string
}

interface GenerationResult {
    data: GeneratedPost
    tokensUsed: number
    model: string
    cost: number
}

const GeneratedPostSchema = z.object({
    title: z.string(),
    excerpt: z.string().optional(),
    content: z.string().optional(),
    metaDescription: z.string().optional(),
    suggestedTags: z.array(z.string()).optional(),
    suggestedCategory: z.string().optional(),
})

const TitlesSchema = z.object({
    titles: z.array(z.string()),
})

function fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '')
    }
    return result
}

function cleanJsonString(text: string): string {
    return text.replace(/^```json\s*/g, '').replace(/\s*```$/g, '').trim()
}

function getModel(model?: string): string {
    return model || process.env.OPENROUTER_POST_MODEL || process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash'
}

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
}

function normalizeObject(obj: any): any {
    if (obj.body && !obj.content) obj.content = obj.body
    if (obj.text && !obj.content) obj.content = obj.text
    if (obj.tags && !obj.suggestedTags) obj.suggestedTags = obj.tags
    if (obj.category && !obj.suggestedCategory) obj.suggestedCategory = obj.category
    return obj
}

async function generateJSONWithSchema<T>(schema: z.ZodType<T>, systemPrompt: string, userPrompt: string, model: string): Promise<{ object: T; usage: any }> {
    const content = await openrouter.generate(userPrompt, {
        systemPrompt: systemPrompt + '\nIMPORTANTE: Escapes caracteres especiais corretamente no JSON (quebras de linha como \\n, aspas como \\").',
        model,
        maxTokens: 8000,
        temperature: 0.7,
        jsonMode: true,
    })

    let parsed: any
    const cleaned = cleanJsonString(content)
    try {
        parsed = JSON.parse(cleaned)
    } catch (e1) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            let fixed = jsonMatch[0]
            fixed = fixed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            fixed = fixed.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
            try {
                parsed = JSON.parse(fixed)
            } catch (e2) {
                const msg = e2 instanceof Error ? e2.message : 'erro desconhecido'
                throw new Error(`Falha ao gerar JSON: ${msg}`)
            }
        } else {
            throw new Error('Falha ao gerar JSON: resposta inválida da IA')
        }
    }

    const normalized = normalizeObject(parsed)
    try {
        const object = schema.parse(normalized)
        return { object, usage: { totalTokens: 0 } }
    } catch (err: any) {
        console.error('[generateJSONWithSchema] schema validation error:', parsed)
        throw new Error(`Falha ao validar JSON: ${err?.message}`)
    }
}

export async function generatePost(config: PostGenerationConfig): Promise<GenerationResult> {
    const prompt = fillTemplate(POST_GENERATION_PROMPT, {
        topic: config.topic,
        keywords: config.keywords?.join(', ') || '',
        instructions: config.additionalInstructions || ''
    })

    const model = getModel(config.model)

    const systemPrompt = await ContextAssembler.buildSystemPrompt({
        personaId: config.personaId || 'eda-pro',
        includeBrandVoice: config.includeBrandVoice ?? true,
        includeSeoRules: config.includeSeoRules ?? true,
        customInstructions: config.additionalInstructions
    })

    const { object, usage } = await generateJSONWithSchema(GeneratedPostSchema, systemPrompt, prompt, model)

    const slug = generateSlug(object.title)

    return {
        data: {
            title: object.title,
            slug,
            excerpt: object.excerpt || '',
            content: object.content || '',
            metaDescription: object.metaDescription || '',
            suggestedTags: object.suggestedTags || [],
            suggestedCategory: object.suggestedCategory
        },
        tokensUsed: usage?.totalTokens || 0,
        model,
        cost: 0
    }
}

export async function generateTitles(topic: string, keywords: string[], count: number = 5): Promise<string[]> {
    const prompt = `Gere ${count} opções de títulos otimizados para SEO para: ${topic}
    Palavras-chave: ${keywords.join(', ')}`

    const { object } = await generateJSONWithSchema(TitlesSchema, 'Responda estritamente com JSON.', prompt, getModel())

    return object.titles
}

export async function generateExcerpt(content: string, maxLength: number = 160): Promise<string> {
    return openrouter.generate(
        `Resuma o texto abaixo em até ${maxLength} caracteres:\n\n${content.substring(0, 2000)}`,
        { systemPrompt: 'Responda apenas com o resumo.', model: getModel(), maxTokens: 300 }
    )
}

export async function generateMetaDescription(title: string, content: string, keywords: string[]): Promise<string> {
    return openrouter.generate(
        `Meta description SEO para "${title}". Keywords: ${keywords.join(', ')}.\nConteúdo: ${content.substring(0, 500)}`,
        { systemPrompt: 'Responda apenas com a meta description (max 160 chars).', model: getModel(), maxTokens: 200 }
    )
}

export async function improveContent(content: string, type: 'clarity' | 'seo' | 'engagement' | 'grammar'): Promise<string> {
    const instructions: Record<string, string> = {
        clarity: 'Melhore a clareza e fluidez do texto.',
        seo: 'Otimize para SEO com subtítulos e listas.',
        engagement: 'Torne o texto mais envolvente.',
        grammar: 'Corrija erros gramaticais.'
    }

    return openrouter.generate(
        `${instructions[type]}\n\nTexto: ${content}`,
        { model: getModel(), maxTokens: 4000 }
    )
}

export async function rewriteContent(config: {
    sourceContent: string
    tone: string
    instructions?: string
}): Promise<GeneratedPost> {
    const prompt = `Reescreva o seguinte conteúdo para o blog EDA Show.
    
    Conteúdo Original:
    ${config.sourceContent}
    
    Instruções:
    - Tom: ${config.tone}
    - ${config.instructions || ''}
    - Mantenha os fatos principais
    - Torne o texto original e livre de plágio`

    const { object } = await generateJSONWithSchema(
        GeneratedPostSchema,
        'Você é um editor experiente. Responda estritamente com JSON puro.',
        prompt,
        getModel()
    )

    const slug = generateSlug(object.title)

    return { ...object, slug }
}

/**
 * Log generation to database for tracking
 */
export async function logGeneration(
    type: string,
    inputData: Record<string, unknown>,
    outputData: Record<string, unknown>,
    model: string,
    tokensUsed: number,
    costUsd: number
): Promise<void> {
    try {
        const supabase = createAdminClient()
        await supabase.from('ai_generations').insert({
            type,
            input_data: inputData,
            output_data: outputData,
            model_used: model,
            tokens_used: tokensUsed,
            cost_usd: costUsd,
            status: 'completed'
        })
    } catch (error) {
        console.error('Failed to log AI generation:', error)
    }
}
