/**
 * Content Generator Service (Vercel AI SDK Version)
 * Uses OpenRouter to generate post content, titles, excerpts, and meta tags
 */

import { generateObject, generateText } from 'ai'
import { z } from 'zod'
import { openrouter, DEFAULT_MODEL, PREMIUM_MODEL } from './vercel-ai'
import { sql } from '@/lib/db/client'
import { POST_GENERATION_PROMPT } from './prompts'
import { ContextAssembler } from './context-engine/assembler'

export interface PostGenerationConfig {
    topic: string
    keywords?: string[]
    tone?: 'professional' | 'casual' | 'formal' | 'friendly' // Deprecated in favor of personaId
    personaId?: string // 'eda-raiz' | 'eda-pro'
    wordCount?: number
    additionalInstructions?: string
    model?: string
    // Context Flags
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

// Schemas
const GeneratedPostSchema = z.object({
    title: z.string().describe('Título otimizado para SEO'),
    excerpt: z.string().describe('Resumo curto para redes sociais (max 160 chars)'),
    content: z.string().describe('Conteúdo completo em Markdown'),
    metaDescription: z.string().describe('Meta descrição SEO'),
    suggestedTags: z.array(z.string()).describe('Lista de 5 tags relevantes'),
    suggestedCategory: z.string().optional().describe('Categoria sugerida para o post')
})

const TitlesSchema = z.object({
    titles: z.array(z.string())
})

/**
 * Replace template variables with actual values
 */
function fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '')
    }
    return result
}

/**
 * Helper to clean JSON string from Markdown code blocks
 */
function cleanJsonString(text: string): string {
    return text.replace(/^```json\s*/g, '').replace(/\s*```$/g, '').trim();
}

/**
 * Helper to generate object resiliently using generateText and manual parse if needed
 */
async function generateResilientObject<T = any>(options: any): Promise<{ object: T, usage: any }> {
    try {
        // First try standard object generation
        const result = await generateObject(options);
        return { object: result.object as T, usage: result.usage };
    } catch (error: any) {
        // If JSON parse fails (often due to markdown blocks), try generating text and parsing manually
        if (error.name === 'AI_JSONParseError' || error.name === 'AI_NoObjectGeneratedError') {
            console.warn('Standard object generation failed, trying fallback text generation...');
            
            const { text, usage } = await generateText({
                ...options,
                prompt: options.prompt + "\n\nIMPORTANT: Return ONLY valid JSON. Do not use markdown blocks.",
            });

            try {
                const cleaned = cleanJsonString(text);
                const object = JSON.parse(cleaned);
                
                // Normalize common field variations from AI
                if (object.body && !object.content) object.content = object.body;
                if (object.text && !object.content) object.content = object.text;
                if (object.tags && !object.suggestedTags) object.suggestedTags = object.tags;
                if (object.category && !object.suggestedCategory) object.suggestedCategory = object.category;

                return { object, usage };
            } catch (parseError) {
                console.error('Fallback parsing failed:', text);
                throw error; // Throw original error if fallback also fails
            }
        }
        throw error;
    }
}

/**
 * Generate a complete blog post
 */
export async function generatePost(config: PostGenerationConfig): Promise<GenerationResult> {
    const prompt = fillTemplate(POST_GENERATION_PROMPT, {
        topic: config.topic,
        keywords: config.keywords?.join(', ') || '',
        instructions: config.additionalInstructions || ''
    })

    const model = config.model || DEFAULT_MODEL
    
    // Use Runtime Context Engine
    const systemPrompt = await ContextAssembler.buildSystemPrompt({
        personaId: config.personaId || 'eda-pro',
        includeBrandVoice: config.includeBrandVoice ?? true, // Default to true
        includeSeoRules: config.includeSeoRules ?? true,     // Default to true
        customInstructions: config.additionalInstructions
    });
    
    // Use resilient generation
    const { object, usage } = await generateResilientObject<z.infer<typeof GeneratedPostSchema>>({
        model: openrouter(model),
        schema: GeneratedPostSchema,
        prompt: prompt,
        system: systemPrompt,
        temperature: 0.7
    })


    // Generate slug from title
    const slug = object.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

    return {
        data: {
            title: object.title,
            slug,
            excerpt: object.excerpt,
            content: object.content,
            metaDescription: object.metaDescription,
            suggestedTags: object.suggestedTags,
            suggestedCategory: object.suggestedCategory
        },
        tokensUsed: usage?.totalTokens || 0,
        model: model,
        cost: 0 
    }
}

/**
 * Generate multiple title options for SEO
 */
export async function generateTitles(
    topic: string,
    keywords: string[],
    count: number = 5
): Promise<string[]> {
    const prompt = `Gere ${count} opções de títulos otimizados para SEO para: ${topic}
    Palavras-chave: ${keywords.join(', ')}`

    const { object } = await generateResilientObject<z.infer<typeof TitlesSchema>>({
        model: openrouter(DEFAULT_MODEL),
        schema: TitlesSchema,
        prompt: prompt
    })

    return object.titles
}

/**
 * Generate an excerpt from content
 */
export async function generateExcerpt(content: string, maxLength: number = 160): Promise<string> {
    const { text } = await generateText({
        model: openrouter(DEFAULT_MODEL),
        prompt: `Resuma o texto abaixo em até ${maxLength} caracteres:\n\n${content.substring(0, 2000)}`,
        system: "Responda apenas com o resumo."
    })
    return text
}

/**
 * Generate SEO-optimized meta description
 */
export async function generateMetaDescription(
    title: string,
    content: string,
    keywords: string[]
): Promise<string> {
    const { text } = await generateText({
        model: openrouter(DEFAULT_MODEL),
        prompt: `Meta description SEO para "${title}". Keywords: ${keywords.join(', ')}.\nConteúdo: ${content.substring(0, 500)}`,
        system: "Responda apenas com a meta description (max 160 chars)."
    })
    return text
}

/**
 * Improve existing content with AI suggestions
 */
export async function improveContent(
    content: string,
    type: 'clarity' | 'seo' | 'engagement' | 'grammar'
): Promise<string> {
    const instructions = {
        clarity: 'Melhore a clareza e fluidez do texto.',
        seo: 'Otimize para SEO com subtítulos e listas.',
        engagement: 'Torne o texto mais envolvente.',
        grammar: 'Corrija erros gramaticais.'
    }

    const { text } = await generateText({
        model: openrouter(DEFAULT_MODEL),
        prompt: `${instructions[type]}\n\nTexto: ${content}`
    })
    
    return text
}

/**
 * Rewrite content from external source
 */
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

    const { object } = await generateResilientObject<z.infer<typeof GeneratedPostSchema>>({
        model: openrouter(PREMIUM_MODEL),
        schema: GeneratedPostSchema,
        prompt: prompt,
        system: "Você é um editor experiente. IMPORTANTE: Responda estritamente com o objeto JSON puro."
    })

    // Generate slug from title
    const slug = object.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

    return {
        ...object,
        slug
    }
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
        await sql`INSERT INTO ai_generations (type, input_data, output_data, model_used, tokens_used, cost_usd, status) VALUES (${type}, ${JSON.stringify(inputData)}, ${JSON.stringify(outputData)}, ${model}, ${tokensUsed}, ${costUsd}, 'completed')`
    } catch (error) {
        console.error('Failed to log AI generation:', error)
    }
}
