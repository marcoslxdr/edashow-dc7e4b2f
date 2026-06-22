/**
 * Geração automática e manual de posts via IA.
 *
 * Cron daily-posts (somente banco + stock, sem capa Gemini):
 *   ENABLE_DAILY_POSTS=true
 *
 * Geração manual no CMS (/cms/ia) e outros crons (cowork-news, generate-posts):
 *   ENABLE_POST_GENERATION=true
 *
 * O valor de ENABLE_POST_GENERATION é exposto ao client via next.config.
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

/** Cron daily-posts: pode rodar sem reativar geração manual no CMS. */
export function isDailyPostsEnabled(): boolean {
  return (
    parseEnvFlag(process.env.ENABLE_DAILY_POSTS) ||
    isPostGenerationEnabled()
  )
}

export function assertPostGenerationEnabled(): void {
  if (!isPostGenerationEnabled()) {
    throw new Error(POST_GENERATION_DISABLED_MESSAGE)
  }
}
