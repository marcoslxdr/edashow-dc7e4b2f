import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { validateApiKey } from '@/lib/api-auth'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

/**
 * POST /api/posts/upload
 * Faz o upload de uma imagem para o Vercel Blob e retorna a URL pública.
 *
 * Use a URL retornada como valor de "cover_image_url" ao criar ou atualizar posts.
 *
 * Headers:
 *   Authorization: Bearer <POSTS_API_KEY>
 *   Content-Type: multipart/form-data
 *
 * Body (form-data):
 *   file    File     OBRIGATÓRIO  (JPEG, PNG, WebP, GIF, AVIF – máx. 10 MB)
 *   folder  string   opcional     subpasta no storage (padrão: "api-posts")
 *
 * Resposta (200):
 *   {
 *     "url": "https://xxxx.public.blob.vercel-storage.com/...",
 *     "filename": "api-posts/1234567890-minha-imagem.jpg",
 *     "size": 204800,
 *     "mime_type": "image/jpeg"
 *   }
 */
export async function POST(request: Request) {
    const auth = validateApiKey(request)
    if (!auth.valid) return auth.error

    let formData: FormData
    try {
        formData = await request.formData()
    } catch {
        return NextResponse.json(
            { error: 'Falha ao ler o corpo multipart/form-data.' },
            { status: 400 }
        )
    }

    const file = formData.get('file') as File | null
    if (!file) {
        return NextResponse.json(
            { error: 'Campo "file" obrigatório não foi enviado.' },
            { status: 400 }
        )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
            {
                error: `Tipo de arquivo não suportado: "${file.type}".`,
                allowed: ALLOWED_MIME_TYPES
            },
            { status: 415 }
        )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
            { error: `O arquivo excede o limite de ${MAX_FILE_SIZE_MB} MB. Tamanho recebido: ${(file.size / 1024 / 1024).toFixed(2)} MB.` },
            { status: 413 }
        )
    }

    const folder = (formData.get('folder') as string | null)?.trim() || 'api-posts'
    const extension = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || `.${file.type.split('/')[1]}`
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const filename = `${folder}/${Date.now()}-${baseName}${extension}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const blob = await put(filename, buffer, {
        access: 'public',
        contentType: file.type,
    })

    return NextResponse.json({
        url: blob.url,
        filename,
        size: file.size,
        mime_type: file.type
    })
}
