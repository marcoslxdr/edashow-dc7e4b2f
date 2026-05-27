import { createClient } from '@supabase/supabase-js'
import { getSupabasePublicKey } from '@/lib/supabase/env-keys'

export function getPublicSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        getSupabasePublicKey(),
    )
}
