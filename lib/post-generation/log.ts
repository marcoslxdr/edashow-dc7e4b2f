import { createAdminClient } from '@/lib/supabase/server'

export type PostGenerationPipeline = 'keyword' | 'news' | 'cold' | 'manual'

export interface LogPostGenerationInput {
  keyword: string
  postId?: string | null
  pipeline?: PostGenerationPipeline
  imageSource?: string
  durationMs?: number
}

export async function logPostGeneration(input: LogPostGenerationInput): Promise<void> {
  const supabase = await createAdminClient()
  const { error } = await supabase.from('post_generation_log').insert({
    keyword: input.keyword,
    post_id: input.postId ?? null,
    pipeline: input.pipeline ?? 'keyword',
    image_source: input.imageSource ?? null,
    duration_ms: input.durationMs ?? null,
    run_date: new Date().toISOString().slice(0, 10),
  })

  if (error) {
    console.warn('[post-generation-log] insert failed:', error.message)
  }
}

/** Keywords usadas nos últimos N dias (case-insensitive). */
export async function getRecentlyUsedKeywords(cooldownDays: number): Promise<Set<string>> {
  const supabase = await createAdminClient()
  const since = new Date()
  since.setDate(since.getDate() - cooldownDays)

  const { data, error } = await supabase
    .from('post_generation_log')
    .select('keyword')
    .gte('used_at', since.toISOString())

  if (error) {
    console.warn('[post-generation-log] fetch failed:', error.message)
    return new Set()
  }

  return new Set((data ?? []).map((row) => row.keyword.toLowerCase().trim()))
}
