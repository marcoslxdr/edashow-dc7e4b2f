'use client'

import { useState, useTransition } from 'react'
import { publishPostFromPreview } from './actions'
import { useRouter } from 'next/navigation'

interface PublishButtonProps {
    postId: string
}

export function PublishButton({ postId }: PublishButtonProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    function handlePublish() {
        setError(null)
        startTransition(async () => {
            const result = await publishPostFromPreview(postId)
            if (result.success) {
                setSuccess(true)
                if (result.slug) {
                    setTimeout(() => {
                        router.push(`/posts/${result.slug}`)
                    }, 1500)
                }
            } else {
                setError(result.error || 'Erro ao publicar')
            }
        })
    }

    if (success) {
        return (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-sm font-medium text-green-800">
                    Post publicado com sucesso! Redirecionando...
                </p>
            </div>
        )
    }

    return (
        <div>
            <button
                type="button"
                onClick={handlePublish}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isPending ? (
                    <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Publicando...
                    </>
                ) : (
                    <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Publicar Post
                    </>
                )}
            </button>
            {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
        </div>
    )
}
