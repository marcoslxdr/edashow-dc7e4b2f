'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, Layers, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GeneratePostTab } from '@/components/cms/ia/GeneratePostTab'
import { BatchGenerateTab } from '@/components/cms/ia/BatchGenerateTab'
import { KeywordsTab } from '@/components/cms/ia/KeywordsTab'
import { PostGenerationDisabled } from '@/components/cms/ia/PostGenerationDisabled'
import { isPostGenerationEnabled } from '@/lib/feature-flags'

const postGenerationEnabled = isPostGenerationEnabled()

type TabId = 'gerar' | 'lote' | 'palavras-chave'

interface Tab {
    id: TabId
    label: string
    icon: React.ElementType
    component: React.ComponentType
}

const tabs: Tab[] = [
    { id: 'gerar', label: 'Gerar Post', icon: Sparkles, component: GeneratePostTab },
    { id: 'lote', label: 'Gerar em Lote', icon: Layers, component: BatchGenerateTab },
    { id: 'palavras-chave', label: 'Palavras-chave', icon: Tag, component: KeywordsTab }
]

export default function IAPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tabFromUrl = searchParams.get('tab') as TabId | null

    const [activeTab, setActiveTab] = useState<TabId>(() => {
        if (tabFromUrl && tabs.find(t => t.id === tabFromUrl)) {
            return tabFromUrl
        }
        return postGenerationEnabled ? 'gerar' : 'palavras-chave'
    })

    const handleTabChange = (tabId: TabId) => {
        setActiveTab(tabId)
        router.push(`/cms/ia?tab=${tabId}`, { scroll: false })
    }

    useEffect(() => {
        if (tabFromUrl && tabs.find(t => t.id === tabFromUrl) && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl)
        }
    }, [tabFromUrl, activeTab])

    const generationTabs: TabId[] = ['gerar', 'lote']
    const visibleTabs = postGenerationEnabled
        ? tabs
        : tabs.filter((tab) => !generationTabs.includes(tab.id))

    const ActiveComponent = visibleTabs.find(t => t.id === activeTab)?.component || KeywordsTab
    const showGenerationDisabled =
        !postGenerationEnabled && generationTabs.includes(activeTab)

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
                <div className="px-6 py-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl shadow-lg">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">AI Content Studio</h1>
                            <p className="text-sm text-gray-500">Crie conteúdo com inteligência artificial</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {showGenerationDisabled ? <PostGenerationDisabled /> : <ActiveComponent />}
                </div>
            </div>
        </div>
    )
}
