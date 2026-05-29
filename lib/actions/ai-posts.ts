'use server'

/**
 * AI Post Server Actions
 * Server actions for AI-powered post generation and management
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
import { assertPostGenerationEnabled } from '@/lib/feature-flags'

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
    gemini: boolean
    pexels: boolean
    unsplash: boolean
}> {
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY
    return {
        configured: hasOpenRouter,
        openrouter: hasOpenRouter,
        gemini: hasOpenRouter, // Gemini models accessed via OpenRouter
        pexels: !!process.env.PEXELS_API_KEY,
        unsplash: !!process.env.UNSPLASH_ACCESS_KEY
    }
}

/**
 * Generate a complete post with AI
 */
export async function generateAIPost(config: GeneratePostConfig): Promise<AIGeneratedPost> {
    assertPostGenerationEnabled()

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
    const supabase = await createClient()

    // Check if already scheduled
    const { data: existing } = await supabase
        .from('scheduled_posts')
        .select('id')
        .eq('post_id', postId)
        .eq('status', 'pending')
        .single()

    if (existing) {
        // Update existing schedule
        const { error } = await supabase
            .from('scheduled_posts')
            .update({ scheduled_for: scheduledFor.toISOString() })
            .eq('id', existing.id)

        if (error) throw error
    } else {
        // Create new schedule
        const { error } = await supabase
            .from('scheduled_posts')
            .insert({
                post_id: postId,
                scheduled_for: scheduledFor.toISOString(),
                status: 'pending'
            })

        if (error) throw error
    }

    revalidatePath('/cms/posts')
    return { success: true }
}

/**
 * Cancel scheduled publication
 */
export async function cancelScheduledPost(postId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('scheduled_posts')
        .update({ status: 'cancelled' })
        .eq('post_id', postId)
        .eq('status', 'pending')

    if (error) throw error

    revalidatePath('/cms/posts')
    return { success: true }
}

/**
 * Get scheduled posts
 */
export async function getScheduledPosts() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('scheduled_posts')
        .select(`
            id,
            scheduled_for,
            status,
            posts (id, title, slug, excerpt, cover_image_url)
        `)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })

    if (error) throw error
    return data || []
}

/**
 * Get AI generation history
 */
export async function getAIGenerationHistory(limit: number = 20) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return data || []
}

/**
 * Get AI usage stats
 */
export async function getAIUsageStats() {
    const supabase = await createClient()

    // Get stats for last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data, error } = await supabase
        .from('ai_generations')
        .select('type, tokens_used, cost_usd, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())

    if (error) throw error

    const stats = {
        totalGenerations: data?.length || 0,
        totalTokens: 0,
        totalCost: 0,
        byType: {} as Record<string, number>
    }

    for (const gen of data || []) {
        stats.totalTokens += gen.tokens_used || 0
        stats.totalCost += parseFloat(String(gen.cost_usd)) || 0
        stats.byType[gen.type] = (stats.byType[gen.type] || 0) + 1
    }

    return stats
}
