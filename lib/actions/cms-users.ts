'use server'

import { sql } from '@/lib/db/client'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

export interface User {
    id: string
    email: string
    name: string
    role: 'admin' | 'editor' | 'user'
    created_at: string
    last_sign_in?: string
}

export async function getUsers(): Promise<User[]> {
    try {
        const rows = await sql`
            SELECT p.*, ur.role
            FROM profiles p
            LEFT JOIN user_roles ur ON ur.user_id = p.id
            ORDER BY p.created_at DESC
        `
        return rows.map((r: any) => ({
            id: r.id,
            email: r.email || '',
            name: r.name || r.email?.split('@')[0] || 'Sem nome',
            role: (r.role || 'user') as 'admin' | 'editor' | 'user',
            created_at: r.created_at,
            last_sign_in: r.last_sign_in_at,
        }))
    } catch (error) {
        console.error('Error fetching users:', error)
        return []
    }
}

export async function updateUserRole(userId: string, role: 'admin' | 'editor' | 'user'): Promise<{ success: boolean; error?: string }> {
    try {
        const existing = await sql`SELECT id FROM user_roles WHERE user_id = ${userId} LIMIT 1`
        if (existing && existing.length > 0) {
            await sql`UPDATE user_roles SET role = ${role}, updated_at = NOW() WHERE user_id = ${userId}`
        } else {
            await sql`INSERT INTO user_roles (user_id, role) VALUES (${userId}, ${role})`
        }
        revalidatePath('/cms/settings/users')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateUserProfile(userId: string, data: { name?: string; email?: string }): Promise<{ success: boolean; error?: string }> {
    try {
        const keys = Object.keys(data)
        const values = Object.values(data)
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
        await sql(`UPDATE profiles SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1}`, [...values, userId])
        revalidatePath('/cms/settings/users')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await sql`DELETE FROM user_roles WHERE user_id = ${userId}`
        await sql`DELETE FROM profile_auth WHERE user_id = ${userId}`
        await sql`DELETE FROM profiles WHERE id = ${userId}`
        revalidatePath('/cms/settings/users')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function createUser(data: { email: string; password: string; name: string; role: 'admin' | 'editor' }): Promise<{ success: boolean; error?: string }> {
    try {
        const passwordHash = await bcrypt.hash(data.password, 12)
        const rows = await sql`
            INSERT INTO profiles (email, name)
            VALUES (${data.email}, ${data.name})
            RETURNING id
        `
        const userId = rows[0].id
        await sql`INSERT INTO user_roles (user_id, role) VALUES (${userId}, ${data.role})`
        await sql`INSERT INTO profile_auth (user_id, password_hash) VALUES (${userId}, ${passwordHash})`
        revalidatePath('/cms/settings/users')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateUserPassword(userId: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: 'Usuário não autenticado' }
        if (session.user.role !== 'admin') return { success: false, error: 'Apenas administradores podem alterar senhas' }

        const passwordHash = await bcrypt.hash(password, 12)
        await sql`
            INSERT INTO profile_auth (user_id, password_hash)
            VALUES (${userId}, ${passwordHash})
            ON CONFLICT (user_id) DO UPDATE SET password_hash = ${passwordHash}
        `
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
