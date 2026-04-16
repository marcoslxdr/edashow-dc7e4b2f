'use server'

/**
 * Keywords Server Actions
 * CRUD operations for keyword groups stored in Supabase
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'

export interface KeywordGroup {
    id: string
    topic: string
    keywords: string[]
    category: string
    created_at: string
    updated_at: string
}

/**
 * Ensure keyword_groups table exists (auto-migration)
 */
async function ensureTable() {
    const supabase = createAdminClient()
    const { error } = await supabase.from('keyword_groups').select('id').limit(1)
    if (error?.code === '42P01') {
        // Table doesn't exist - try to create it
        // This requires the exec_sql or similar RPC function
        console.error(
            'Tabela keyword_groups não existe. Execute o SQL:\n' +
            'CREATE TABLE keyword_groups (\n' +
            '  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n' +
            '  topic TEXT NOT NULL,\n' +
            '  keywords TEXT[] NOT NULL DEFAULT \'{}\',\n' +
            '  category TEXT DEFAULT \'geral\',\n' +
            '  created_at TIMESTAMPTZ DEFAULT now(),\n' +
            '  updated_at TIMESTAMPTZ DEFAULT now()\n' +
            ');\n' +
            'ALTER TABLE keyword_groups ENABLE ROW LEVEL SECURITY;\n' +
            'CREATE POLICY "Allow all for keyword_groups" ON keyword_groups FOR ALL USING (true) WITH CHECK (true);'
        )
        throw new Error('Tabela keyword_groups não encontrada. Execute a migração no Supabase Dashboard.')
    }
}

/**
 * Get all keyword groups
 */
export async function getKeywordGroups(category?: string): Promise<KeywordGroup[]> {
    const supabase = createAdminClient()

    let query = supabase
        .from('keyword_groups')
        .select('*')
        .order('updated_at', { ascending: false })

    if (category && category !== 'todas') {
        query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error?.code === '42P01') {
        await ensureTable()
        return []
    }

    if (error) throw new Error(error.message)
    return (data || []) as KeywordGroup[]
}

/**
 * Create a keyword group
 */
export async function createKeywordGroup(
    topic: string,
    keywords: string[],
    category: string = 'geral'
): Promise<KeywordGroup> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('keyword_groups')
        .insert({
            topic: topic.trim(),
            keywords,
            category: category.trim().toLowerCase()
        })
        .select()
        .single()

    if (error) throw new Error(error.message)
    revalidatePath('/cms/ia')
    return data as KeywordGroup
}

/**
 * Update keywords in a group
 */
export async function updateKeywordGroup(
    id: string,
    updates: { topic?: string; keywords?: string[]; category?: string }
): Promise<KeywordGroup> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('keyword_groups')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw new Error(error.message)
    revalidatePath('/cms/ia')
    return data as KeywordGroup
}

/**
 * Delete a keyword group
 */
export async function deleteKeywordGroup(id: string): Promise<void> {
    const supabase = createAdminClient()

    const { error } = await supabase
        .from('keyword_groups')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/cms/ia')
}

/**
 * Add a keyword to a group
 */
export async function addKeywordToGroup(groupId: string, keyword: string): Promise<KeywordGroup> {
    const supabase = createAdminClient()

    // Get current keywords
    const { data: group, error: fetchError } = await supabase
        .from('keyword_groups')
        .select('keywords')
        .eq('id', groupId)
        .single()

    if (fetchError) throw new Error(fetchError.message)

    const currentKeywords = (group?.keywords || []) as string[]
    if (currentKeywords.includes(keyword.trim())) {
        throw new Error('Keyword já existe neste grupo')
    }

    return updateKeywordGroup(groupId, {
        keywords: [...currentKeywords, keyword.trim()]
    })
}

/**
 * Remove a keyword from a group
 */
export async function removeKeywordFromGroup(groupId: string, keyword: string): Promise<KeywordGroup | null> {
    const supabase = createAdminClient()

    const { data: group, error: fetchError } = await supabase
        .from('keyword_groups')
        .select('keywords')
        .eq('id', groupId)
        .single()

    if (fetchError) throw new Error(fetchError.message)

    const updatedKeywords = ((group?.keywords || []) as string[]).filter(k => k !== keyword)

    // If no keywords left, delete the group
    if (updatedKeywords.length === 0) {
        await deleteKeywordGroup(groupId)
        return null
    }

    return updateKeywordGroup(groupId, { keywords: updatedKeywords })
}

/**
 * Search keywords across all groups
 */
export async function searchKeywords(query: string): Promise<KeywordGroup[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('keyword_groups')
        .select('*')
        .or(`topic.ilike.%${query}%,keywords.cs.{${query}}`)
        .order('updated_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []) as KeywordGroup[]
}

/**
 * Get all unique categories
 */
export async function getKeywordCategories(): Promise<string[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('keyword_groups')
        .select('category')

    if (error) return ['geral']

    const categories = [...new Set((data || []).map(d => d.category as string))].filter(Boolean)
    return categories.length > 0 ? categories : ['geral']
}

/**
 * Get all keywords as a flat list (for autocomplete/selection)
 */
export async function getAllKeywords(): Promise<string[]> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('keyword_groups')
        .select('keywords')

    if (error) return []

    const allKeywords = (data || []).flatMap(d => (d.keywords || []) as string[])
    return [...new Set(allKeywords)].sort()
}
