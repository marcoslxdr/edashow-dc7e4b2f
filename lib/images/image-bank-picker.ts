import { createAdminClient } from '@/lib/supabase/admin'
import { keywordToVisualCategorySlug } from './keyword-to-visual-category'
import { isAssetEligible } from './image-bank-eligibility'
import type { ImageBankAssetRow, ImageBankProvider } from './image-bank-config'

export interface PickedImageBankAsset {
  assetId: string
  publicUrl: string
  categorySlug: string
  provider: ImageBankProvider
}

type PickableAsset = Pick<
  ImageBankAssetRow,
  'id' | 'public_url' | 'provider' | 'last_used_at' | 'use_count' | 'seeded_at'
>

export async function pickImageForKeyword(keyword: string): Promise<PickedImageBankAsset | null> {
  const categorySlug = keywordToVisualCategorySlug(keyword)
  const supabase = createAdminClient()
  const now = new Date()

  const { data: category, error: catError } = await supabase
    .from('image_bank_categories')
    .select('id, slug')
    .eq('slug', categorySlug)
    .eq('active', true)
    .maybeSingle()

  if (catError || !category) {
    console.warn('[IMAGE-BANK] category not found:', categorySlug, catError?.message)
    return null
  }

  const { data: assets, error: assetsError } = await supabase
    .from('image_bank_assets')
    .select('id, public_url, provider, last_used_at, use_count, seeded_at')
    .eq('category_id', category.id)

  if (assetsError || !assets?.length) {
    console.warn('[IMAGE-BANK] no assets for category:', categorySlug)
    return null
  }

  const eligible = (assets as PickableAsset[]).filter((a) =>
    isAssetEligible(a.last_used_at ? new Date(a.last_used_at) : null, now)
  )

  if (!eligible.length) {
    console.warn('[IMAGE-BANK] pool exhausted (cooldown) for:', categorySlug)
    return null
  }

  eligible.sort((a, b) => {
    const aTime = a.last_used_at ? new Date(a.last_used_at).getTime() : 0
    const bTime = b.last_used_at ? new Date(b.last_used_at).getTime() : 0
    if (aTime !== bTime) return aTime - bTime
    return new Date(a.seeded_at).getTime() - new Date(b.seeded_at).getTime()
  })

  const top = eligible.slice(0, Math.min(3, eligible.length))
  const pick = top[Math.floor(Math.random() * top.length)]

  const { error: updateError } = await supabase
    .from('image_bank_assets')
    .update({
      last_used_at: now.toISOString(),
      use_count: (pick.use_count ?? 0) + 1,
    })
    .eq('id', pick.id)

  if (updateError) {
    console.error('[IMAGE-BANK] failed to mark used:', updateError.message)
    return null
  }

  return {
    assetId: pick.id,
    publicUrl: pick.public_url,
    categorySlug: category.slug,
    provider: pick.provider as ImageBankProvider,
  }
}
