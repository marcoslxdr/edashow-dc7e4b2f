'use server'

import { sql } from '@/lib/db/client'
import { put } from '@vercel/blob'
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

export async function getImageSettings(): Promise<ImageSettings | null> {
    try {
        const rows = await sql`SELECT * FROM image_settings LIMIT 1`
        if (rows && rows.length > 0) return rows[0] as ImageSettings

        // Create default settings if none exist
        const newRows = await sql`INSERT INTO image_settings DEFAULT VALUES RETURNING *`
        return newRows[0] as ImageSettings || null
    } catch (error) {
        console.error('Error fetching image settings:', error)
        return null
    }
}

export async function updateImageSettings(settings: UpdateImageSettingsInput): Promise<{ success: boolean; error?: string }> {
    try {
        const existing = await sql`SELECT id FROM image_settings LIMIT 1`
        if (!existing || existing.length === 0) {
            await sql`INSERT INTO image_settings DEFAULT VALUES`
            const fresh = await sql`SELECT id FROM image_settings LIMIT 1`
            if (!fresh || fresh.length === 0) return { success: false, error: 'Falha ao criar configurações' }
        }

        const id = existing?.[0]?.id || (await sql`SELECT id FROM image_settings LIMIT 1`)[0]?.id
        const keys = Object.keys(settings)
        const values = Object.values(settings)
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
        await sql(`UPDATE image_settings SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1}`, [...values, id])

        revalidatePath('/cms/settings/images')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function uploadWatermarkLogo(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
    const file = formData.get('file') as File
    if (!file) return { success: false, error: 'Nenhum arquivo enviado' }
    if (!file.type.startsWith('image/')) return { success: false, error: 'O arquivo deve ser uma imagem' }

    const blob = await put(`watermark/logo-${Date.now()}.png`, file, { access: 'public' })

    const updateResult = await updateImageSettings({ watermark_logo_url: blob.url })
    if (!updateResult.success) return { success: false, error: updateResult.error }

    return { success: true, url: blob.url }
}

export async function removeWatermarkLogo(): Promise<{ success: boolean; error?: string }> {
    return updateImageSettings({ watermark_logo_url: null, watermark_enabled: false })
}
