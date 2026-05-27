'use client'

import { Camera, FileText, Lock, Newspaper, Youtube } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EventEditorStep = 'details' | 'gallery' | 'videos' | 'posts'

interface EventStepperProps {
    activeStep: EventEditorStep
    onStepChange: (step: EventEditorStep) => void
    eventId?: string
    photoCount?: number
    videoCount?: number
    postCount?: number
}

const STEPS: { id: EventEditorStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'details', label: 'Detalhes', icon: FileText },
    { id: 'gallery', label: 'Galeria', icon: Camera },
    { id: 'videos', label: 'Vídeos', icon: Youtube },
    { id: 'posts', label: 'Posts', icon: Newspaper },
]

export function EventStepper({
    activeStep,
    onStepChange,
    eventId,
    photoCount = 0,
    videoCount = 0,
    postCount = 0,
}: EventStepperProps) {
    const counts: Record<EventEditorStep, number | undefined> = {
        details: undefined,
        gallery: photoCount,
        videos: videoCount,
        posts: postCount,
    }

    return (
        <nav className="flex items-center gap-1 border-b border-border mb-6" aria-label="Etapas do evento">
            {STEPS.map((step) => {
                const locked = !eventId && step.id !== 'details'
                const isActive = activeStep === step.id
                const Icon = step.icon
                const count = counts[step.id]

                return (
                    <button
                        key={step.id}
                        type="button"
                        disabled={locked}
                        title={locked ? 'Salve o evento para acessar esta etapa' : undefined}
                        onClick={() => !locked && onStepChange(step.id)}
                        className={cn(
                            'px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 ease-out flex items-center gap-2',
                            isActive
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                            locked && 'opacity-50 cursor-not-allowed hover:text-muted-foreground',
                        )}
                        aria-current={isActive ? 'step' : undefined}
                    >
                        {locked ? <Lock className="w-3.5 h-3.5" /> : <Icon className="w-4 h-4" />}
                        {step.label}
                        {count !== undefined && count > 0 && (
                            <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                                {count}
                            </span>
                        )}
                    </button>
                )
            })}
        </nav>
    )
}
