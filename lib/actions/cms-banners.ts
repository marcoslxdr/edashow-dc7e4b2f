'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Banner, BannerLocation } from '@/lib/types/banner'
import { requireCmsRole } from './cms-authz'

export async function getAllBanners(): Promise<{ data: Banner[] | null; error: any }> {
    await requireCmsRole()
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false })

        if (error) throw error
        return { data, error: null }
    } catch (error) {
        console.error('Error fetching banners:', error)
        return { data: null, error }
    }
}

export async function getBannerById(id: string): Promise<{ data: Banner | null; error: any }> {
    await requireCmsRole()
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error
        return { data, error: null }
    } catch (error) {
        console.error('Error fetching banner:', error)
        return { data: null, error }
    }
}

export async function getActiveBannersByLocation(location: BannerLocation): Promise<{ data: Banner[] | null; error: any }> {
    try {
        const supabase = await createClient()
        const now = new Date().toISOString()

        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .eq('location', location)
            .eq('is_active', true)
            .lte('start_date', now)
            .or(`end_date.is.null,end_date.gte.${now}`)
            .order('display_order', { ascending: true })

        if (error) throw error
        return { data, error: null }
    } catch (error) {
        console.error('Error fetching active banners:', error)
        return { data: null, error }
    }
}

export async function saveBanner(formData: FormData): Promise<{ success: boolean; error?: any; data?: Banner }> {
    await requireCmsRole()
    try {
        const supabase = await createAdminClient()

        // Use admin client to bypass RLS
        const id = formData.get('id') as string | null

        const bannerData: any = {
            title: formData.get('title') as string,
            link_url: formData.get('link_url') as string,
            location: formData.get('location') as string,
            width: parseInt(formData.get('width') as string),
            height: parseInt(formData.get('height') as string),
            start_date: formData.get('start_date') as string,
            end_date: formData.get('end_date') as string || null,
            is_active: formData.get('is_active') === 'true',
            display_order: parseInt(formData.get('display_order') as string),
            updated_at: new Date().toISOString(),
        }

        // Handle image upload
        const imageFile = formData.get('image') as File | null
        if (imageFile && imageFile.size > 0) {
            if (!imageFile.type.startsWith('image/')) throw new Error('O banner precisa ser uma imagem.')
            if (imageFile.size > 5 * 1024 * 1024) throw new Error('Banner muito grande. Máximo de 5MB.')
            const fileName = `${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('banners')
                .upload(fileName, imageFile, {
                    contentType: imageFile.type,
                    upsert: false
                })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('banners')
                .getPublicUrl(fileName)

            bannerData.image_path = publicUrl
        }

        let result
        if (id) {
            // Update existing banner
            const updateData: any = { ...bannerData }
            if (!imageFile || imageFile.size === 0) {
                delete updateData.image_path
            }

            const { data, error } = await supabase
                .from('banners')
                .update(updateData)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            result = data
        } else {
            // Create new banner
            if (!bannerData.image_path) {
                throw new Error('Image is required for new banners')
            }

            const { data, error } = await supabase
                .from('banners')
                .insert([bannerData])
                .select()
                .single()

            if (error) throw error
            result = data
        }

        revalidatePath('/cms/banners')
        revalidatePath('/', 'layout')
        return { success: true, data: result }
    } catch (error) {
        console.error('Error saving banner:', error)
        return { success: false, error }
    }
}

export async function deleteBanner(id: string): Promise<{ success: boolean; error?: any }> {
    await requireCmsRole()
    try {
        const supabase = await createAdminClient()

        // Use admin client to bypass RLS

        // Get banner to delete image from storage
        const { data: banner } = await supabase
            .from('banners')
            .select('image_path')
            .eq('id', id)
            .single()

        if (banner?.image_path) {
            // Extract file name from public URL
            const fileName = banner.image_path.split('/').pop()
            if (fileName) {
                await supabase.storage.from('banners').remove([fileName])
            }
        }

        const { error } = await supabase
            .from('banners')
            .delete()
            .eq('id', id)

        if (error) throw error

        revalidatePath('/cms/banners')
        revalidatePath('/', 'layout')
        return { success: true }
    } catch (error) {
        console.error('Error deleting banner:', error)
        return { success: false, error }
    }
}

export async function uploadBannerImage(file: File): Promise<{ url: string | null; error: any }> {
    await requireCmsRole()
    try {
        if (!file.type.startsWith('image/')) throw new Error('O banner precisa ser uma imagem.')
        if (file.size > 5 * 1024 * 1024) throw new Error('Banner muito grande. Máximo de 5MB.')
        const supabase = await createAdminClient()

        // Use admin client to bypass RLS
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

        const { data, error } = await supabase.storage
            .from('banners')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: false
            })

        if (error) throw error

        const { data: { publicUrl } } = supabase.storage
            .from('banners')
            .getPublicUrl(fileName)

        return { url: publicUrl, error: null }
    } catch (error) {
        console.error('Error uploading banner image:', error)
        return { url: null, error }
    }
}
