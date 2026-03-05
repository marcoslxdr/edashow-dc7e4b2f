'use server'

/**
 * AI Post Server Actions
 * Server actions for AI-powered post generation and management
 */

import { revalidatePath } from 'next/cache'
import { sql } from '@/lib/db/client'
import {
    generatePost,
    generateTitles,
    generateExcerpt,
    generateMetaDescription,
    improveContent,
    logGeneration
} from '@/lib/ai/content-generator'
import { suggestKeywords, analyzeTopic, generateContentIdeas } from '@/lib/ai/keyword-planner'
import { categorizeContent, suggestTags } from '@/lib/ai/categorizer'
import { analyzeSEO, optimizeContent, generateOptimizedMeta } from '@/lib/ai/seo-optimizer'
import { rewriteContent } from '@/lib/ai/content-generator'
import { openrouter } from '@/lib/ai/openrouter'

// Types
export interface GeneratePostConfig {
    topic: string
    keywords?: string[]
    tone?: 'professional' | 'casual' | 'formal' | 'friendly'
    wordCount?: number
    additionalInstructions?: string
    model?: string
    autoCategorize?: boolean
}

export interface AIGeneratedPost {
    title: string
    slug: string
    excerpt: string
    content: string
    metaDescription: string
    suggestedTags: string[]
    suggestedCategory?: string
    categoryId?: string
    seoScore?: number
}

/**
 * Check if AI is configured
 */
export async function checkAIConfiguration(): Promise<{
    configured: boolean
    openrouter: boolean
    pexels: boolean
    unsplash: boolean
}> {
    return {
        configured: !!process.env.OPENROUTER_API_KEY,
        openrouter: !!process.env.OPENROUTER_API_KEY,
        pexels: !!process.env.PEXELS_API_KEY,
        unsplash: !!process.env.UNSPLASH_ACCESS_KEY
    }
}

/**
 * Generate a complete post with AI
 */
export async function generateAIPost(config: GeneratePostConfig): Promise<AIGeneratedPost> {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada. Adicione OPENROUTER_API_KEY ao .env')
    }

    // Generate keywords if not provided
    let keywords = config.keywords || []
    if (!keywords.length) {
        const keywordSuggestion = await suggestKeywords(config.topic)
        keywords = [...keywordSuggestion.primary, ...keywordSuggestion.secondary.slice(0, 2)]
    }

    // Generate post content
    const result = await generatePost({
        ...config,
        keywords
    })

    // Log generation
    await logGeneration(
        'post',
        { topic: config.topic, keywords, tone: config.tone },
        { title: result.data.title, wordCount: result.data.content.split(/\s+/).length },
        result.model,
        result.tokensUsed,
        result.cost
    )

    let categoryId: string | undefined

    // Auto-categorize if enabled
    if (config.autoCategorize) {
        const categorization = await categorizeContent(
            result.data.title,
            result.data.content,
            result.data.excerpt
        )
        result.data.suggestedCategory = categorization.category
        categoryId = categorization.categoryId
        result.data.suggestedTags = categorization.tags
    }

    return {
        ...result.data,
        categoryId
    }
}

/**
 * Get keyword suggestions for a topic
 */
export async function getKeywordSuggestions(topic: string, context?: string) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return suggestKeywords(topic, context)
}

/**
 * Analyze a topic for content planning
 */
export async function analyzeContentTopic(topic: string) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return analyzeTopic(topic)
}

/**
 * Get content ideas based on topic
 */
export async function getContentIdeas(topic: string, count?: number) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return generateContentIdeas(topic, count)
}

/**
 * Generate title options
 */
export async function getAITitles(topic: string, keywords: string[], count?: number) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return generateTitles(topic, keywords, count)
}

/**
 * Generate excerpt for existing content
 */
export async function getAIExcerpt(content: string, maxLength?: number) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return generateExcerpt(content, maxLength)
}

/**
 * Auto-categorize content
 */
export async function autoCategorizeContent(title: string, content: string, excerpt?: string) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return categorizeContent(title, content, excerpt)
}

/**
 * Get tag suggestions
 */
export async function getAITags(title: string, content: string, existingTags?: string[]) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return suggestTags(title, content, existingTags)
}

