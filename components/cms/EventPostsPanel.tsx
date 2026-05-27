'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Link2, Loader2, Newspaper, Plus, Unlink } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getEventPosts, linkPostToEvent, searchPostsForLink } from '@/lib/actions/cms-event-posts'
import { toast } from 'sonner'

interface EventPostsPanelProps {
    eventId: string
}

export function EventPostsPanel({ eventId }: EventPostsPanelProps) {
    const [posts, setPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [searching, setSearching] = useState(false)
    const [linkingId, setLinkingId] = useState<string | null>(null)

    const loadPosts = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getEventPosts(eventId)
            setPosts(data)
        } catch {
            toast.error('Erro ao carregar posts.')
        }
        setLoading(false)
    }, [eventId])

    useEffect(() => {
        loadPosts()
    }, [loadPosts])

    useEffect(() => {
        const t = setTimeout(async () => {
            setSearching(true)
            try {
                const data = await searchPostsForLink(query, eventId)
                setSearchResults(data)
            } catch {
                setSearchResults([])
            }
            setSearching(false)
        }, 300)
        return () => clearTimeout(t)
    }, [query, eventId])

    const handleLink = async (postId: string) => {
        setLinkingId(postId)
        try {
            await linkPostToEvent(postId, eventId)
            toast.success('Post vinculado.')
            setQuery('')
            await loadPosts()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erro ao vincular.')
        }
        setLinkingId(null)
    }

    const handleUnlink = async (postId: string) => {
        setLinkingId(postId)
        try {
            await linkPostToEvent(postId, null)
            toast.success('Post desvinculado.')
            await loadPosts()
        } catch {
            toast.error('Erro ao desvincular.')
        }
        setLinkingId(null)
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
                <Link href={`/cms/posts/new?event_id=${eventId}`}>
                    <Button type="button" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo post de cobertura
                    </Button>
                </Link>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-primary" />
                    Vincular post existente
                </h3>
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por título..."
                />
                {searching && (
                    <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                )}
                <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {searchResults.map((p) => (
                        <li key={p.id} className="flex items-center justify-between py-2 gap-2">
                            <span className="text-sm truncate">{p.title}</span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={linkingId === p.id || p.event_id === eventId}
                                onClick={() => handleLink(p.id)}
                            >
                                Vincular
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-primary" />
                    Posts vinculados ({posts.length})
                </h3>
                {posts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Nenhum post vinculado. Crie um novo ou vincule um existente.
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {posts.map((post) => (
                            <li key={post.id} className="flex items-center justify-between py-3 gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{post.title}</p>
                                    <p className="text-xs text-muted-foreground uppercase">{post.status}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Link href={`/cms/posts/${post.id}`}>
                                        <Button type="button" variant="ghost" size="icon">
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={linkingId === post.id}
                                        onClick={() => handleUnlink(post.id)}
                                        className="text-destructive"
                                    >
                                        <Unlink className="w-4 h-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
