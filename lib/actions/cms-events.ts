'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { slugify } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

async function ensureUniqueEventSlug(
    supabase: SupabaseClient,
    baseSlug: string,
    excludeId?: string
): Promise<string> {
    const root = baseSlug || 'evento'
    let candidate = root
    let suffix = 2

    for (;;) {
        const { data } = await supabase.from('events').select('id').eq('slug', candidate).maybeSingle()
        if (!data || (excludeId !== undefined && data.id === excludeId)) {
            return candidate
        }
        candidate = `${root}-${suffix++}`
    }
}

function buildEventPayload(input: Record<string, unknown>) {
    const title = typeof input.title === 'string' ? input.title.trim() : ''
    const explicitSlug = typeof input.slug === 'string' ? input.slug.trim() : ''
    const slugBase = explicitSlug ? slugify(explicitSlug) : slugify(title)

    const rawDate = typeof input.event_date === 'string' ? input.event_date.trim() : ''

    return {
        title,
        slug: slugBase,
        event_date: rawDate || null,
        location:
            typeof input.location === 'string' && input.location.trim()
                ? input.location.trim()
                : null,
        description:
            typeof input.description === 'string' && input.description.trim()
                ? input.description
                : null,
        status: typeof input.status === 'string' && input.status ? input.status : 'upcoming',
        registration_url:
            typeof input.registration_url === 'string' && input.registration_url.trim()
                ? input.registration_url.trim()
                : null,
        cover_image_url:
            typeof input.cover_image_url === 'string' && input.cover_image_url.trim()
                ? input.cover_image_url.trim()
                : null,
    }
}

export async function getEvents() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false })

    if (error) throw error
    return data
}

export async function getEvent(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

export async function saveEvent(data: Record<string, unknown>) {
    const supabase = createAdminClient()

    const rawId = data.id
    const id = typeof rawId === 'string' ? rawId : undefined
    const isNew = !id || id === 'new'

    const payload = buildEventPayload(data)

    if (!payload.title) {
        throw new Error('Informe o nome do evento.')
    }
    if (!payload.slug) {
        throw new Error('Não foi possível gerar o slug a partir do título. Use um título válido.')
    }

    let result
    if (isNew) {
        const uniqueSlug = await ensureUniqueEventSlug(supabase, payload.slug)
        result = await supabase
            .from('events')
            .insert([{ ...payload, slug: uniqueSlug }])
            .select()
            .single()
    } else {
        const uniqueSlug = await ensureUniqueEventSlug(supabase, payload.slug, id)
        result = await supabase.from('events').update({ ...payload, slug: uniqueSlug }).eq('id', id).select().single()
    }

    if (result.error) {
        throw new Error(result.error.message || 'Erro ao salvar evento no banco de dados.')
    }

    revalidatePath('/cms/events')
    revalidatePath('/events')
    revalidatePath('/')
    if (result.data && typeof (result.data as { slug?: string }).slug === 'string') {
        revalidatePath(`/events/${(result.data as { slug: string }).slug}`)
    }

    return result.data
}

export async function deleteEvent(id: string) {
    const supabase = await createAdminClient()

    // Use admin client to bypass RLS
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw error
    revalidatePath('/cms/events')
    revalidatePath('/events')
    revalidatePath('/')
}
