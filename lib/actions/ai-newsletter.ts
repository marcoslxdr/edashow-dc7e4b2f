'use server'

/**
 * AI Newsletter Server Actions
 * Server actions for newsletter generation and scheduling
 */

import { revalidatePath } from 'next/cache'
import { sql } from '@/lib/db/client'
import {
    generateNewsletter,
    saveNewsletter,
    getNewsletterSchedules,
    upsertNewsletterSchedule,
    NewsletterConfig
} from '@/lib/ai/newsletter-generator'
import { openrouter } from '@/lib/ai/openrouter'

/**
 * Generate a new newsletter
 */
export async function generateAINewsletter(config: NewsletterConfig) {
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
    if (status) {
        return sql`SELECT * FROM newsletters WHERE status = ${status} ORDER BY created_at DESC` as Promise<any[]>
    }
    return sql`SELECT * FROM newsletters ORDER BY created_at DESC` as Promise<any[]>
}

/**
 * Get a single newsletter
 */
export async function getNewsletter(id: string) {
    const rows = await sql`SELECT * FROM newsletters WHERE id = ${id} LIMIT 1`
    return rows[0] || null
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
    await sql`
        UPDATE newsletters SET
            title = ${updates.title ?? null},
            subject = ${updates.subject ?? null},
            content = ${updates.content ?? null},
            html_content = ${updates.htmlContent ?? null},
            status = ${updates.status ?? null},
            scheduled_for = ${updates.scheduledFor ?? null}
        WHERE id = ${id}
    `
    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Delete newsletter
 */
export async function deleteNewsletter(id: string) {
    await sql`DELETE FROM newsletters WHERE id = ${id}`
    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Schedule newsletter for sending
 */
export async function scheduleNewsletter(id: string, scheduledFor: string) {
    await sql`UPDATE newsletters SET status = 'scheduled', scheduled_for = ${new Date(scheduledFor).toISOString()} WHERE id = ${id}`
    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Get newsletter schedules
 */
export async function getSchedules() {
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
    const id = await upsertNewsletterSchedule(schedule)
    revalidatePath('/cms/newsletter')
    return { id, success: true }
}

/**
 * Delete newsletter schedule
 */
export async function deleteSchedule(id: string) {
    await sql`DELETE FROM newsletter_schedules WHERE id = ${id}`
    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Get recent posts for newsletter selection
 */
export async function getRecentPostsForNewsletter(daysBack: number = 7, categoryId?: string) {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - daysBack)
    if (categoryId) {
        return sql`
            SELECT p.id, p.title, p.excerpt, p.slug, p.published_at, p.cover_image_url,
                cat.id as cat_id, cat.name as cat_name
            FROM posts p LEFT JOIN categories cat ON cat.id = p.category_id
            WHERE p.status = 'published' AND p.published_at >= ${sinceDate.toISOString()}
            AND p.category_id = ${categoryId}
            ORDER BY p.published_at DESC LIMIT 30
        ` as Promise<any[]>
    }
    return sql`
        SELECT p.id, p.title, p.excerpt, p.slug, p.published_at, p.cover_image_url,
            cat.id as cat_id, cat.name as cat_name
        FROM posts p LEFT JOIN categories cat ON cat.id = p.category_id
        WHERE p.status = 'published' AND p.published_at >= ${sinceDate.toISOString()}
        ORDER BY p.published_at DESC LIMIT 30
    ` as Promise<any[]>
}

/**
 * Mark newsletter as sent
 */
export async function markNewsletterSent(id: string, recipientsCount?: number) {
    await sql`UPDATE newsletters SET status = 'sent', sent_at = NOW(), recipients_count = ${recipientsCount || 0} WHERE id = ${id}`
    revalidatePath('/cms/newsletter')
    return { success: true }
}

/**
 * Get newsletter stats
 */
export async function getNewsletterStats() {
    const newsletters = await sql`SELECT status, recipients_count, opens_count, clicks_count FROM newsletters`

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
