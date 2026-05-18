import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { PublishButton } from './publish-button'
import { normalizePostContent } from '@/lib/utils/post-content'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Preview do Rascunho',
    robots: { index: false, follow: false },
}

interface PreviewPageProps {
    params: Promise<{ token: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PreviewPage({ params }: PreviewPageProps) {
    const { token } = await params

    if (!UUID_RE.test(token)) {
        notFound()
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        notFound()
    }

    let post = null
    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/posts?id=eq.${encodeURIComponent(token)}&select=*&limit=1`,
            {
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                },
            }
        )
        if (res.ok) {
            const data = await res.json()
            if (data && data.length > 0) {
                post = data[0]
            }
        }
    } catch (err: any) {
        console.error('[preview]', err?.message || err)
    }

    if (!post) {
        notFound()
    }

    const html = normalizePostContent(post.content || '')

    return (
        <div className="min-h-screen bg-white">
            <div className="mx-auto max-w-3xl px-4 py-8">
                <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
                    <p className="text-sm font-medium text-amber-800">
                        Rascunho — este post ainda não foi publicado
                    </p>
                    <PublishButton postId={post.id} />
                </div>
                <article>
                    <header className="mb-8">
                        <h1 className="mb-4 text-3xl font-bold leading-tight text-gray-900 md:text-4xl">
                            {post.title}
                        </h1>
                        {post.excerpt && (
                            <p className="text-lg leading-relaxed text-gray-600">
                                {post.excerpt}
                            </p>
                        )}
                        {post.cover_image_url && (
                            <div className="mt-6 overflow-hidden rounded-lg">
                                <img
                                    src={post.cover_image_url}
                                    alt={post.title || ''}
                                    className="w-full object-cover"
                                    style={{ maxHeight: '400px' }}
                                />
                            </div>
                        )}
                    </header>
                    <div
                        className="prose prose-lg max-w-none"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                </article>
            </div>
        </div>
    )
}
