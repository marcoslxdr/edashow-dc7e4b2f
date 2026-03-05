'use server'

import { sql } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'

// Categories
export async function saveCategory(data: any) {
    const { id, ...catData } = data
    const keys = Object.keys(catData)
    const values = Object.values(catData)

    let result
    if (id === 'new') {
        const cols = keys.join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const rows = await sql(`INSERT INTO categories (${cols}) VALUES (${placeholders}) RETURNING *`, values)
        result = rows[0]
    } else {
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
        const rows = await sql(`UPDATE categories SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
        result = rows[0]
    }

    revalidatePath('/cms/categories')
    revalidatePath('/')
    return result
}

export async function deleteCategory(id: string) {
    await sql`DELETE FROM categories WHERE id = ${id}`
    revalidatePath('/cms/categories')
    revalidatePath('/')
}

// Columnists
export async function saveColumnist(data: any) {
    const { id, ...colData } = data
    const keys = Object.keys(colData)
    const values = Object.values(colData)

    let result
    if (id === 'new') {
        const cols = keys.join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const rows = await sql(`INSERT INTO columnists (${cols}) VALUES (${placeholders}) RETURNING *`, values)
        result = rows[0]
    } else {
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
        const rows = await sql(`UPDATE columnists SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id])
        result = rows[0]
    }

    revalidatePath('/cms/columnists')
    revalidatePath('/')
    return result
}

export async function deleteColumnist(id: string) {
    await sql`DELETE FROM columnists WHERE id = ${id}`
    revalidatePath('/cms/columnists')
    revalidatePath('/')
}

export async function getCategories() {
    return sql`SELECT * FROM categories ORDER BY name`
}

export async function getColumnists() {
    return sql`SELECT * FROM columnists ORDER BY name`
}
