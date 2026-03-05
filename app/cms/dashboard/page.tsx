'use client'

import React, { useEffect, useState } from 'react'
import {
    FileText,
    Calendar,
    Megaphone,
    Mail,
    ArrowUpRight,
    TrendingUp,
    Clock,
    ExternalLink,
    Plus
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import Link from 'next/link'

export default function CMSDashboard() {
    const [stats, setStats] = useState({
        posts: 0,
        events: 0,
        sponsors: 0,
        subscribers: 0
    })
    const [recentPosts, setRecentPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch('/api/cms/stats')
                const data = await res.json()
                setStats({
                    posts: data.posts || 0,
                    events: data.events || 0,
                    sponsors: data.sponsors || 0,
                    subscribers: data.subscribers || 0
                })
                setRecentPosts(data.recentPosts || [])
            } catch (error) {
                console.error('Error fetching stats:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    const statCards = [
        { label: 'Total de Posts', value: stats.posts, icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50' },
        { label: 'Eventos', value: stats.events, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Patrocinadores', value: stats.sponsors, icon: Megaphone, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Assinantes', value: stats.subscribers, icon: Mail, color: 'text-green-600', bg: 'bg-green-50' },
    ]

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Welcome Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bem-vindo ao Dashboard</h1>
                    <p className="text-gray-500 font-medium mt-1">Aqui está o que está acontecendo no seu site hoje.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/cms/posts/new">
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold">
                            <Plus className="w-4 h-4 mr-2" /> Novo Post
                        </Button>
                    </Link>
                    <Link href="/cms/events/new">
                        <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 font-bold">
                            <Plus className="w-4 h-4 mr-2" /> Novo Evento
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, i) => (
                    <Card key={i} className="bg-white border-gray-200 shadow-sm group hover:border-orange-400 transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className={cn("p-2 rounded-lg", stat.bg)}>
                                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                                </div>
                                <TrendingUp className="w-4 h-4 text-gray-300" />
                            </div>
                            <div className="mt-3">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-2xl font-bold mt-1 tracking-tight text-gray-900">
                                        {loading ? <div className="h-8 w-12 bg-gray-100 animate-pulse rounded" /> : stat.value}
                                    </h3>
                                    <span className="text-xs text-green-500 font-medium">+0%</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Posts List */}
            <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between py-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        <CardTitle className="text-lg font-bold text-gray-900">Posts Recentes</CardTitle>
                    </div>
                    <Link href="/cms/posts" className="text-xs text-orange-600 hover:text-orange-500 font-semibold flex items-center gap-1 transition-colors">
                        Ver todos <ArrowUpRight className="w-3 h-3" />
                    </Link>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <div key={i} className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-100 rounded animate-pulse" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-1/2 bg-gray-100 animate-pulse rounded" />
                                        <div className="h-3 w-1/4 bg-gray-100 animate-pulse rounded" />
                                    </div>
                                </div>
                            ))
                        ) : recentPosts.length > 0 ? (
                            recentPosts.map((post) => (
                                <div key={post.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                            {post.cover_image_url ? (
                                                <img
                                                    src={post.cover_image_url}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                                                    {post.title.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-1">{post.title}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                                    post.status === 'published' ? "bg-green-50 text-green-700 border border-green-100" : "bg-gray-100 text-gray-500 border border-gray-200"
                                                )}>
                                                    {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {new Date(post.created_at).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Link href={`/cms/posts/${post.id}`} className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ExternalLink className="w-4 h-4 text-gray-400 hover:text-gray-900" />
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400 italic">Nenhum post encontrado.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ')
}
