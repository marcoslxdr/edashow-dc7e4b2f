'use server'

import { sql } from '@/lib/db/client'
import { put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'

export async function saveSponsor(data: any) {
    const { id, ...sponsorData } = data
    const keys = Object.keys(sponsorData)
    const values = Object.values(sponsorData)

    let result
    if (id === 'new') {
        const cols = keys.join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const rows = await sql(`INSERT INTO sponsors (${cols}) VALUES (${placeholders}) RETURNING *`, values)
        result = rows[0]
    } else {
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
        const rows = await sql(`UPDATE sponsors SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
        result = rows[0]
    }

    revalidatePath('/cms/sponsors')
    revalidatePath('/')
    return result
}

export async function getSponsor(id: string) {
    const rows = await sql`SELECT * FROM sponsors WHERE id = ${id} LIMIT 1`
    return rows[0] || null
}

export async function deleteSponsor(id: string) {
    await sql`DELETE FROM sponsors WHERE id = ${id}`
    revalidatePath('/cms/sponsors')
    revalidatePath('/')
}

export async function toggleSponsorActive(id: string, active: boolean) {
    await sql`UPDATE sponsors SET active = ${active} WHERE id = ${id}`
    revalidatePath('/cms/sponsors')
    revalidatePath('/')
}

export async function updateSponsorOrder(sponsors: Array<{ id: string; display_order: number }>) {
    await Promise.all(
        sponsors.map(s => sql`UPDATE sponsors SET display_order = ${s.display_order} WHERE id = ${s.id}`)
    )
    revalidatePath('/cms/sponsors')
    revalidatePath('/')
}

export async function bulkDeleteSponsors(ids: string[]) {
    await sql`DELETE FROM sponsors WHERE id = ANY(${ids}::uuid[])`
    revalidatePath('/cms/sponsors')
    revalidatePath('/')
}

export async function bulkToggleSponsorActive(ids: string[], active: boolean) {
    await sql`UPDATE sponsors SET active = ${active} WHERE id = ANY(${ids}::uuid[])`
    revalidatePath('/cms/sponsors')
    revalidatePath('/')
}

export async function uploadSponsorLogo(formData: FormData) {
    const file = formData.get('file') as File
    if (!file) throw new Error('No file provided')

    const fileExt = file.name.split('.').pop()
    const fileName = `sponsors/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const blob = await put(fileName, file, { access: 'public' })
    return blob.url
}

export async function getNewsletterSubscribers() {
    return sql`SELECT * FROM newsletter_subscribers ORDER BY created_at DESC`
}

export async function toggleSubscriberStatus(id: string, active: boolean) {
    await sql`UPDATE newsletter_subscribers SET active = ${active} WHERE id = ${id}`
    revalidatePath('/cms/newsletter')
}
