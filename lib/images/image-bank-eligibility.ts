import { IMAGE_BANK_COOLDOWN_DAYS } from './image-bank-config'

export function isAssetEligible(
  lastUsedAt: Date | null,
  now: Date,
  cooldownDays: number = IMAGE_BANK_COOLDOWN_DAYS
): boolean {
  if (!lastUsedAt) return true
  const ms = cooldownDays * 24 * 60 * 60 * 1000
  return now.getTime() - lastUsedAt.getTime() >= ms
}
