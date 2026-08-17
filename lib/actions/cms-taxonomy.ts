'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCmsRole } from './cms-authz'
import { revalidatePath } from 'next/cache'

// Categories
export async function saveCategory(data: any) {
    await requireCmsRole()
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS
    const { id, ...catData } = data

    let result
    if (id === 'new') {
        result = await supabase.from('categories').insert([catData]).select().single()
    } else {
        result = await supabase.from('categories').update(catData).eq('id', id).select().single()
    }

    if (result.error) throw result.error
    revalidatePath('/cms/categories')
    revalidatePath('/')
    return result.data
}

export async function deleteCategory(id: string) {
    await requireCmsRole()
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/cms/categories')
    revalidatePath('/')
}

// Columnists
export async function saveColumnist(data: any) {
    await requireCmsRole()
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS
    const { id, ...colData } = data

    let result
    if (id === 'new') {
        result = await supabase.from('columnists').insert([colData]).select().single()
    } else {
        result = await supabase.from('columnists').update(colData).eq('id', id).select().single()
    }

    if (result.error) throw result.error
    revalidatePath('/cms/columnists')
    revalidatePath('/')
    return result.data
}

export async function deleteColumnist(id: string) {
    await requireCmsRole()
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS
    const { error } = await supabase.from('columnists').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/cms/columnists')
    revalidatePath('/')
}

export async function getCategories() {
    await requireCmsRole()
    const supabase = await createClient()
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) throw error
    return data
}

export async function getColumnists() {
    await requireCmsRole()
    const supabase = await createClient()
    const { data, error } = await supabase.from('columnists').select('*').order('name')
    if (error) throw error
    return data
}
