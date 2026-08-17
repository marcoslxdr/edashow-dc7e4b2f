'use server'

/**
 * AI Settings Server Actions
 * CRUD operations for AI configuration, persona, and prompts
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireCmsRole, requireAdmin } from './cms-authz'

// Types
export interface PersonaConfig {
    persona_description: string
    writing_style: string
    vocabulary_examples: string[]
    avoid_phrases: string[]
}

export interface AIPrompt {
    id?: string
    name: string
    category: string
    prompt_template: string
    description?: string
    is_active: boolean
}

export interface AISetting {
    setting_key: string
    setting_value: any
}

/**
 * Get all AI settings
 */
export async function getAISettings(): Promise<Record<string, any>> {
    await requireCmsRole()
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('ai_settings')
        .select('setting_key, setting_value')

    if (error) {
        console.error('Error fetching AI settings:', error)
        return {}
    }

    const settings: Record<string, any> = {}
    for (const item of data || []) {
        try {
            settings[item.setting_key] = typeof item.setting_value === 'string'
                ? JSON.parse(item.setting_value)
                : item.setting_value
        } catch {
            settings[item.setting_key] = item.setting_value
        }
    }

    return settings
}

/**
 * Get a single AI setting
 */
export async function getAISetting(key: string): Promise<any> {
    await requireCmsRole()
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('ai_settings')
        .select('setting_value')
        .eq('setting_key', key)
        .single()

    if (error || !data) {
        return null
    }

    try {
        return typeof data.setting_value === 'string'
            ? JSON.parse(data.setting_value)
            : data.setting_value
    } catch {
        return data.setting_value
    }
}

/**
 * Update or create an AI setting
 */
