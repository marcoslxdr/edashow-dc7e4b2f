'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Settings, Search, Share2, ImageIcon, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GeneralSettingsTab } from '@/components/cms/settings/GeneralSettingsTab'
import { SEOSettingsTab } from '@/components/cms/settings/SEOSettingsTab'
import { SocialSettingsTab } from '@/components/cms/settings/SocialSettingsTab'
import { ImageSettingsTab } from '@/components/cms/settings/ImageSettingsTab'
import { UsersSettingsTab } from '@/components/cms/settings/UsersSettingsTab'
import { getCurrentUser } from '@/lib/actions/cms-auth'

type TabId = 'general' | 'seo' | 'social' | 'images' | 'users'

interface Tab {
    id: TabId
    label: string
    icon: React.ElementType
    component: React.ComponentType
}

const tabs: Tab[] = [
    { id: 'general', label: 'Geral', icon: Settings, component: GeneralSettingsTab },
    { id: 'seo', label: 'SEO & Analytics', icon: Search, component: SEOSettingsTab },
    { id: 'social', label: 'Redes Sociais', icon: Share2, component: SocialSettingsTab },
    { id: 'images', label: 'Imagens', icon: ImageIcon, component: ImageSettingsTab },
    { id: 'users', label: 'Usuários', icon: Users, component: UsersSettingsTab }
]

export default function SettingsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tabFromUrl = searchParams.get('tab') as TabId | null

    const [activeTab, setActiveTab] = useState<TabId>(() => {
        if (tabFromUrl && tabs.find(t => t.id === tabFromUrl)) {
            return tabFromUrl
        }
        return 'general'
    })
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

    useEffect(() => {
        getCurrentUser()
            .then((user) => setIsAdmin(user?.role === 'admin'))
            .catch(() => setIsAdmin(false))
    }, [])

    // A non-admin cannot remain on the hidden Users tab when loading a deep link.
    useEffect(() => {
        if (isAdmin === false && activeTab === 'users') {
            setActiveTab('general')
            router.replace('/cms/settings?tab=general', { scroll: false })
        }
    }, [activeTab, isAdmin, router])

    // Update URL when tab changes
    const handleTabChange = (tabId: TabId) => {
        setActiveTab(tabId)
        const newUrl = `/cms/settings?tab=${tabId}`
        router.push(newUrl, { scroll: false })
    }

    // Sync with URL changes
    useEffect(() => {
        if (
            tabFromUrl &&
            tabs.find(t => t.id === tabFromUrl) &&
            !(tabFromUrl === 'users' && isAdmin === false) &&
            tabFromUrl !== activeTab
        ) {
            setActiveTab(tabFromUrl)
        }
    }, [tabFromUrl, activeTab, isAdmin])

    const visibleTabs = tabs.filter(tab => tab.id !== 'users' || isAdmin === true)
    const ActiveComponent = visibleTabs.find(t => t.id === activeTab)?.component || GeneralSettingsTab

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Tabs Header - Fixed at top */}
            <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
                <div className="px-6 py-4">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Configurações</h1>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {visibleTabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
                                        "border-2",
                                        isActive
                                            ? "bg-orange-500 text-white border-orange-500 shadow-md"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50"
                                    )}
                                >
                                    <Icon className={cn(
                                        "w-4 h-4",
                                        isActive ? "text-white" : "text-gray-500"
                                    )} />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                    <ActiveComponent />
                </div>
            </div>
        </div>
    )
}
