import React from 'react'
import { getPost, getCategories, getColumnists } from '@/lib/actions/cms-posts'
import { PostEditor } from '@/components/cms/PostEditor'
import { notFound } from 'next/navigation'

export default async function CMSPostEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    let post = null
    if (id !== 'new') {
        try {
            post = await getPost(id)
        } catch (e) {
            notFound()
        }
    }

    const [categories, columnists] = await Promise.all([
        getCategories(),
        getColumnists()
    ])

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PostEditor
                post={post}
                categories={categories}
                columnists={columnists}
            />
        </div>
    )
}
