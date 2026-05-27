/**
 * Valida .env.local para migração jqpb (sem imprimir segredos).
 */
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const DEST_REF = 'jqpbqrhlslgitifuliqa'

function jwtRef(key: string): string | null {
  const part = key.split('.')[1]
  if (!part) return null
  try {
    const j = JSON.parse(Buffer.from(part, 'base64url').toString()) as { ref?: string }
    return j.ref ?? null
  } catch {
    return null
  }
}

function dbRef(uri: string): string | null {
  const m = uri.match(/postgres\.([^:@/]+)/)
  return m?.[1] ?? null
}

let ok = true

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
if (!url.includes(DEST_REF)) {
  console.error(`❌ NEXT_PUBLIC_SUPABASE_URL deve ser https://${DEST_REF}.supabase.co`)
  ok = false
} else {
  console.log('✓ URL destino jqpb')
}

const destUri =
  process.env.MIGRATE_DEST_DATABASE_URI?.trim() ||
  (process.env.DATABASE_URI?.includes(DEST_REF) ? process.env.DATABASE_URI.trim() : '')

if (!destUri) {
  console.error(`❌ MIGRATE_DEST_DATABASE_URI ausente (Session :5432, ref ${DEST_REF})`)
  ok = false
} else {
  const ref = dbRef(destUri)
  if (ref !== DEST_REF) {
    console.error(`❌ URI DB ref=${ref ?? '?'} (esperado ${DEST_REF})`)
    ok = false
  } else {
    console.log('✓ URI Postgres destino')
  }
}

const svc = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
if (!svc) {
  console.warn('⚠ SUPABASE_SERVICE_ROLE_KEY ausente (auth/storage no migrate:supabase)')
} else {
  const ref = jwtRef(svc)
  if (ref !== DEST_REF) {
    console.error(`❌ service_role ref=${ref ?? '?'} (projeto antigo?) — cole key do ${DEST_REF}`)
    ok = false
  } else {
    console.log('✓ service_role destino')
  }
}

const pat = process.env.SUPABASE_ACCESS_TOKEN?.trim()
if (pat) console.log('✓ SUPABASE_ACCESS_TOKEN (import .cache/mcp_invoke)')
else console.log('ℹ SUPABASE_ACCESS_TOKEN opcional (Account → Access Tokens)')

process.exit(ok ? 0 : 1)
