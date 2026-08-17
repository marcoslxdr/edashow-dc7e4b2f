'use server'

/**
 * AI Newsletter Server Actions
 * Server actions for newsletter generation and scheduling
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    generateNewsletter,
    saveNewsletter,
    getNewsletterSchedules,
    upsertNewsletterSchedule,
    NewsletterConfig
} from '@/lib/ai/newsletter-generator'
import { openrouter } from '@/lib/ai/openrouter'
import { requireCmsRole } from './cms-authz'

/**
 * Generate a new newsletter
 */
export async function generateAINewsletter(config: NewsletterConfig) {
    await requireCmsRole()
    if (!openrouter.isConfigured()) {
        throw new Error('OpenRouter API não configurada. Adicione OPENROUTER_API_KEY ao .env')
    }

    const newsletter = await generateNewsletter(config)
    return newsletter
}

/**
 * Save generated newsletter
 */
export async function saveGeneratedNewsletter(
    newsletter: Awaited<ReturnType<typeof generateNewsletter>>,
    config: NewsletterConfig,
    scheduledFor?: string
) {
    await requireCmsRole()
    const id = await saveNewsletter(
        newsletter,
        config,
        scheduledFor ? new Date(scheduledFor) : undefined
    )

    revalidatePath('/cms/newsletter')
    return { id, success: true }
}

/**
 * Get all newsletters
 */
export async function getNewsletters(status?: string) {
    await requireCmsRole()
    const supabase = await createClient()

    let query = supabase
        .from('newsletters')
        .select('*')
        .order('created_at', { ascending: false })

    if (status) {
        query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
}

/**
 * Get a single newsletter
 */
export async function getNewsletter(id: string) {
    await requireCmsRole()
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

/**
 * Update newsletter
 */
export async function updateNewsletter(
    id: string,
    updates: {
        title?: string
        subject?: string
        content?: string
        htmlContent?: string
        status?: string
        scheduledFor?: string
    }
) {
    await requireCmsRole()
    const supabase = await createClient()

    const { error } = await supabase
        .from('newsletters')
        .update({
            title: updates.title,
            subject: updates.subject,
            content: updates.content,
            html_content: updates.htmlContent,
            status: updates.status,
            scheduled_for: updates.scheduledFor
        })
        .eq('id', id)

    if (error) throw error

    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Delete newsletter
 */
export async function deleteNewsletter(id: string) {
    await requireCmsRole()
    const supabase = await createClient()

    const { error } = await supabase
        .from('newsletters')
        .delete()
        .eq('id', id)

    if (error) throw error

    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Schedule newsletter for sending
 */
export async function scheduleNewsletter(id: string, scheduledFor: string) {
    await requireCmsRole()
    const supabase = await createClient()

    const { error } = await supabase
        .from('newsletters')
        .update({
            status: 'scheduled',
            scheduled_for: new Date(scheduledFor).toISOString()
        })
        .eq('id', id)

    if (error) throw error

    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Get newsletter schedules
 */
export async function getSchedules() {
    await requireCmsRole()
    return getNewsletterSchedules()
}

/**
 * Create or update newsletter schedule
 */
export async function upsertSchedule(schedule: {
    id?: string
    name: string
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
    dayOfWeek?: number
    dayOfMonth?: number
    timeOfDay?: string
    tone?: string
    style?: string
    categoryFilter?: string[]
    isActive?: boolean
}) {
    await requireCmsRole()
    const id = await upsertNewsletterSchedule(schedule)
    revalidatePath('/cms/newsletter')
    return { id, success: true }
}

/**
 * Delete newsletter schedule
 */
export async function deleteSchedule(id: string) {
    await requireCmsRole()
    const supabase = await createClient()

    const { error } = await supabase
        .from('newsletter_schedules')
        .delete()
        .eq('id', id)

    if (error) throw error

    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Get recent posts for newsletter selection
 */
export async function getRecentPostsForNewsletter(
    daysBack: number = 7,
    categoryId?: string
) {
    await requireCmsRole()
    const supabase = await createClient()
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - daysBack)

    let query = supabase
        .from('posts')
        .select('id, title, excerpt, slug, published_at, cover_image_url, categories(id, name)')
        .eq('status', 'published')
        .gte('published_at', sinceDate.toISOString())
        .order('published_at', { ascending: false })
        .limit(30)

    if (categoryId) {
        query = query.eq('category_id', categoryId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
}

/**
 * Mark newsletter as sent
 */
export async function markNewsletterSent(id: string, recipientsCount?: number) {
    await requireCmsRole()
    const supabase = await createClient()

    const { error } = await supabase
        .from('newsletters')
        .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            recipients_count: recipientsCount || 0
        })
        .eq('id', id)

    if (error) throw error

    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Get newsletter stats
 */
export async function getNewsletterStats() {
    await requireCmsRole()
    const supabase = await createClient()

    const { data: newsletters } = await supabase
        .from('newsletters')
        .select('status, recipients_count, opens_count, clicks_count')

    const stats = {
        total: newsletters?.length || 0,
        sent: 0,
        scheduled: 0,
        draft: 0,
        totalRecipients: 0,
        totalOpens: 0,
        totalClicks: 0
    }

    for (const nl of newsletters || []) {
        if (nl.status === 'sent') stats.sent++
        else if (nl.status === 'scheduled') stats.scheduled++
        else if (nl.status === 'draft') stats.draft++

        stats.totalRecipients += nl.recipients_count || 0
        stats.totalOpens += nl.opens_count || 0
        stats.totalClicks += nl.clicks_count || 0
    }

    return stats
}
