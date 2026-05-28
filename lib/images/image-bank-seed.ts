import { createAdminClient } from '@/lib/supabase/admin'
import { searchImages, downloadAndSaveImage } from './image-service'
import {
  IMAGE_BANK_MIN_PER_CATEGORY,
  IMAGE_BANK_TARGET_PER_CATEGORY,
  IMAGE_BANK_STORAGE_PREFIX,
  type ImageBankCategoryRow,
} from './image-bank-config'

export interface ImageBankSeedResult {
  categorySlug: string
  inserted: number
  skipped: number
  errors: string[]
}

export interface SeedImageBankOptions {
  dryRun?: boolean
  categorySlug?: string
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function assetExists(provider: string, providerImageId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('image_bank_assets')
    .select('id')
    .eq('provider', provider)
    .eq('provider_image_id', providerImageId)
    .maybeSingle()
  return !!data
}

export async function seedImageBank(options: SeedImageBankOptions = {}): Promise<ImageBankSeedResult[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('image_bank_categories')
    .select('*')
    .eq('active', true)
    .order('display_order')

  if (options.categorySlug) query = query.eq('slug', options.categorySlug)

  const { data: categories, error } = await query
  if (error || !categories?.length) throw new Error(error?.message || 'No categories')

  const results: ImageBankSeedResult[] = []

  for (const cat of categories as ImageBankCategoryRow[]) {
    const result: ImageBankSeedResult = {
      categorySlug: cat.slug,
      inserted: 0,
      skipped: 0,
      errors: [],
    }

    const { count } = await supabase
      .from('image_bank_assets')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', cat.id)

    const currentCount = count ?? 0
    if (currentCount >= IMAGE_BANK_TARGET_PER_CATEGORY) {
      results.push(result)
      continue
    }

    // Spec: only refill when below operational minimum (12), up to target (15)
    if (currentCount >= IMAGE_BANK_MIN_PER_CATEGORY) {
      results.push(result)
      continue
    }

    const needed = IMAGE_BANK_TARGET_PER_CATEGORY - currentCount
    const queries = Array.isArray(cat.search_queries) ? cat.search_queries : []

    for (const q of queries) {
      if (result.inserted >= needed) break

      for (const provider of ['pexels', 'unsplash'] as const) {
        if (result.inserted >= needed) break
        try {
          const search = await searchImages({
            query: q,
            provider,
            orientation: 'landscape',
            perPage: 10,
            page: 1,
          })

          for (const img of search.images) {
            if (result.inserted >= needed) break
            const providerId = img.id.replace(/^(pexels|unsplash)-/, '')
            if (await assetExists(img.provider, providerId)) {
              result.skipped++
              continue
            }

            if (options.dryRun) {
              result.inserted++
              continue
            }

            const folder = `${IMAGE_BANK_STORAGE_PREFIX}/${cat.slug}`
            const { publicUrl, storagePath } = await downloadAndSaveImage(img, folder)

            const { error: insertError } = await supabase.from('image_bank_assets').insert({
              category_id: cat.id,
              storage_path: storagePath,
              public_url: publicUrl,
              provider: img.provider,
              provider_image_id: providerId,
              attribution_text: img.photographer ?? null,
              attribution_url: img.photographerUrl ?? null,
              width: img.width,
              height: img.height,
              alt_text: img.alt || q,
            })

            if (insertError) {
              result.errors.push(insertError.message)
            } else {
              result.inserted++
            }

            await sleep(350)
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.includes('429')) await sleep(2000)
          result.errors.push(`${provider}/${q}: ${msg}`)
        }
      }
    }

    console.log(
      `[IMAGE-BANK-SEED] ${cat.slug}: +${result.inserted} skip=${result.skipped} err=${result.errors.length}`
    )
    results.push(result)
  }

  return results
}
