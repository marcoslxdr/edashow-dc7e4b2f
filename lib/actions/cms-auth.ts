'use server'

import { redirect } from 'next/navigation'
import { signIn, signOut, auth } from '@/auth'
import { sql } from '@/lib/db/client'

export interface AuthError {
  message: string
  errors?: Array<{
    message: string
    field?: string
  }>
}

export async function login(formData: { email: string; password: string; rememberMe?: boolean }): Promise<{ success: boolean } | AuthError> {
  try {
    await signIn('credentials', {
      email: formData.email,
      password: formData.password,
      redirect: false,
    })
    return { success: true }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('CredentialsSignin')) {
      return {
        message: 'Email ou senha incorretos',
        errors: [{ message: 'Credenciais inválidas' }],
      }
    }
    return {
      message: 'Erro ao fazer login',
      errors: [{ message: String(error) }],
    }
  }
}

export async function logout() {
  await signOut({ redirectTo: '/cms/login' })
}

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user) return null

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
    role: session.user.role ?? 'user',
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return !!user && (user.role === 'admin' || user.role === 'editor')
}

export async function getUserProfile(userId: string) {
  try {
    const rows = await sql`
      SELECT p.*, ur.role
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.id = ${userId}
      LIMIT 1
    `
    return rows[0] || null
  } catch {
    return null
  }
}
