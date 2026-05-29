import { NextResponse } from 'next/server'
import { runNewsPipeline } from '@/lib/actions/news-pipeline'
import { isPostGenerationEnabled, POST_GENERATION_DISABLED_MESSAGE } from '@/lib/feature-flags'

export const maxDuration = 300 // 5 minutos
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Validate CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPostGenerationEnabled()) {
    console.log('[CRON:COWORK] Post generation disabled — skipping run')
    return NextResponse.json(
      { success: false, disabled: true, message: POST_GENERATION_DISABLED_MESSAGE },
      { status: 503 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const topic = body.topic || 'saude suplementar'
    const count = Math.min(body.count || 5, 10)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://edashow.com.br'

    console.log(`[CRON:COWORK] Starting: "${topic}" x${count}`)

    const { posts, whatsappMessage } = await runNewsPipeline({
      topic,
      count,
      siteUrl,
    })

    console.log(`[CRON:COWORK] Done: ${posts.length} posts saved`)
    console.log(`[CRON:COWORK] WhatsApp message:\n${whatsappMessage}`)

    return NextResponse.json({
      success: true,
      topic,
      count: posts.length,
      posts: posts.map(p => ({
        id: p.id,
        title: p.title,
        previewUrl: p.previewUrl,
        hasImage: p.hasImage,
      })),
      whatsappMessage,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON:COWORK] Pipeline error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
