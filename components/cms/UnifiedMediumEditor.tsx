'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import Youtube from '@tiptap/extension-youtube'

import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Link as LinkIcon,
    Heading1,
    Heading2,
    Heading3,
    Quote,
    ImageIcon,
    Minus,
    List,
    ListOrdered,
    Undo,
    Redo,
    Type,
    Code,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Save,
    Send,
    Loader2,
    Eye,
    EyeOff,
    Clock,
    FileText,
    X,
    Sparkles,
    Wand2,
    Mic,
    Video
} from 'lucide-react'
import { AIBubbleMenu } from './ai/AIBubbleMenu'
import { cn } from '@/lib/utils'
import { uploadMedia } from '@/lib/actions/cms-media'

interface UnifiedMediumEditorProps {
    title: string
    content: string
    excerpt: string
    coverImageUrl: string
    onTitleChange: (title: string) => void
    onContentChange: (content: string) => void
    onExcerptChange: (excerpt: string) => void
    onCoverImageChange: (url: string) => void
    onPublish: () => void
    onSave: () => void
    isPublishing?: boolean
    isSaving?: boolean
    hasUnsavedChanges?: boolean
    status?: string
    wordCount?: number
    readingTime?: number
}

export function UnifiedMediumEditor({
    title,
    content,
    excerpt,
    coverImageUrl,
    onTitleChange,
    onContentChange,
    onExcerptChange,
    onCoverImageChange,
    onPublish,
    onSave,
    isPublishing = false,
    isSaving = false,
    hasUnsavedChanges = false,
    status = 'draft',
    wordCount = 0,
    readingTime = 1
}: UnifiedMediumEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const coverImageInputRef = useRef<HTMLInputElement>(null)
    const excerptTextareaRef = useRef<HTMLTextAreaElement>(null)
    const [showPreview, setShowPreview] = useState(false)

    // Função para ajustar altura do textarea de excerpt
    const adjustExcerptHeight = useCallback(() => {
        const textarea = excerptTextareaRef.current
        if (textarea) {
            // Primeiro, remove qualquer altura fixa para recalcular o scrollHeight
            textarea.style.height = 'auto'
            // Calcula a altura necessária baseada no conteúdo
            const scrollHeight = textarea.scrollHeight
            // Define a nova altura, ajustando dinamicamente ao conteúdo
            textarea.style.height = `${scrollHeight}px`
        }
    }, [])

    // Ajusta altura quando excerpt muda ou componente monta
    useEffect(() => {
        // Usa requestAnimationFrame para garantir que o DOM foi atualizado
        requestAnimationFrame(() => {
            adjustExcerptHeight()
        })
    }, [excerpt, adjustExcerptHeight])

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3]
                }
            }),
            Underline,
            Image.configure({
                HTMLAttributes: {
                    class: 'rounded-lg max-w-full mx-auto my-6 shadow-sm'
                }
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-orange-600 underline hover:text-orange-500 transition-colors cursor-pointer'
                }
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
                alignments: ['left', 'center', 'right', 'justify'],
                defaultAlignment: 'justify',
            }),
            Placeholder.configure({
                placeholder: 'Comece a escrever sua história...',
            }),
            CharacterCount,
            Youtube.configure({
                HTMLAttributes: {
                    class: 'youtube-embed-wrapper',
                },
                width: 0,
                height: 0,
                nocookie: true,
                modestBranding: true,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onContentChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'prose prose-lg max-w-none outline-none py-6 text-gray-800 prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:text-justify prose-headings:text-justify prose-a:text-orange-600 prose-img:rounded-xl prose-strong:text-gray-900 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:my-6 prose-blockquote:italic prose-blockquote:text-gray-700 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-code:text-orange-600 prose-code:bg-orange-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100',
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer?.files.length) {
                    const files = Array.from(event.dataTransfer.files)
                    const images = files.filter(file => file.type.startsWith('image/'))

                    if (images.length > 0) {
                        event.preventDefault()
                        images.forEach(image => handleImageUpload(image))
                        return true
                    }
                }
                return false
            },
            handlePaste: (view, event, slice) => {
                const items = event.clipboardData?.items
                if (items) {
                    for (const item of Array.from(items)) {
                        if (item.type.startsWith('image/')) {
                            event.preventDefault()
                            const file = item.getAsFile()
                            if (file) handleImageUpload(file)
                            return true
                        }
                    }
                }
                return false
            }
        },
    })

    const handleImageUpload = useCallback(async (file: File) => {
        if (!editor) return

        const placeholderId = `uploading-${Date.now()}`
        editor.chain().focus().setImage({
            src: '/placeholder.jpg',
            alt: 'Carregando...',
        }).run()

        try {
            const formData = new FormData()
            formData.append('file', file)
            const result = await uploadMedia(formData)

            editor.chain().focus().setImage({
                src: result.url,
                alt: file.name
            }).run()
        } catch (error) {
            console.error('Erro ao fazer upload da imagem:', error)
            alert('Erro ao fazer upload da imagem. Tente novamente.')
        }
    }, [editor])

    const triggerImageUpload = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    const triggerCoverImageUpload = useCallback(() => {
        coverImageInputRef.current?.click()
    }, [])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleImageUpload(file)
            e.target.value = ''
        }
    }, [handleImageUpload])

    const handleCoverFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            try {
                const formData = new FormData()
                formData.append('file', file)
                const result = await uploadMedia(formData)
                onCoverImageChange(result.url)
            } catch (error) {
                console.error('Erro ao fazer upload da capa:', error)
                alert('Erro ao fazer upload da imagem de capa. Tente novamente.')
            }
            e.target.value = ''
        }
    }, [onCoverImageChange])

    const addYouTubeVideo = useCallback(() => {
        if (!editor) return
        const url = window.prompt('URL do vídeo do YouTube:')
        if (url) {
            editor.commands.setYoutubeVideo({ src: url })
        }
    }, [editor])

    const setLink = useCallback(() => {
        if (!editor) return

        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('URL do link:', previousUrl)

        if (url === null) return

        if (url === '') {
            editor.chain().focus().unsetLink().run()
            return
        }

        editor.chain().focus().setLink({ href: url }).run()
    }, [editor])

    if (!editor) return null

    const characterCount = editor.storage.characterCount.characters()
    const words = editor.storage.characterCount.words()

    return (
        <div className="min-h-screen bg-white">
            {/* Hidden file inputs */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />
            <input
                ref={coverImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverFileSelect}
                className="hidden"
            />

            {/* Top Action Bar */}
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
                    {/* Left: Status */}
                    <div className="flex items-center gap-3">
                        {isSaving ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                <span>Salvando...</span>
                            </div>
                        ) : hasUnsavedChanges ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                <span>Alterações não salvas</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>{status === 'published' ? 'Publicado' : 'Rascunho'}</span>
                            </div>
                        )}

                        {/* Metrics */}
                        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{readingTime} min</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" />
                                <span>{words} palavras</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Preview Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className={cn(
                                "p-2 rounded-lg transition-colors",
                                showPreview
                                    ? "bg-orange-100 text-orange-600"
                                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            )}
                            title={showPreview ? "Esconder prévia" : "Ver prévia"}
                        >
                            {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>

                        <div className="w-px h-6 bg-gray-200 mx-1" />

                        {/* Save Button */}
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
                                bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Salvando</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span className="hidden sm:inline">Salvar</span>
                                </>
                            )}
                        </button>

                        {/* Publish Button */}
                        <button
                            type="button"
                            onClick={onPublish}
                            disabled={isPublishing || isSaving}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
                                bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {isPublishing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Publicando</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span className="hidden sm:inline">
                                        {status === 'published' ? 'Atualizar' : 'Publicar'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="max-w-4xl mx-auto">
                {!showPreview ? (
                    // Editor Mode
                    <div className="px-6 py-8 space-y-6">
                        {/* Cover Image */}
                        <div className="relative group">
                            {coverImageUrl ? (
                                <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                                    <img
                                        src={coverImageUrl}
                                        alt="Capa do post"
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={triggerCoverImageUpload}
                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                    >
                                        <div className="text-white font-medium flex items-center gap-2">
                                            <ImageIcon className="w-5 h-5" />
                                            <span>Alterar imagem de capa</span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onCoverImageChange('')}
                                        className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={triggerCoverImageUpload}
                                    className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50/50 transition-all flex flex-col items-center justify-center gap-3 text-gray-400 hover:text-orange-500"
                                >
                                    <ImageIcon className="w-12 h-12" />
                                    <div className="text-center">
                                        <p className="font-medium">Adicionar imagem de capa</p>
                                        <p className="text-sm">ou arraste uma imagem aqui</p>
                                    </div>
                                </button>
                            )}
                        </div>

                        {/* Title */}
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => onTitleChange(e.target.value)}
                            placeholder="Título do post"
                            className="w-full bg-transparent text-4xl md:text-5xl font-bold text-gray-900 placeholder:text-gray-300 outline-none border-none"
                        />

                        {/* Excerpt */}
                        <textarea
                            ref={excerptTextareaRef}
                            value={excerpt}
                            onChange={(e) => {
                                onExcerptChange(e.target.value)
                                // Ajusta altura após o estado ser atualizado
                                requestAnimationFrame(() => {
                                    adjustExcerptHeight()
                                })
                            }}
                            placeholder="Escreva um resumo ou subtítulo para o post..."
                            className="w-full bg-transparent text-xl text-gray-600 placeholder:text-gray-400 outline-none border-none resize-none overflow-hidden"
                            style={{ minHeight: '60px' }}
                        />

                        {/* Divider */}
                        <div className="border-b border-gray-100" />

                        {/* Format Selector & Current Format Indicator */}
                        <div className="flex flex-col gap-2 py-3 px-1 border-b border-gray-100 bg-gray-50/50 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        Formato atual:
                                    </span>
                                    <FormatIndicator editor={editor} />
                                </div>
                                <FormatSelector editor={editor} />
                            </div>
                            <div className="text-xs text-gray-400 px-1">
                                💡 <strong>Dica:</strong> O formato padrão é "Parágrafo normal". Use o menu acima para alterar para citação, títulos, listas, etc.
                            </div>
                        </div>

                        {/* Content Editor */}
                        <div className="min-h-[600px] relative">
                            <EditorContent editor={editor} />
                        </div>
                    </div>
                ) : (
                    // Preview Mode
                    <div className="px-6 py-8">
                        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 space-y-6">
                            {/* Cover Image */}
                            {coverImageUrl && (
                                <div className="aspect-video rounded-xl overflow-hidden bg-gray-100">
                                    <img
                                        src={coverImageUrl}
                                        alt={title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            {/* Title */}
                            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                                {title || 'Título do Post'}
                            </h1>

                            {/* Excerpt */}
                            {excerpt && (
                                <p className="text-xl text-gray-600">
                                    {excerpt}
                                </p>
                            )}

                            {/* Divider */}
                            <div className="border-b border-gray-100" />

                            {/* Content */}
                            <div
                                className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-orange-600 prose-strong:text-gray-900"
                                dangerouslySetInnerHTML={{
                                    __html: content || '<p class="text-gray-400 italic">Comece a escrever para ver o conteúdo...</p>'
                                }}
                            />

                            {/* Footer Metrics */}
                            <div className="pt-6 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    <span>{readingTime} min de leitura</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <FileText className="w-4 h-4" />
                                    <span>{words} palavras</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bubble Menu - appears on text selection */}
            <BubbleMenu
                editor={editor}
                className="bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col overflow-hidden"
            >
                {/* Formatting Row */}
                <div className="flex items-center gap-0.5 p-1">
                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        title="Negrito (Cmd+B)"
                    >
                        <Bold className="w-4 h-4" />
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        title="Itálico (Cmd+I)"
                    >
                        <Italic className="w-4 h-4" />
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        isActive={editor.isActive('underline')}
                        title="Sublinhado (Cmd+U)"
                    >
                        <UnderlineIcon className="w-4 h-4" />
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        isActive={editor.isActive('strike')}
                        title="Tachado"
                    >
                        <Strikethrough className="w-4 h-4" />
                    </BubbleButton>

                    <div className="w-px h-5 bg-gray-200 mx-1" />

                    <BubbleButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        title="Título 2"
                    >
                        <Heading2 className="w-4 h-4" />
                    </BubbleButton>

                    <div className="w-px h-5 bg-gray-200 mx-1" />

                    <BubbleButton
                        onClick={setLink}
                        isActive={editor.isActive('link')}
                        title="Link"
                    >
                        <LinkIcon className="w-4 h-4" />
                    </BubbleButton>

                    <div className="w-px h-5 bg-gray-200 mx-1" />

                    <BubbleButton
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        isActive={editor.isActive({ textAlign: 'left' })}
                        title="Alinhar à esquerda"
                    >
                        <AlignLeft className="w-4 h-4" />
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        isActive={editor.isActive({ textAlign: 'center' })}
                        title="Centralizar"
                    >
                        <AlignCenter className="w-4 h-4" />
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        isActive={editor.isActive({ textAlign: 'right' })}
                        title="Alinhar à direita"
                    >
                        <AlignRight className="w-4 h-4" />
                    </BubbleButton>
                    <BubbleButton
                        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                        isActive={editor.isActive({ textAlign: 'justify' })}
                        title="Justificar"
                    >
                        <AlignJustify className="w-4 h-4" />
                    </BubbleButton>
                </div>

                {/* AI Row */}
                <AIBubbleMenu editor={editor} />
            </BubbleMenu>

            {/* Floating Menu - appears on empty lines */}
            <FloatingMenu
                editor={editor}
                className="bg-white border border-gray-200 rounded-lg shadow-xl flex items-center gap-0.5 p-1"
            >
                <FloatingButton
                    onClick={triggerImageUpload}
                    title="Adicionar imagem"
                >
                    <ImageIcon className="w-4 h-4" />
                </FloatingButton>
                <FloatingButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    title="Citação"
                >
                    <Quote className="w-4 h-4" />
                </FloatingButton>
                <FloatingButton
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    title="Separador"
                >
                    <Minus className="w-4 h-4" />
                </FloatingButton>
                <FloatingButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Lista"
                >
                    <List className="w-4 h-4" />
                </FloatingButton>
                <FloatingButton
                    onClick={addYouTubeVideo}
                    title="Vídeo do YouTube"
                >
                    <Video className="w-4 h-4" />
                </FloatingButton>
            </FloatingMenu>
        </div>
    )
}

// Bubble Menu Button Component
function BubbleButton({
    onClick,
    isActive,
    children,
    title
}: {
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={cn(
                "p-2 rounded-md transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center",
                isActive
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
        >
            {children}
        </button>
    )
}

// Floating Menu Button Component
function FloatingButton({
    onClick,
    children,
    title
}: {
    onClick: () => void
    children: React.ReactNode
    title: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="p-2 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
        >
            {children}
        </button>
    )
}

// Format Indicator Component - shows current format
function FormatIndicator({ editor }: { editor: any }) {
    const [currentFormat, setCurrentFormat] = useState('Parágrafo normal')

    useEffect(() => {
        if (!editor) return

        const updateFormat = () => {
            if (editor.isActive('heading', { level: 1 })) {
                setCurrentFormat('Título 1')
            } else if (editor.isActive('heading', { level: 2 })) {
                setCurrentFormat('Título 2')
            } else if (editor.isActive('heading', { level: 3 })) {
                setCurrentFormat('Título 3')
            } else if (editor.isActive('blockquote')) {
                setCurrentFormat('Citação')
            } else if (editor.isActive('bulletList')) {
                setCurrentFormat('Lista com marcadores')
            } else if (editor.isActive('orderedList')) {
                setCurrentFormat('Lista numerada')
            } else if (editor.isActive('codeBlock')) {
                setCurrentFormat('Bloco de código')
            } else {
                setCurrentFormat('Parágrafo normal')
            }
        }

        editor.on('selectionUpdate', updateFormat)
        editor.on('update', updateFormat)
        updateFormat()

        return () => {
            editor.off('selectionUpdate', updateFormat)
            editor.off('update', updateFormat)
        }
    }, [editor])

    const getFormatColor = () => {
        switch (currentFormat) {
            case 'Citação':
                return 'text-orange-600 bg-orange-50'
            case 'Título 1':
            case 'Título 2':
            case 'Título 3':
                return 'text-blue-600 bg-blue-50'
            case 'Lista com marcadores':
            case 'Lista numerada':
                return 'text-purple-600 bg-purple-50'
            case 'Bloco de código':
                return 'text-gray-700 bg-gray-100'
            default:
                return 'text-gray-700 bg-gray-50'
        }
    }

    return (
        <span className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
            getFormatColor()
        )}>
            {currentFormat}
        </span>
    )
}

// Format Selector Component - dropdown to select format
function FormatSelector({ editor }: { editor: any }) {
    const [isOpen, setIsOpen] = useState(false)

    if (!editor) return null

    const formats = [
        { label: 'Parágrafo normal', action: () => editor.chain().focus().setParagraph().run(), icon: Type },
        { label: 'Título 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), icon: Heading1 },
        { label: 'Título 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), icon: Heading2 },
        { label: 'Título 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), icon: Heading3 },
        { label: 'Citação', action: () => editor.chain().focus().toggleBlockquote().run(), icon: Quote },
        { label: 'Lista com marcadores', action: () => editor.chain().focus().toggleBulletList().run(), icon: List },
        { label: 'Lista numerada', action: () => editor.chain().focus().toggleOrderedList().run(), icon: ListOrdered },
        { label: 'Bloco de código', action: () => editor.chain().focus().toggleCodeBlock().run(), icon: Code },
    ]

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
                <Type className="w-4 h-4" />
                <span className="hidden sm:inline">Alterar formato</span>
                <span className="sm:hidden">Formato</span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[200px] py-1">
                        {formats.map((format) => {
                            const Icon = format.icon
                            const isActive =
                                (format.label === 'Parágrafo normal' && editor.isActive('paragraph')) ||
                                (format.label === 'Título 1' && editor.isActive('heading', { level: 1 })) ||
                                (format.label === 'Título 2' && editor.isActive('heading', { level: 2 })) ||
                                (format.label === 'Título 3' && editor.isActive('heading', { level: 3 })) ||
                                (format.label === 'Citação' && editor.isActive('blockquote')) ||
                                (format.label === 'Lista com marcadores' && editor.isActive('bulletList')) ||
                                (format.label === 'Lista numerada' && editor.isActive('orderedList')) ||
                                (format.label === 'Bloco de código' && editor.isActive('codeBlock'))

                            return (
                                <button
                                    key={format.label}
                                    type="button"
                                    onClick={() => {
                                        format.action()
                                        setIsOpen(false)
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                                        isActive
                                            ? "bg-orange-50 text-orange-600 font-medium"
                                            : "text-gray-700 hover:bg-gray-50"
                                    )}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span>{format.label}</span>
                                    {isActive && (
                                        <div className="ml-auto w-2 h-2 rounded-full bg-orange-500" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