/**
 * Analyze SEO of a post
 */
export async function analyzPostSEO(
    title: string,
    content: string,
    targetKeywords: string[],
    excerpt?: string
) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return analyzeSEO(title, content, targetKeywords, excerpt)
}

/**
 * Optimize content for SEO
 */
export async function optimizePostSEO(content: string, targetKeywords: string[], guidelines?: string) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return optimizeContent(content, targetKeywords, guidelines)
}

/**
 * Generate optimized meta tags
 */
export async function getOptimizedMeta(title: string, content: string, targetKeywords: string[]) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return generateOptimizedMeta(title, content, targetKeywords)
}

/**
 * Improve existing content
 */
export async function improvePostContent(
    content: string,
    type: 'clarity' | 'seo' | 'engagement' | 'grammar'
) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    return improveContent(content, type)
}

/**
 * Rewrite content from external source
 */
export async function rewriteFromSource(config: {
    sourceContent: string
    sourceUrl?: string
    keywords?: string[]
    tone?: 'professional' | 'casual' | 'formal' | 'friendly'
    guidelines?: string
}) {
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada')
    }

    const result = await rewriteContent({
        sourceContent: config.sourceContent,
        tone: config.tone || 'professional',
        instructions: config.guidelines
    })

    // Log generation
    await logGeneration(
        'rewrite',
        { sourceUrl: config.sourceUrl, originalLength: config.sourceContent.length },
        { title: result.title, newLength: result.content.length },
        'anthropic/claude-3.5-sonnet',
        0,
        0
    )

    return {
        ...result,
        newLength: result.content.length,
        originalLength: config.sourceContent.length,
        similarityEstimate: 0
    }
}

/**
 * Fetch content from URL for rewriting
 * @deprecated Use API route /api/ai/fetch-url instead
 */
export async function fetchUrlContent(url: string) {
    throw new Error('Use API route /api/ai/fetch-url instead')
}

/**
 * Schedule a post for publishing
 */
export async function schedulePost(postId: string, scheduledFor: Date) {
    const existing = await sql`SELECT id FROM scheduled_posts WHERE post_id = ${postId} AND status = 'pending' LIMIT 1`
    if (existing && existing.length > 0) {
        await sql`UPDATE scheduled_posts SET scheduled_for = ${scheduledFor.toISOString()} WHERE id = ${existing[0].id}`
    } else {
        await sql`INSERT INTO scheduled_posts (post_id, scheduled_for, status) VALUES (${postId}, ${scheduledFor.toISOString()}, 'pending')`
    }
    revalidatePath('/cms/posts')
    return { success: true }
}

/**
 * Cancel scheduled publication
 */
export async function cancelScheduledPost(postId: string) {
    await sql`UPDATE scheduled_posts SET status = 'cancelled' WHERE post_id = ${postId} AND status = 'pending'`
    revalidatePath('/cms/posts')
    return { success: true }
}

/**
 * Get scheduled posts
 */
export async function getScheduledPosts() {
    return sql`
        SELECT sp.id, sp.scheduled_for, sp.status,
            p.id as post_id, p.title, p.slug, p.excerpt, p.cover_image_url
        FROM scheduled_posts sp
        LEFT JOIN posts p ON p.id = sp.post_id
        WHERE sp.status = 'pending'
        ORDER BY sp.scheduled_for ASC
    ` as Promise<any[]>
}

/**
 * Get AI generation history
 */
export async function getAIGenerationHistory(limit: number = 20) {
    return sql`SELECT * FROM ai_generations ORDER BY created_at DESC LIMIT ${limit}` as Promise<any[]>
}

/**
 * Get AI usage stats
 */
export async function getAIUsageStats() {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const data = await sql`SELECT type, tokens_used, cost_usd FROM ai_generations WHERE created_at >= ${thirtyDaysAgo.toISOString()}`
    const stats = { totalGenerations: data?.length || 0, totalTokens: 0, totalCost: 0, byType: {} as Record<string, number> }
    for (const gen of data || []) {
        stats.totalTokens += gen.tokens_used || 0
        stats.totalCost += parseFloat(String(gen.cost_usd)) || 0
        stats.byType[gen.type] = (stats.byType[gen.type] || 0) + 1
    }
    return stats
}
