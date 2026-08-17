import { NextResponse } from 'next/server'
import { suggestKeywords } from '@/lib/ai/keyword-planner'
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
        const { topic } = body

        if (!topic) {
            return NextResponse.json(
                { error: 'Topic is required' },
                { status: 400 }
            )
        }

        const result = await suggestKeywords(topic)

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Keyword suggestion error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to suggest keywords' },
            { status: 500 }
        )
    }
}
