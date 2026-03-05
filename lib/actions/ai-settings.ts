'use server'

import { sql } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'

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

export async function getAISettings(): Promise<Record<string, any>> {
    try {
        const data = await sql`SELECT setting_key, setting_value FROM ai_settings`
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
    } catch {
        return {}
    }
}

export async function getAISetting(key: string): Promise<any> {
    try {
        const rows = await sql`SELECT setting_value FROM ai_settings WHERE setting_key = ${key} LIMIT 1`
        if (!rows || rows.length === 0) return null
        const val = rows[0].setting_value
        try { return typeof val === 'string' ? JSON.parse(val) : val } catch { return val }
    } catch { return null }
}

export async function updateAISetting(key: string, value: any): Promise<{ success: boolean; error?: string }> {
    try {
        const settingValue = typeof value === 'string' ? value : JSON.stringify(value)
        await sql`
            INSERT INTO ai_settings (setting_key, setting_value, updated_at)
            VALUES (${key}, ${settingValue}, NOW())
            ON CONFLICT (setting_key) DO UPDATE SET setting_value = ${settingValue}, updated_at = NOW()
        `
        revalidatePath('/cms/ia')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getPersonaConfig(): Promise<PersonaConfig> {
    const settings = await getAISettings()
    return {
        persona_description: settings.persona_description || 'Você é um redator especialista em saúde e odontologia para o portal EDA Show.',
        writing_style: settings.writing_style || 'informativo e acessível',
        vocabulary_examples: settings.vocabulary_examples || [],
        avoid_phrases: settings.avoid_phrases || []
    }
}

export async function updatePersonaConfig(config: Partial<PersonaConfig>): Promise<{ success: boolean; error?: string }> {
    let lastError: string | undefined
    for (const [key, value] of Object.entries(config)) {
        const result = await updateAISetting(key, value)
        if (!result.success) lastError = result.error
    }
    return lastError ? { success: false, error: lastError } : { success: true }
}

export async function getAIPrompts(category?: string): Promise<AIPrompt[]> {
    try {
        let data
        if (category) {
            data = await sql`SELECT * FROM ai_prompts WHERE category = ${category} ORDER BY created_at DESC`
        } else {
            data = await sql`SELECT * FROM ai_prompts ORDER BY created_at DESC`
        }
        return data || []
    } catch { return [] }
}

export async function getActivePrompt(category: string, name: string): Promise<AIPrompt | null> {
    try {
        const rows = await sql`SELECT * FROM ai_prompts WHERE category = ${category} AND name = ${name} AND is_active = true LIMIT 1`
        return rows[0] || null
    } catch { return null }
}

export async function saveAIPrompt(prompt: AIPrompt): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        if (prompt.id) {
            await sql`
                UPDATE ai_prompts SET name = ${prompt.name}, category = ${prompt.category},
                    prompt_template = ${prompt.prompt_template}, description = ${prompt.description || null},
                    is_active = ${prompt.is_active}, updated_at = NOW()
                WHERE id = ${prompt.id}
            `
            revalidatePath('/cms/ia')
            return { success: true, id: prompt.id }
        } else {
            const rows = await sql`
                INSERT INTO ai_prompts (name, category, prompt_template, description, is_active)
                VALUES (${prompt.name}, ${prompt.category}, ${prompt.prompt_template}, ${prompt.description || null}, ${prompt.is_active})
                RETURNING id
            `
            revalidatePath('/cms/ia')
            return { success: true, id: rows[0]?.id }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteAIPrompt(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await sql`DELETE FROM ai_prompts WHERE id = ${id}`
        revalidatePath('/cms/ia')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getAvailableModels(): Promise<Array<{ id: string; name: string; description: string }>> {
    return [
        { id: 'z-ai/glm-4.7-flash', name: 'GLM-4.7-Flash', description: 'Rápido, econômico e multimodal' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Rápido e econômico' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Melhor equilíbrio qualidade/custo' },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', description: 'Máxima qualidade' },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', description: 'OpenAI mais recente' },
        { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI otimizado' },
        { id: 'google/gemini-pro', name: 'Gemini Pro', description: 'Google AI' }
    ]
}

export async function getAIUsageStats(days: number = 30) {
    try {
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        const data = await sql`
            SELECT type, tokens_used, cost_usd, created_at FROM ai_generations
            WHERE created_at >= ${startDate.toISOString()}
            ORDER BY created_at ASC
        `
        const stats = { totalGenerations: data?.length || 0, totalTokens: 0, totalCost: 0, byType: {} as Record<string, number>, byDay: [] as any[] }
        const dayMap: Record<string, { count: number; tokens: number }> = {}
        for (const gen of data || []) {
            stats.totalTokens += gen.tokens_used || 0
            stats.totalCost += parseFloat(String(gen.cost_usd)) || 0
            stats.byType[gen.type] = (stats.byType[gen.type] || 0) + 1
            const dateKey = new Date(gen.created_at).toISOString().split('T')[0]
            if (!dayMap[dateKey]) dayMap[dateKey] = { count: 0, tokens: 0 }
            dayMap[dateKey].count++
            dayMap[dateKey].tokens += gen.tokens_used || 0
        }
        stats.byDay = Object.entries(dayMap).map(([date, d]) => ({ date, count: d.count, tokens: d.tokens }))
        return stats
    } catch {
        return { totalGenerations: 0, totalTokens: 0, totalCost: 0, byType: {}, byDay: [] }
    }
}

export async function getPromptCategories(): Promise<string[]> {
    try {
        const data = await sql`SELECT DISTINCT category FROM ai_prompts WHERE category IS NOT NULL`
        const categories = new Set<string>(data.map((r: any) => r.category))
        for (const cat of ['post', 'rewrite', 'seo', 'newsletter']) categories.add(cat)
        return Array.from(categories).sort()
    } catch {
        return ['post', 'rewrite', 'seo', 'newsletter']
    }
}
