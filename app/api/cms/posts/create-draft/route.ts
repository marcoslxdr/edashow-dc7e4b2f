import { NextResponse } from 'next/server'
import { savePost } from '@/lib/actions/cms-posts'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        
        // Prepare data for savePost
        // We map the AI generated fields to the CMS fields
        const postData = {
            id: 'new',
            title: body.title,
            slug: body.slug,
            excerpt: body.excerpt,
            content: body.content,
            meta_description: body.metaDescription || body.meta_description || '',
            cover_image_url: body.coverImageUrl || body.cover_image_url || '',
            tags: body.suggestedTags || body.tags || [],
            status: 'draft',
            category_id: null,
            columnist_id: null,
            featured_home: false
        }

        const savedPost = await savePost(postData)

        return NextResponse.json(savedPost)

    } catch (error: any) {
        console.error('Save draft error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to save draft' },
            { status: 500 }
        )
    }
}
