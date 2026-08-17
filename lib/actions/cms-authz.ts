'use server'

import { createClient } from '@/lib/supabase/server'

export type CmsRole = 'admin' | 'editor'

/**
 * Server-side authorization for every CMS mutation.
 * Middleware only protects navigation; server actions and route handlers must
 * enforce the role again before using a service-role client.
 */
export async function requireCmsRole(allowed: CmsRole[] = ['admin', 'editor']) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Não autenticado')
  }

  const { data: roleData, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (error || !roleData || !allowed.includes(roleData.role as CmsRole)) {
    throw new Error('Acesso negado')
  }

  return { user, role: roleData.role as CmsRole }
}

export async function requireAdmin() {
  return requireCmsRole(['admin'])
}
