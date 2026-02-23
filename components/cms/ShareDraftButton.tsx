'use client'

import { useState, useEffect } from 'react'
import { Share2, Copy, ExternalLink, RefreshCw, Trash2, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    generatePreviewToken,
    getActivePreviewToken,
    revokePreviewToken,
} from '@/lib/actions/cms-preview'

interface ShareDraftButtonProps {
    postId: string
}

export function ShareDraftButton({ postId }: ShareDraftButtonProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [token, setToken] = useState<any>(null)
    const [copied, setCopied] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)

    // Load existing active token when dialog opens
    useEffect(() => {
        if (open) {
            setInitialLoading(true)
            getActivePreviewToken(postId)
                .then(setToken)
                .finally(() => setInitialLoading(false))
        }
    }, [open, postId])

    const previewUrl = token
        ? `${window.location.origin}/preview/${token.token}`
        : ''

    const handleGenerate = async () => {
        setLoading(true)
        try {
            const newToken = await generatePreviewToken(postId)
            setToken(newToken)
        } catch (err) {
            console.error('Error generating token:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleRevoke = async () => {
        setLoading(true)
        try {
            await revokePreviewToken(postId)
            setToken(null)
        } catch (err) {
            console.error('Error revoking token:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(previewUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const expiresAt = token ? new Date(token.expires_at) : null
    const daysLeft = expiresAt
        ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-gray-900"
                    title="Compartilhar rascunho para revisão"
                >
                    <Share2 className="w-5 h-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Compartilhar rascunho</DialogTitle>
                </DialogHeader>

                {initialLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : !token ? (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Gere um link temporário para que um revisor logado possa visualizar e aprovar este rascunho.
                        </p>
                        <Button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="w-full"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Share2 className="w-4 h-4 mr-2" />
                            )}
                            Gerar link de preview
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* URL Display */}
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value={previewUrl}
                                className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 truncate"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleCopy}
                                title="Copiar link"
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => window.open(previewUrl, '_blank')}
                                title="Abrir preview"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Status info */}
                        <p className="text-xs text-gray-500">
                            Expira em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} &middot; O revisor precisa estar logado
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGenerate}
                                disabled={loading}
                                className="flex-1"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                )}
                                Regenerar
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRevoke}
                                disabled={loading}
                                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Revogar
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
