import { NextResponse } from 'next/server'
import { generateAIPost } from '@/lib/actions/ai-posts'
import { generateAICoverImage, getAICoverSuggestions, selectAICoverImage } from '@/lib/actions/ai-images'
import { savePost } from '@/lib/actions/cms-posts'
import { getProductionAdditionalInstructions } from '@/lib/ai/editorial-year'
import { selectRandomKeywords } from '@/lib/constants/health-insurance-keywords'
import { isPostGenerationEnabled, POST_GENERATION_DISABLED_MESSAGE } from '@/lib/feature-flags'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPostGenerationEnabled()) {
    console.log('[CRON] Post generation disabled — skipping run')
    return NextResponse.json(
      { success: false, disabled: true, message: POST_GENERATION_DISABLED_MESSAGE },
      { status: 503 }
    )
  }

  // Accept keyword from body or select random
  let keyword: string
  try {
    const body = await request.json().catch(() => ({}))
    keyword = body.keyword || selectRandomKeywords(1)[0]
  } catch {
    keyword = selectRandomKeywords(1)[0]
  }

  console.log(`[CRON] Starting post generation for keyword: "${keyword}"`)
  console.log(`[CRON] Using post model: ${process.env.OPENCODE_POST_MODEL || 'kimi-k2.6'}`)
  console.log(`[CRON] Using image model: ${process.env.OPENROUTER_IMAGE_MODEL || 'default'}`)

  try {
    // 1. Generate post content with AI
    console.log(`[CRON] Generating post content...`)
    const post = await generateAIPost({
      topic: keyword,
      wordCount: 1000,
      tone: 'professional',
      autoCategorize: true,
      additionalInstructions: getProductionAdditionalInstructions()
    })
    console.log(`[CRON] Post content generated: "${post.title}"`)

    // 2. Generate cover image (AI -> Pexels fallback)
    let coverImageUrl = ''
    let imageSource = 'none'

    // Try AI image generation first
    console.log(`[CRON] Generating cover image with AI...`)
    try {
      const geminiResult = await generateAICoverImage({
        title: post.title,
        content: post.content
      })
      if (geminiResult.url && !geminiResult.error) {
        coverImageUrl = geminiResult.url
        imageSource = 'gemini'
        console.log(`[CRON] AI image generated successfully: ${coverImageUrl.substring(0, 80)}...`)
      } else {
        console.log(`[CRON] AI image generation returned error: ${geminiResult.error}`)
      }
    } catch (imageError) {
      console.log(`[CRON] AI image generation failed: ${imageError instanceof Error ? imageError.message : imageError}`)
    }

    // Fallback to Pexels
    if (!coverImageUrl) {
      console.log(`[CRON] Falling back to Pexels...`)
      try {
        const imageResult = await getAICoverSuggestions({
          title: post.title,
          content: post.content,
          count: 1
        })
        if (imageResult.images.length > 0) {
          const img = imageResult.images[0]
          console.log(`[CRON] Found Pexels image: ${img.url.substring(0, 80)}...`)
          // Download and save to Supabase Storage
          const saved = await selectAICoverImage(
            img.url,
            img.source as 'pexels' | 'unsplash' | 'gemini'
          )
          if (saved.url) {
            coverImageUrl = saved.url
            imageSource = 'pexels'
            console.log(`[CRON] Pexels image saved successfully`)
          } else {
            console.log(`[CRON] Failed to save Pexels image: ${saved.error}`)
          }
        } else {
          console.log(`[CRON] No images found on Pexels`)
        }
      } catch (pexelsError) {
        console.log(`[CRON] Pexels fallback failed: ${pexelsError instanceof Error ? pexelsError.message : pexelsError}`)
      }
    }

    if (!coverImageUrl) {
      console.log(`[CRON] WARNING: No cover image generated for post`)
    }

    // 3. Save as draft
    console.log(`[CRON] Saving post to database...`)
    const savedPost = await savePost({
      id: 'new',
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: coverImageUrl,
      tags: post.suggestedTags,
      status: 'draft',
      category_id: post.categoryId || null,
      columnist_id: null,
      featured_home: false
    })

    console.log(`[CRON] Post saved successfully: ID=${savedPost?.id}, hasImage=${!!coverImageUrl}, source=${imageSource}`)

    return NextResponse.json({
      success: true,
      keyword,
      title: post.title,
      postId: savedPost?.id,
      hasImage: !!coverImageUrl,
      imageSource,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error(`[CRON] Error generating post for "${keyword}":`, error)
    return NextResponse.json(
      {
        success: false,
        keyword,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
