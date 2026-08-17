'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from './cms-authz'

export interface User {
    id: string
    email: string
    name: string
    role: 'admin' | 'editor' | 'user'
    created_at: string
    last_sign_in?: string
}

export async function getUsers(): Promise<User[]> {
    await requireAdmin()
    const supabase = await createClient()

    // Get all users from profiles and join with user_roles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

    if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
        return []
    }

    // Get roles for all users
    const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')

    if (rolesError) {
        console.error('Error fetching roles:', rolesError)
    }

    const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || [])

    return profiles.map(profile => ({
        id: profile.id,
        email: profile.email || '',
        name: profile.name || profile.email?.split('@')[0] || 'Sem nome',
        role: (rolesMap.get(profile.id) || 'user') as 'admin' | 'editor' | 'user',
        created_at: profile.created_at,
        last_sign_in: profile.last_sign_in_at
    }))
}

export async function updateUserRole(userId: string, role: 'admin' | 'editor' | 'user'): Promise<{ success: boolean; error?: string }> {
    await requireAdmin()
    // Use admin client to bypass RLS
    const supabase = await createAdminClient()

    // Check if role exists for user
    const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single()

    if (existingRole) {
        // Update existing role
        const { error } = await supabase
            .from('user_roles')
            .update({ role, updated_at: new Date().toISOString() })
            .eq('user_id', userId)

        if (error) {
            console.error('Error updating role:', error)
            return { success: false, error: error.message }
        }
    } else {
        // Insert new role
        const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role })

        if (error) {
            console.error('Error inserting role:', error)
            return { success: false, error: error.message }
        }
    }

    revalidatePath('/cms/settings/users')
    return { success: true }
}

export async function updateUserProfile(userId: string, data: { name?: string; email?: string }): Promise<{ success: boolean; error?: string }> {
    await requireAdmin()
    // Use admin client to bypass RLS
    const supabase = await createAdminClient()

    const { error } = await supabase
        .from('profiles')
        .update({
            ...data,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) {
        console.error('Error updating profile:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/cms/settings/users')
    return { success: true }
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    await requireAdmin()
    // Use admin client to bypass RLS
    const supabase = await createAdminClient()

    // Delete role first
    await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

    // Delete profile
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

    if (error) {
        console.error('Error deleting user:', error)
        return { success: false, error: error.message }
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) {
        console.error('Error deleting auth user:', authError)
        return { success: false, error: authError.message }
    }

    revalidatePath('/cms/settings/users')
    return { success: true }
}

export async function createUser(data: { email: string; password: string; name: string; role: 'admin' | 'editor' }): Promise<{ success: boolean; error?: string }> {
    await requireAdmin()
    const supabase = await createAdminClient()

    // Create and confirm the account server-side; credentials never reach the browser.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { name: data.name }
    })

    if (authError) {
        console.error('Error creating user:', authError)
        return { success: false, error: authError.message }
    }

    if (authData.user) {
        // Create profile
        await supabase
            .from('profiles')
            .upsert({
                id: authData.user.id,
                email: data.email,
                name: data.name
            })

        // Create role
        await supabase
            .from('user_roles')
            .upsert({
                user_id: authData.user.id,
                role: data.role
            })
    }

    revalidatePath('/cms/settings/users')
    return { success: true }
}

export async function updateUserPassword(userId: string, password: string): Promise<{ success: boolean; error?: string }> {
    await requireAdmin()

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password }
    )

    if (error) {
        console.error('Error updating password:', error)
        return { success: false, error: error.message }
    }

    return { success: true }
}

