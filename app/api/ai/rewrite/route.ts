import { NextResponse } from 'next/server'
import { rewriteContent, logGeneration } from '@/lib/ai/content-generator'
import { checkAIConfiguration } from '@/lib/actions/ai-posts'
import { requireCmsRole } from '@/lib/actions/cms-authz'

export async function POST(req: Request) {
    try {
        await requireCmsRole()
    } catch {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    try {
        const { configured } = await checkAIConfiguration()
        if (!configured) {
            return NextResponse.json(
                { error: 'AI not configured' },
                { status: 503 }
            )
        }

        const body = await req.json()
        const { sourceContent, sourceUrl, tone, instructions } = body

        if (!sourceContent) {
            return NextResponse.json(
                { error: 'Source content is required' },
                { status: 400 }
            )
        }

        const result = await rewriteContent({
            sourceContent,
            tone: tone || 'professional',
            instructions
        })

        // Log the generation
        await logGeneration(
            'rewrite',
            { sourceUrl, length: sourceContent.length, tone },
            { title: result.title },
            process.env.OPENCODE_POST_MODEL || 'kimi-k2.6',
            0, // Token usage calculation requires extra logic with Vercel AI SDK
            0
        )

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Rewrite error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to rewrite content' },
            { status: 500 }
        )
    }
}
