'use server'

/**
 * Server Actions for Image Settings Management
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCmsRole } from './cms-authz'
import { revalidatePath } from 'next/cache'
import { ImageSettings } from '@/lib/images/image-optimizer'

export interface UpdateImageSettingsInput {
    enabled?: boolean
    format?: 'webp' | 'jpeg' | 'png'
    quality?: number
    max_width?: number
    max_height?: number
    watermark_enabled?: boolean
    watermark_logo_url?: string | null
    watermark_position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    watermark_opacity?: number
    watermark_size?: number
}

/**
 * Get image optimization settings
 */
export async function getImageSettings(): Promise<ImageSettings | null> {
    await requireCmsRole()
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('image_settings')
        .select('*')
        .single()

    if (error) {
        console.error('Error fetching image settings:', error)
        // Try to create default settings if none exist
        if (error.code === 'PGRST116') {
            const { data: newData, error: insertError } = await supabase
                .from('image_settings')
                .insert({})
                .select()
                .single()

            if (insertError) {
                console.error('Error creating default settings:', insertError)
                return null
            }
            return newData as ImageSettings
        }
        return null
    }

    return data as ImageSettings
}

/**
 * Update image optimization settings
 */
export async function updateImageSettings(settings: UpdateImageSettingsInput): Promise<{ success: boolean; error?: string }> {
    await requireCmsRole()
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS

    // First get the existing settings ID
    const { data: existing, error: fetchError } = await supabase
        .from('image_settings')
        .select('id')
        .single()

    if (fetchError || !existing) {
        return { success: false, error: 'Configurações não encontradas' }
    }

    // Update settings
    const { error } = await supabase
        .from('image_settings')
        .update({
            ...settings,
            updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

    if (error) {
        console.error('Error updating image settings:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/cms/settings/images')
    return { success: true }
}

/**
 * Upload watermark logo
 */
export async function uploadWatermarkLogo(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
    await requireCmsRole()
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS
    const file = formData.get('file') as File

    if (!file) {
        return { success: false, error: 'Nenhum arquivo enviado' }
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
        return { success: false, error: 'O arquivo deve ser uma imagem' }
    }

    const filename = `watermark/logo-${Date.now()}.png`

    const bucket = process.env.SUPABASE_BUCKET || 'media'

    // Upload to storage
    const { data: storageData, error: storageError } = await supabase.storage
        .from(bucket)
        .upload(filename, file, {
            upsert: true
        })

    if (storageError) {
        console.error('Error uploading watermark logo:', storageError)
        return { success: false, error: 'Erro ao fazer upload do logo' }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filename)

    // Update settings with new logo URL
    const updateResult = await updateImageSettings({
        watermark_logo_url: publicUrl
    })

    if (!updateResult.success) {
        return { success: false, error: updateResult.error }
    }

    return { success: true, url: publicUrl }
}

/**
 * Remove watermark logo
 */
export async function removeWatermarkLogo(): Promise<{ success: boolean; error?: string }> {
    await requireCmsRole()
    const result = await updateImageSettings({
        watermark_logo_url: null,
        watermark_enabled: false
    })

    return result
}