export async function updateAISetting(key: string, value: any): Promise<{ success: boolean; error?: string }> {
    await requireAdmin()
    const supabase = await createClient()

    const settingValue = typeof value === 'string' ? value : JSON.stringify(value)

    const { error } = await supabase
        .from('ai_settings')
        .upsert({
            setting_key: key,
            setting_value: settingValue,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'setting_key'
        })

    if (error) {
        console.error('Error updating AI setting:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/cms/ia')
    return { success: true }
}

/**
 * Get persona configuration
 */
export async function getPersonaConfig(): Promise<PersonaConfig> {
    await requireCmsRole()
    const settings = await getAISettings()

    return {
        persona_description: settings.persona_description || 'Você é um redator especialista em saúde e odontologia para o portal EDA Show.',
        writing_style: settings.writing_style || 'informativo e acessível',
        vocabulary_examples: settings.vocabulary_examples || [],
        avoid_phrases: settings.avoid_phrases || []
    }
}

/**
 * Update persona configuration
 */
export async function updatePersonaConfig(config: Partial<PersonaConfig>): Promise<{ success: boolean; error?: string }> {
    await requireAdmin()
    const updates = Object.entries(config)
    let lastError: string | undefined

    for (const [key, value] of updates) {
        const result = await updateAISetting(key, value)
        if (!result.success) {
            lastError = result.error
        }
    }

    if (lastError) {
        return { success: false, error: lastError }
    }

    return { success: true }
}

/**
 * Get AI prompts by category
 */
export async function getAIPrompts(category?: string): Promise<AIPrompt[]> {
    await requireCmsRole()
    const supabase = await createClient()

    let query = supabase
        .from('ai_prompts')
        .select('*')
        .order('created_at', { ascending: false })

    if (category) {
        query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching AI prompts:', error)
        return []
    }

    return data || []
}

/**
 * Get active prompt by category and name
 */
export async function getActivePrompt(category: string, name: string): Promise<AIPrompt | null> {
    await requireCmsRole()
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('ai_prompts')
        .select('*')
        .eq('category', category)
        .eq('name', name)
        .eq('is_active', true)
        .single()

    if (error || !data) {
        return null
    }

    return data
}

/**
 * Save an AI prompt (create or update)
 */
export async function saveAIPrompt(prompt: AIPrompt): Promise<{ success: boolean; id?: string; error?: string }> {
    await requireAdmin()
    const supabase = await createClient()

    if (prompt.id) {
        // Update existing prompt
        const { error } = await supabase
            .from('ai_prompts')
            .update({
                name: prompt.name,
                category: prompt.category,
                prompt_template: prompt.prompt_template,
                description: prompt.description,
                is_active: prompt.is_active,
                updated_at: new Date().toISOString()
            })
            .eq('id', prompt.id)

        if (error) {
            console.error('Error updating AI prompt:', error)
            return { success: false, error: error.message }
        }

        revalidatePath('/cms/ia')
        return { success: true, id: prompt.id }
    } else {
        // Create new prompt
        const { data, error } = await supabase
            .from('ai_prompts')
            .insert({
                name: prompt.name,
                category: prompt.category,
                prompt_template: prompt.prompt_template,
                description: prompt.description,
                is_active: prompt.is_active
            })
            .select('id')
            .single()

        if (error) {
            console.error('Error creating AI prompt:', error)
            return { success: false, error: error.message }
        }

        revalidatePath('/cms/ia')
        return { success: true, id: data?.id }
    }
}

/**
 * Delete an AI prompt
 */
export async function deleteAIPrompt(id: string): Promise<{ success: boolean; error?: string }> {
    await requireAdmin()
    const supabase = await createClient()

    const { error } = await supabase
        .from('ai_prompts')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting AI prompt:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/cms/ia')
    return { success: true }
}

/**
 * Get available AI models
 */
export async function getAvailableModels(): Promise<Array<{ id: string; name: string; description: string }>> {
    await requireCmsRole()
    return [
        { id: 'kimi-k2.6', name: 'Kimi K2.6', description: 'Melhor para posts longos em PT-BR' },
        { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', description: 'Otimizado para conteúdo estruturado' },
        { id: 'glm-5.2', name: 'GLM 5.2', description: 'Equilíbrio qualidade/custo' },
        { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', description: 'Rápido e econômico' },
        { id: 'mimo-v2.5', name: 'MiMo V2.5', description: 'Máximo volume, baixo custo' },
        { id: 'glm-5.1', name: 'GLM 5.1', description: 'Alternativa GLM' },
    ]
}

/**
 * Get AI usage statistics
 */
export async function getAIUsageStats(days: number = 30): Promise<{
    totalGenerations: number
    totalTokens: number
    totalCost: number
    byType: Record<string, number>
    byDay: Array<{ date: string; count: number; tokens: number }>
}> {
    await requireCmsRole()
    const supabase = await createClient()

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
        .from('ai_generations')
        .select('type, tokens_used, cost_usd, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching AI usage stats:', error)
        return {
            totalGenerations: 0,
            totalTokens: 0,
            totalCost: 0,
            byType: {},
            byDay: []
        }
    }

    const stats = {
        totalGenerations: data?.length || 0,
        totalTokens: 0,
        totalCost: 0,
        byType: {} as Record<string, number>,
        byDay: [] as Array<{ date: string; count: number; tokens: number }>
    }

    const dayMap: Record<string, { count: number; tokens: number }> = {}

    for (const gen of data || []) {
        stats.totalTokens += gen.tokens_used || 0
        stats.totalCost += parseFloat(String(gen.cost_usd)) || 0
        stats.byType[gen.type] = (stats.byType[gen.type] || 0) + 1

        const dateKey = new Date(gen.created_at).toISOString().split('T')[0]
        if (!dayMap[dateKey]) {
            dayMap[dateKey] = { count: 0, tokens: 0 }
        }
        dayMap[dateKey].count++
        dayMap[dateKey].tokens += gen.tokens_used || 0
    }

    stats.byDay = Object.entries(dayMap).map(([date, data]) => ({
        date,
        count: data.count,
        tokens: data.tokens
    }))

    return stats
}

/**
 * Get prompt categories
 */
export async function getPromptCategories(): Promise<string[]> {
    await requireCmsRole()
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('ai_prompts')
        .select('category')

    if (error) {
        console.error('Error fetching prompt categories:', error)
        return ['post', 'rewrite', 'seo', 'newsletter']
    }

    const categories = new Set<string>()
    for (const item of data || []) {
        if (item.category) {
            categories.add(item.category)
        }
    }

    // Add default categories if not present
    const defaults = ['post', 'rewrite', 'seo', 'newsletter']
    for (const cat of defaults) {
        categories.add(cat)
    }

    return Array.from(categories).sort()
}
