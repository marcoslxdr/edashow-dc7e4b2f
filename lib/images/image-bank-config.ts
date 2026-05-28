export const IMAGE_BANK_COOLDOWN_DAYS = Number(process.env.IMAGE_BANK_COOLDOWN_DAYS ?? 45)
export const IMAGE_BANK_MIN_PER_CATEGORY = Number(process.env.IMAGE_BANK_MIN_PER_CATEGORY ?? 12)
export const IMAGE_BANK_TARGET_PER_CATEGORY = Number(process.env.IMAGE_BANK_TARGET_PER_CATEGORY ?? 15)
export const IMAGE_BANK_STORAGE_PREFIX = 'image-bank'

export type ImageBankProvider = 'pexels' | 'unsplash'

export interface ImageBankCategoryRow {
  id: string
  slug: string
  name: string
  search_queries: string[]
  display_order: number
  active: boolean
}

export interface ImageBankAssetRow {
  id: string
  category_id: string
  storage_path: string
  public_url: string
  provider: ImageBankProvider
  provider_image_id: string
  attribution_text: string | null
  attribution_url: string | null
  width: number | null
  height: number | null
  alt_text: string | null
  last_used_at: string | null
  use_count: number
  seeded_at: string
}
