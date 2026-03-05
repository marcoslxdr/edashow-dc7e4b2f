'use server'

import { sql } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'

export async function getEvents() {
    return sql`SELECT * FROM events ORDER BY event_date DESC`
}

export async function getEvent(id: string) {
    const rows = await sql`SELECT * FROM events WHERE id = ${id} LIMIT 1`
    if (!rows || rows.length === 0) return null
    return rows[0]
}

export async function saveEvent(data: any) {
    const { id, ...eventData } = data
    const keys = Object.keys(eventData)
    const values = Object.values(eventData)

    let result
    if (!id || id === 'new') {
        const cols = keys.join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const rows = await sql(`INSERT INTO events (${cols}) VALUES (${placeholders}) RETURNING *`, values)
        result = rows[0]
    } else {
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
        const rows = await sql(`UPDATE events SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
        result = rows[0]
    }

    revalidatePath('/cms/events')
    revalidatePath('/')
    return result
}

export async function deleteEvent(id: string) {
    await sql`DELETE FROM events WHERE id = ${id}`
    revalidatePath('/cms/events')
    revalidatePath('/')
}
