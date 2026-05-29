/**
 * Geração automática e manual de posts via IA.
 *
 * Desligado por padrão. Para reativar, defina no .env ou na Vercel:
 *   ENABLE_POST_GENERATION=true
 *
 * O valor é exposto ao client via next.config (NEXT_PUBLIC_ENABLE_POST_GENERATION).
 */

export const POST_GENERATION_DISABLED_MESSAGE =
  'A geração de posts está temporariamente desabilitada. Defina ENABLE_POST_GENERATION=true para reativar.'

function parseEnvFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export function isPostGenerationEnabled(): boolean {
  return (
    parseEnvFlag(process.env.ENABLE_POST_GENERATION) ||
    parseEnvFlag(process.env.NEXT_PUBLIC_ENABLE_POST_GENERATION)
  )
}

export function assertPostGenerationEnabled(): void {
  if (!isPostGenerationEnabled()) {
    throw new Error(POST_GENERATION_DISABLED_MESSAGE)
  }
}
