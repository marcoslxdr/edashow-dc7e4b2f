import { NextResponse } from 'next/server'
import { generateAIPost } from '@/lib/actions/ai-posts'
import { generateAICoverImage, getAICoverSuggestions, selectAICoverImage } from '@/lib/actions/ai-images'
import { savePost } from '@/lib/actions/cms-posts'
import { selectRandomKeywords } from '@/lib/constants/health-insurance-keywords'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Accept keyword from body or select random
  let keyword: string
  try {
    const body = await request.json().catch(() => ({}))
    keyword = body.keyword || selectRandomKeywords(1)[0]
  } catch {
    keyword = selectRandomKeywords(1)[0]
  }

  try {
    // 1. Generate post content with AI
    const post = await generateAIPost({
      topic: keyword,
      wordCount: 1000,
      tone: 'professional',
      autoCategorize: true,
      additionalInstructions: `Foque no contexto brasileiro de planos de saúde.
Mencione a ANS (Agência Nacional de Saúde Suplementar) quando relevante.
Inclua dicas práticas e acionáveis para o leitor.
Use exemplos reais do mercado brasileiro.
O conteúdo deve ser educativo e ajudar consumidores a tomar decisões informadas.
Pesquise informações atualizadas sobre o tema.`
    })

    // 2. Generate cover image (Gemini -> Pexels fallback)
    let coverImageUrl = ''

    // Try Gemini first
    try {
      const geminiResult = await generateAICoverImage({
        title: post.title,
        content: post.content
      })
      if (geminiResult.url && !geminiResult.error) {
        coverImageUrl = geminiResult.url
      }
    } catch {
      // Gemini failed, will try Pexels
    }

    // Fallback to Pexels
    if (!coverImageUrl) {
      try {
        const imageResult = await getAICoverSuggestions({
          title: post.title,
          content: post.content,
          count: 1
        })
        if (imageResult.images.length > 0) {
          const img = imageResult.images[0]
          // Download and save to Supabase Storage
          const saved = await selectAICoverImage(
            img.url,
            img.source as 'pexels' | 'unsplash' | 'gemini'
          )
          if (saved.url) {
            coverImageUrl = saved.url
          }
        }
      } catch {
        // Continue without image
      }
    }

    // 3. Save as draft
    const savedPost = await savePost({
      id: 'new',
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      meta_description: post.metaDescription,
      cover_image_url: coverImageUrl,
      tags: post.suggestedTags,
      status: 'draft',
      category_id: post.categoryId || null,
      columnist_id: null,
      featured_home: false,
      featured_category: false
    })

    return NextResponse.json({
      success: true,
      keyword,
      title: post.title,
      postId: savedPost?.id,
      hasImage: !!coverImageUrl,
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
