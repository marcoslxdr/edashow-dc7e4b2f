import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceRoleSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getSupabasePublicKey, getSupabaseServiceRoleKey } from '@/lib/supabase/env-keys'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase client with service role privileges.
 * This client bypasses RLS (Row Level Security) and should ONLY be used
 * in server-side admin operations like CMS actions.
 * WARNING: Never expose this client to client-side code.
 *
 * Note: This client uses the standard Supabase client (not SSR) to avoid
 * cookie handling issues. Admin operations don't need user session management.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL for admin client.')
  }
  return createServiceRoleSupabaseClient(url, getSupabaseServiceRoleKey())
}
