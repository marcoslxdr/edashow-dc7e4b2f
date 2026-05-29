'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Wand2, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Switch } from '@/components/ui/switch'
import { PostGenerationDisabled } from '@/components/cms/ia/PostGenerationDisabled'
import { isPostGenerationEnabled } from '@/lib/feature-flags'

const postGenerationEnabled = isPostGenerationEnabled()

export default function PostGeneratorPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [suggesting, setSuggesting] = useState(false)
    const [result, setResult] = useState<any>(null)

    // Form states
    const [topic, setTopic] = useState('')
    const [keywords, setKeywords] = useState('')
    const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
    const [personaId, setPersonaId] = useState('eda-pro')
    const [instructions, setInstructions] = useState('')
    const [autoCategorize, setAutoCategorize] = useState(true)

    async function handleSuggestKeywords() {
        if (!topic) {
            toast({ title: "Digite um tópico primeiro", variant: "destructive" })
            return
        }

        setSuggesting(true)
        try {
            const response = await fetch('/api/ai/suggest-keywords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            })

            if (!response.ok) throw new Error('Falha ao sugerir keywords')

            const data = await response.json()
            const allSuggestions = [...(data.primary || []), ...(data.secondary || [])]
            setSuggestedKeywords(allSuggestions)
            
            toast({ title: "Sugestões geradas!", description: "Clique nas tags para adicionar." })
        } catch (error) {
            toast({ title: "Erro ao sugerir", variant: "destructive" })
        } finally {
            setSuggesting(false)
        }
    }

    function addKeyword(kw: string) {
        const current = keywords.split(',').map(k => k.trim()).filter(k => k)
        if (!current.includes(kw)) {
            setKeywords([...current, kw].join(', '))
        }
    }

    async function handleGenerate(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setResult(null)

        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
                    personaId,
                    instructions,
                    autoCategorize
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Falha na geração')
            }

            const data = await response.json()
            setResult(data)
            toast({
                title: "Conteúdo gerado com sucesso!",
                description: "Revise e edite antes de salvar.",
            })

        } catch (error: any) {
            console.error(error)
            toast({
                title: "Erro na geração",
                description: error.message,
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    async function handleSaveDraft() {
        if (!result) return
        
        try {
            // We'll implement the save action in the next phase
            const response = await fetch('/api/cms/posts/create-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result)
            })

            if (!response.ok) throw new Error('Falha ao salvar rascunho')
            
            const { id } = await response.json()
            
            toast({
                title: "Rascunho salvo!",
                description: "Redirecionando para o editor...",
            })
            
            router.push(`/cms/posts/${id}`)
        } catch (error) {
            toast({
                title: "Erro ao salvar",
                variant: "destructive"
            })
        }
    }

    if (!postGenerationEnabled) {
        return (
            <div className="p-8 max-w-5xl mx-auto">
                <PostGenerationDisabled />
            </div>
        )
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/cms/ai">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Wand2 className="w-6 h-6 text-orange-500" />
                        Gerador de Posts
                    </h1>
                    <p className="text-gray-500">Crie conteúdo original otimizado para o EDA Show</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Form */}
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Configuração</CardTitle>
                        <CardDescription>Defina os parâmetros do post</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleGenerate} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="topic">Tópico Principal</Label>
                                <Input 
                                    id="topic" 
                                    placeholder="Ex: Lançamento do novo iPhone" 
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="keywords">Palavras-chave</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        id="keywords" 
                                        placeholder="tecnologia, apple, smartphone" 
                                        value={keywords}
                                        onChange={e => setKeywords(e.target.value)}
                                        className="flex-1"
                                    />
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={handleSuggestKeywords}
                                        disabled={suggesting || !topic}
                                        title="Sugerir Palavras-chave com IA"
                                    >
                                        {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    </Button>
                                </div>
                                {suggestedKeywords.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2 p-2 bg-slate-50 rounded-md border border-slate-100">
                                        <span className="text-xs text-muted-foreground w-full">Sugestões (clique para adicionar):</span>
                                        {suggestedKeywords.map((kw, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => addKeyword(kw)}
                                                className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-full hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors"
                                            >
                                                + {kw}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Persona (Estilo de Escrita)</Label>
                                <Select value={personaId} onValueChange={setPersonaId}>
                                    <SelectTrigger className="h-auto py-2">
                                        <div className="flex flex-col items-start gap-1 text-left">
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="eda-pro" className="py-2">
                                            <span className="font-semibold block">Eda Pro (SEO & Autoridade)</span>
                                            <span className="text-xs text-muted-foreground block">Conteúdo educativo, estruturado e otimizado para Google.</span>
                                        </SelectItem>
                                        <SelectItem value="eda-raiz" className="py-2">
                                            <span className="font-semibold block">Eda Raiz (Dia a dia)</span>
                                            <span className="text-xs text-muted-foreground block">Notícias rápidas, opinião, motivação e conexão emocional.</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="instructions">Instruções Adicionais</Label>
                                <Textarea 
                                    id="instructions" 
                                    placeholder="Ex: Focar na qualidade da câmera..."
                                    value={instructions}
                                    onChange={e => setInstructions(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            <div className="flex items-center justify-between space-x-2 pt-2">
                                <Label htmlFor="auto-cat" className="flex flex-col space-y-1 cursor-pointer">
                                    <span>Auto-categorizar</span>
                                    <span className="font-normal text-xs text-muted-foreground">Sugerir categoria e tags</span>
                                </Label>
                                <Switch 
                                    id="auto-cat" 
                                    checked={autoCategorize}
                                    onCheckedChange={setAutoCategorize}
                                />
                            </div>

                            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Gerando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Gerar Conteúdo
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Results View */}
                <div className="lg:col-span-2 space-y-6">
                    {result ? (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div>
                                    <CardTitle>Resultado</CardTitle>
                                    <CardDescription>Revise o conteúdo gerado pela IA</CardDescription>
                                </div>
                                <Button onClick={handleSaveDraft} variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                                    <Save className="mr-2 h-4 w-4" />
                                    Salvar Rascunho
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                                <div className="space-y-1">
                                    <Label className="text-xs uppercase text-gray-500">Título Sugerido</Label>
                                    <div className="p-3 bg-gray-50 rounded-md font-medium text-lg">
                                        {result.title}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs uppercase text-gray-500">Resumo (Excerpt)</Label>
                                    <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-600">
                                        {result.excerpt}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs uppercase text-gray-500">Conteúdo</Label>
                                    <div className="p-4 bg-gray-50 rounded-md min-h-[400px] whitespace-pre-wrap font-mono text-sm">
                                        {result.content}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs uppercase text-gray-500">Meta Description</Label>
                                        <div className="p-2 bg-gray-50 rounded-md text-xs text-gray-600">
                                            {result.metaDescription}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs uppercase text-gray-500">Tags Sugeridas</Label>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {(result.suggestedTags || result.tags || []).map((tag: string) => (
                                                <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-gray-400">
                            <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                            <p>Preencha o formulário para gerar um novo post.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
