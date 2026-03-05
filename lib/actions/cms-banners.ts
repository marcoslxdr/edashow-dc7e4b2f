'use server'

import { sql } from '@/lib/db/client'
import { put, del } from '@vercel/blob'
import { revalidatePath } from 'next/cache'
import type { Banner, BannerLocation } from '@/lib/types/banner'

export async function getAllBanners(): Promise<{ data: Banner[] | null; error: any }> {
    try {
        const data = await sql`SELECT * FROM banners ORDER BY display_order ASC, created_at DESC`
        return { data: data as Banner[], error: null }
    } catch (error) {
        console.error('Error fetching banners:', error)
        return { data: null, error }
    }
}

export async function getBannerById(id: string): Promise<{ data: Banner | null; error: any }> {
    try {
        const rows = await sql`SELECT * FROM banners WHERE id = ${id} LIMIT 1`
        return { data: (rows[0] as Banner) || null, error: null }
    } catch (error) {
        return { data: null, error }
    }
}

export async function getActiveBannersByLocation(location: BannerLocation): Promise<{ data: Banner[] | null; error: any }> {
    try {
        const now = new Date().toISOString()
        const data = await sql`
            SELECT * FROM banners
            WHERE location = ${location}
            AND is_active = true
            AND start_date <= ${now}
            AND (end_date IS NULL OR end_date >= ${now})
            ORDER BY display_order ASC
        `
        return { data: data as Banner[], error: null }
    } catch (error) {
        return { data: null, error }
    }
}

export async function saveBanner(formData: FormData): Promise<{ success: boolean; error?: any; data?: Banner }> {
    try {
        const id = formData.get('id') as string | null

        const bannerData: any = {
            title: formData.get('title') as string,
            link_url: formData.get('link_url') as string,
            location: formData.get('location') as string,
            width: parseInt(formData.get('width') as string),
            height: parseInt(formData.get('height') as string),
            start_date: formData.get('start_date') as string,
            end_date: (formData.get('end_date') as string) || null,
            is_active: formData.get('is_active') === 'true',
            display_order: parseInt(formData.get('display_order') as string),
            updated_at: new Date().toISOString(),
        }

        const imageFile = formData.get('image') as File | null
        if (imageFile && imageFile.size > 0) {
            const fileName = `banners/${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const blob = await put(fileName, imageFile, { access: 'public', contentType: imageFile.type })
            bannerData.image_path = blob.url
        }

        let result
        if (id) {
            const updateData = { ...bannerData }
            if (!imageFile || imageFile.size === 0) delete updateData.image_path
            const keys = Object.keys(updateData)
            const values = Object.values(updateData)
            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
            const rows = await sql(`UPDATE banners SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
            result = rows[0]
        } else {
            if (!bannerData.image_path) throw new Error('Image is required for new banners')
            const keys = Object.keys(bannerData)
            const values = Object.values(bannerData)
            const cols = keys.join(', ')
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
            const rows = await sql(`INSERT INTO banners (${cols}) VALUES (${placeholders}) RETURNING *`, values)
            result = rows[0]
        }

        revalidatePath('/cms/banners')
        revalidatePath('/', 'layout')
        return { success: true, data: result as Banner }
    } catch (error) {
        console.error('Error saving banner:', error)
        return { success: false, error }
    }
}

export async function deleteBanner(id: string): Promise<{ success: boolean; error?: any }> {
    try {
        const rows = await sql`SELECT image_path FROM banners WHERE id = ${id} LIMIT 1`
        const banner = rows[0]

        if (banner?.image_path) {
            try { await del(banner.image_path) } catch { /* ignore blob delete errors */ }
        }

        await sql`DELETE FROM banners WHERE id = ${id}`

        revalidatePath('/cms/banners')
        revalidatePath('/', 'layout')
        return { success: true }
    } catch (error) {
        return { success: false, error }
    }
}

export async function uploadBannerImage(file: File): Promise<{ url: string | null; error: any }> {
    try {
        const fileName = `banners/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const blob = await put(fileName, file, { access: 'public', contentType: file.type })
        return { url: blob.url, error: null }
    } catch (error) {
        return { url: null, error }
    }
}
