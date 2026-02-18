'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
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
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('theme_settings')
        .select('*')
        .single()

    if (error) {
        console.error('Error fetching site settings:', error)
        return null
    }

    return data
}

export async function updateSiteSettings(settings: Partial<SiteSettings>): Promise<{ success: boolean; error?: string }> {
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS

    // Get existing settings to get the ID
    const { data: existing } = await supabase
        .from('theme_settings')
        .select('id')
        .single()

    if (!existing) {
        // No settings row exists yet — create one with the provided values
        const { error: insertError } = await supabase
            .from('theme_settings')
            .insert({
                ...settings,
                updated_at: new Date().toISOString()
            })

        if (insertError) {
            console.error('Error creating site settings:', insertError)
            return { success: false, error: insertError.message }
        }
    } else {
        const { error } = await supabase
            .from('theme_settings')
            .update({
                ...settings,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)

        if (error) {
            console.error('Error updating site settings:', error)
            return { success: false, error: error.message }
        }
    }

    revalidatePath('/cms/settings')
    revalidatePath('/')

    return { success: true }
}

export async function uploadSiteLogo(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS

    const file = formData.get('file') as File
    if (!file) {
        return { success: false, error: 'No file provided' }
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `site-logo-${Date.now()}.${fileExt}`

    const bucket = process.env.SUPABASE_BUCKET || 'edashow-media'

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(`branding/${fileName}`, file, {
            cacheControl: '3600',
            upsert: true
        })

    if (error) {
        console.error('Error uploading logo:', error)
        return { success: false, error: error.message }
    }

    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(`branding/${fileName}`)

    // Update settings with new logo URL
    const updateResult = await updateSiteSettings({ logo_url: publicUrl })
    if (!updateResult.success) {
        return { success: false, error: updateResult.error }
    }

    return { success: true, url: publicUrl }
}

export async function uploadFavicon(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS

    const file = formData.get('file') as File
    if (!file) {
        return { success: false, error: 'No file provided' }
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `favicon-${Date.now()}.${fileExt}`

    const bucket = process.env.SUPABASE_BUCKET || 'edashow-media'

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(`branding/${fileName}`, file, {
            cacheControl: '3600',
            upsert: true
        })

    if (error) {
        console.error('Error uploading favicon:', error)
        return { success: false, error: error.message }
    }

    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(`branding/${fileName}`)

    // Update settings with new favicon URL
    const updateResult = await updateSiteSettings({ site_favicon_url: publicUrl })
    if (!updateResult.success) {
        return { success: false, error: updateResult.error }
    }

    return { success: true, url: publicUrl }
}
