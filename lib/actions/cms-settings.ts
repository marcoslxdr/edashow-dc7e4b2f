'use server'

import { sql } from '@/lib/db/client'
import { put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'

export interface SiteSettings {
    id: string
    site_name: string
    site_slogan: string
    site_description: string
    site_favicon_url: string | null
    contact_email: string | null
    contact_phone: string | null
    logo_url: string | null
    font_heading: string
    font_body: string
    light_primary: string
    light_secondary: string
    light_background: string
    light_foreground: string
    dark_primary: string
    dark_secondary: string
    dark_background: string
    dark_foreground: string
    social_media: Record<string, string> | null
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
    try {
        const rows = await sql`SELECT * FROM theme_settings LIMIT 1`
        return rows[0] || null
    } catch (error) {
        console.error('Error fetching site settings:', error)
        return null
    }
}

export async function updateSiteSettings(settings: Partial<SiteSettings>): Promise<{ success: boolean; error?: string }> {
    try {
        const existing = await sql`SELECT id FROM theme_settings LIMIT 1`

        if (!existing || existing.length === 0) {
            const keys = Object.keys(settings)
            const values = Object.values(settings)
            const cols = ['updated_at', ...keys].join(', ')
            const placeholders = ['NOW()', ...keys.map((_, i) => `$${i + 1}`)].join(', ')
            await sql(`INSERT INTO theme_settings (${cols}) VALUES (${placeholders})`, values)
        } else {
            const keys = Object.keys(settings)
            const values = Object.values(settings)
            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
            await sql(
                `UPDATE theme_settings SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
                [...values, existing[0].id]
            )
        }

        revalidatePath('/cms/settings')
        revalidatePath('/')
        return { success: true }
    } catch (error: any) {
        console.error('Error updating site settings:', error)
        return { success: false, error: error.message }
    }
}

export async function uploadSiteLogo(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
    const file = formData.get('file') as File
    if (!file) return { success: false, error: 'No file provided' }

    const fileExt = file.name.split('.').pop()
    const fileName = `branding/site-logo-${Date.now()}.${fileExt}`

    const blob = await put(fileName, file, { access: 'public' })

    const updateResult = await updateSiteSettings({ logo_url: blob.url })
    if (!updateResult.success) return { success: false, error: updateResult.error }

    return { success: true, url: blob.url }
}

export async function uploadFavicon(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
    const file = formData.get('file') as File
    if (!file) return { success: false, error: 'No file provided' }

    const fileExt = file.name.split('.').pop()
    const fileName = `branding/favicon-${Date.now()}.${fileExt}`

    const blob = await put(fileName, file, { access: 'public' })

    const updateResult = await updateSiteSettings({ site_favicon_url: blob.url })
    if (!updateResult.success) return { success: false, error: updateResult.error }

    return { success: true, url: blob.url }
}
