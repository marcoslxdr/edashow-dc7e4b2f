'use client'

import Image from 'next/image'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CoveragePost {
    id: string
    title: string
    slug: string
    excerpt?: string | null
    cover_image_url?: string | null
    published_at?: string | null
}

interface EventCoveragePostsProps {
    posts: CoveragePost[]
}

export function EventCoveragePosts({ posts }: EventCoveragePostsProps) {
    if (!posts.length) return null

    return (
        <>
            <div className="flex gap-4 overflow-x-auto pb-2 md:hidden snap-x">
                {posts.map((post) => (
                    <Link
                        key={post.id}
                        href={`/posts/${post.slug}`}
                        className="snap-start shrink-0 w-[280px] group"
                    >
                        <CoverageCard post={post} />
                    </Link>
                ))}
            </div>
            <div className="hidden md:grid md:grid-cols-3 gap-6">
                {posts.map((post) => (
                    <Link key={post.id} href={`/posts/${post.slug}`} className="group">
                        <CoverageCard post={post} />
                    </Link>
                ))}
            </div>
        </>
    )
}

function CoverageCard({ post }: { post: CoveragePost }) {
    const imageUrl = post.cover_image_url || '/conference-healthcare-panel.jpg'
    const dateLabel = post.published_at
        ? format(new Date(post.published_at), "d 'de' MMMM, yyyy", { locale: ptBR })
        : null

    return (
        <article className="overflow-hidden rounded-xl border border-border bg-card transition-shadow duration-200 ease-out group-hover:shadow-md">
            <div className="relative aspect-[16/10] bg-muted">
                <Image
                    src={imageUrl}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 280px, 33vw"
                />
            </div>
            <div className="p-4">
                {dateLabel && (
                    <p className="text-xs text-muted-foreground mb-1">{dateLabel}</p>
                )}
                <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200">
                    {post.title}
                </h3>
                {post.excerpt && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                )}
            </div>
        </article>
    )
}
