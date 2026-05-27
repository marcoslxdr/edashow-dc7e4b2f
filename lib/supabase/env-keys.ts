/**
 * Supabase API keys: supports legacy JWT anon key and newer publishable keys (sb_publishable_...).
 */
export function getSupabasePublicKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!key) {
    throw new Error(
      'Defina NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  return key
}

export function getSupabaseServiceRoleKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim()

  if (!key) {
    throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY (secret / service_role) no ambiente.')
  }

  return key
}
