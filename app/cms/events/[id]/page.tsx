import React from 'react'
import { getEvent } from '@/lib/actions/cms-events'
import { EventEditor } from '@/components/cms/EventEditor'
import { notFound } from 'next/navigation'

export default async function CMSEventEditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    let event = null
    if (id !== 'new') {
        try {
            event = await getEvent(id)
        } catch (e) {
            notFound()
        }
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <EventEditor event={event} />
        </div>
    )
}
