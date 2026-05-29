import { NextResponse } from 'next/server'
import { generatePost, logGeneration } from '@/lib/ai/content-generator'
import { checkAIConfiguration } from '@/lib/actions/ai-posts'
import { isPostGenerationEnabled, POST_GENERATION_DISABLED_MESSAGE } from '@/lib/feature-flags'

export async function POST(req: Request) {
    try {
        if (!isPostGenerationEnabled()) {
            return NextResponse.json(
                { error: POST_GENERATION_DISABLED_MESSAGE, disabled: true },
                { status: 503 }
            )
        }

        const { configured } = await checkAIConfiguration()
        if (!configured) {
            return NextResponse.json(
                { error: 'AI not configured' },
                { status: 503 }
            )
        }

        const body = await req.json()
        const { topic, keywords, personaId, instructions, autoCategorize } = body

        if (!topic) {
            return NextResponse.json(
                { error: 'Topic is required' },
                { status: 400 }
            )
        }

        const result = await generatePost({
            topic,
            keywords,
            personaId: personaId || 'eda-pro',
            additionalInstructions: instructions,
            model: 'deepseek/deepseek-chat' // Use DeepSeek V3 for best results
        })

        // Log the generation
        await logGeneration(
            'post',
            { topic, keywords, personaId },
            { title: result.data.title },
            result.model,
            result.tokensUsed,
            result.cost
        )

        return NextResponse.json(result.data)

    } catch (error: any) {
        console.error('Generation error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate content' },
            { status: 500 }
        )
    }
}
