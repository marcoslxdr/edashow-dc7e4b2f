import {
  HEALTH_INSURANCE_KEYWORDS,
  selectRandomKeywords,
} from '@/lib/constants/health-insurance-keywords'
import { getRecentlyUsedKeywords } from './log'

function shuffleAndTake(pool: string[], count: number): string[] {
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function getKeywordCooldownDays(): number {
  return Number(process.env.KEYWORD_COOLDOWN_DAYS ?? 60)
}

export function getDailyKeywordCount(): number {
  return Number(process.env.DAILY_KEYWORD_COUNT ?? 3)
}

/**
 * Escolhe keywords evitando as usadas nos últimos KEYWORD_COOLDOWN_DAYS.
 * Se o pool filtrado for menor que count, completa com shuffle da lista inteira.
 */
export async function selectKeywordsForDailyRun(count: number): Promise<string[]> {
  const cooldownDays = getKeywordCooldownDays()
  const recentlyUsed = await getRecentlyUsedKeywords(cooldownDays)

  const available = HEALTH_INSURANCE_KEYWORDS.filter(
    (k) => !recentlyUsed.has(k.toLowerCase().trim())
  )

  if (available.length >= count) {
    return shuffleAndTake(available, count)
  }

  const picked = shuffleAndTake(available, available.length)
  const remaining = count - picked.length
  const extras = selectRandomKeywords(remaining).filter(
    (k) => !picked.includes(k)
  )

  return [...picked, ...extras].slice(0, count)
}
