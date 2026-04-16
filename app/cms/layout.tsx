'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
    LayoutDashboard,
    FileText,
    Tags,
    Users,
    Calendar,
    Image as ImageIcon,
    Megaphone,
    Mail,
    Settings,
    LogOut,
    ChevronRight,
    Menu,
    X,
    User,
    Sparkles,
    Share2,
    Youtube,
    BookOpen
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { isAuthenticated, logout, getCurrentUser } from '@/lib/actions/cms-auth'
import { cn } from '@/lib/utils'

const navItems = [
    { label: 'Dashboard', href: '/cms/dashboard', icon: LayoutDashboard },
    { label: 'Posts', href: '/cms/posts', icon: FileText },
    { label: 'IA', href: '/cms/ia', icon: Sparkles },
    { label: 'Categorias', href: '/cms/categories', icon: Tags },
    { label: 'Colunistas', href: '/cms/columnists', icon: Users },
    { label: 'Eventos', href: '/cms/events', icon: Calendar },
    { label: 'Patrocinadores', href: '/cms/sponsors', icon: Megaphone },
    { label: 'Publicidades', href: '/cms/banners', icon: Megaphone },
    { label: 'YouTube', href: '/cms/youtube', icon: Youtube },
    { label: 'Newsletter', href: '/cms/newsletter', icon: Mail },
    { label: 'Galeria & Mídia', href: '/cms/media', icon: ImageIcon },
    { label: 'Configurações', href: '/cms/settings', icon: Settings },
    { label: 'Documentação', href: '/cms/docs', icon: BookOpen },
]

export default function CMSLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Start closed for mobile, will adjust in useEffect

    useEffect(() => {
        const checkScreenSize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarOpen(false)
            } else {
                setIsSidebarOpen(true)
            }
        }

        checkScreenSize()
        window.addEventListener('resize', checkScreenSize)
        return () => window.removeEventListener('resize', checkScreenSize)
    }, [])

    // Skip auth check for login page
    const isLoginPage = pathname === '/cms/login'

    useEffect(() => {
        if (isLoginPage) {
            setLoading(false)
            return
        }

        async function checkAuth() {
            const auth = await isAuthenticated()
            if (!auth) {
                router.push('/cms/login')
            } else {
                const u = await getCurrentUser()
                setUser(u)
                setLoading(false)
            }
        }

        checkAuth()
    }, [router, isLoginPage])

    if (loading && !isLoginPage) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (isLoginPage) return <>{children}</>

    return (
        <div className="fixed inset-0 h-screen bg-gray-50 text-gray-900 flex overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Desktop */}
            <aside
                className={cn(
                    "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col z-50 shadow-md h-full shrink-0",
                    "fixed lg:relative inset-y-0 left-0",
                    isSidebarOpen
                        ? "w-64 translate-x-0"
                        : "w-20 -translate-x-full lg:translate-x-0"
                )}
            >

                {/* Navigation Items */}
                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                                    isActive
                                        ? "bg-orange-500 text-white"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-500 group-hover:text-orange-500")} />
                                {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                            </Link>
                        )
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={() => logout()}
                        className="flex items-center gap-3 px-3 py-2 w-full text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        {isSidebarOpen && <span className="font-medium text-sm">Sair</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Header/TopBar */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <h2 className="text-sm font-medium text-gray-600">
                            {navItems.find(i => i.href === pathname)?.label || 'Painel'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link href="/" target="_blank" className="text-sm text-gray-600 hover:text-orange-500 transition-colors hidden sm:block">
                            Ver site
                        </Link>
                        <div className="w-px h-6 bg-gray-300 mx-2 hidden sm:block" />
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-semibold text-gray-900 leading-none">{user?.name}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{user?.role}</p>
                            </div>
                            <Avatar className="h-8 w-8 ring-2 ring-gray-200">
                                <AvatarFallback className="bg-orange-500 text-white text-xs">
                                    {user?.name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </header>

                {/* Main View */}
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div >
    )
}
