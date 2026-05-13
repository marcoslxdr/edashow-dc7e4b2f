/**
 * Gemini Image Generator
 * Uses Gemini 2.5 Flash Image (Nano Banana) via OpenRouter for AI image generation
 * Falls back to Pexels stock images if generation fails
 */

import { createClient } from '@supabase/supabase-js'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'
const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image'

interface GeminiImageResult {
    url: string
    source: 'gemini'
}

/**
 * Generate a cover image using Gemini 2.5 Flash Image via OpenRouter
 * Returns the public URL of the image stored in Supabase Storage
 */
export async function generateCoverImage(prompt: string): Promise<GeminiImageResult> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY não configurada')
    }

    // Call OpenRouter with Gemini Image model
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'EDA Show CMS'
        },
        body: JSON.stringify({
            model: IMAGE_MODEL,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            // Enable image output modality
            modalities: ['text', 'image'],
            max_tokens: 4096,
            temperature: 0.8
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`[ImageGen] API error:`, errorData)
        throw new Error(`Gemini Image API error: ${errorData?.error?.message || response.statusText}`)
    }

    const data = await response.json()
    console.log(`[ImageGen] Response received, model: ${data.model || IMAGE_MODEL}`)

    // Extract image from response
    const message = data.choices?.[0]?.message
    if (!message) {
        console.error(`[ImageGen] No message in response:`, JSON.stringify(data).substring(0, 500))
        throw new Error('Nenhuma resposta do modelo de imagem')
    }

    // Debug: log message structure
    console.log(`[ImageGen] Message keys:`, Object.keys(message))
    if (Array.isArray(message.images)) {
        console.log(`[ImageGen] Found ${message.images.length} images in message.images`)
    }

    // The response may have content as array of parts (multimodal)
    // or as a single string with base64 inline data
    let base64Image: string | null = null
    let mimeType = 'image/png'

    if (Array.isArray(message.content)) {
        // Multimodal response: array of parts
        for (const part of message.content) {
            if (part.type === 'image_url' && part.image_url?.url) {
                // Data URL format: data:image/png;base64,xxxxx
                const dataUrl = part.image_url.url
                const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
                if (match) {
                    mimeType = match[1]
                    base64Image = match[2]
                    console.log(`[ImageGen] Found image in content array, mime: ${mimeType}`)
                    break
                }
            }
            if (part.type === 'image' && part.data) {
                base64Image = part.data
                if (part.mime_type) mimeType = part.mime_type
                console.log(`[ImageGen] Found image data in content array`)
                break
            }
        }
    }

    // OpenRouter Gemini image model returns images in message.images array
    if (!base64Image && Array.isArray(message.images)) {
        for (const img of message.images) {
            if (img.type === 'image_url' && img.image_url?.url) {
                const dataUrl = img.image_url.url
                const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
                if (match) {
                    mimeType = match[1]
                    base64Image = match[2]
                    console.log(`[ImageGen] Found image in message.images, mime: ${mimeType}`)
                    break
                }
            }
        }
    }

    if (!base64Image) {
        console.error(`[ImageGen] No image found in response. Message:`, JSON.stringify(message).substring(0, 1000))
        throw new Error('O modelo não gerou uma imagem. Tente um prompt diferente.')
    }

    // Convert base64 to buffer and upload to Supabase Storage
    const buffer = Buffer.from(base64Image, 'base64')
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png'
    const filename = `covers/gemini-${Date.now()}.${ext}`

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const bucket = process.env.SUPABASE_BUCKET || 'media'

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filename, buffer, {
            contentType: mimeType,
            upsert: true
        })

    if (uploadError) {
        throw new Error(`Erro ao salvar imagem: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filename)

    return {
        url: urlData.publicUrl,
        source: 'gemini'
    }
}

/**
 * Generate a visual prompt for image generation based on post content
 */
export async function generateImagePrompt(
    title: string,
    content?: string
): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
        return `Professional blog cover image for: ${title}`
    }

    // Use text model to generate a good image prompt
    const textModel = process.env.OPENROUTER_POST_MODEL || process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash'
    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'EDA Show CMS'
        },
        body: JSON.stringify({
            model: textModel,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at creating image generation prompts. Generate a single, detailed prompt in English for creating a professional blog cover image. The image should be clean, modern, and suitable for a healthcare/wellness blog. Return ONLY the prompt text, nothing else.'
                },
                {
                    role: 'user',
                    content: `Create an image generation prompt for a blog post titled: "${title}"${content ? `\n\nContent excerpt: ${content.slice(0, 300)}` : ''}`
                }
            ],
            max_tokens: 200,
            temperature: 0.7
        })
    })

    if (!response.ok) {
        return `Professional, modern blog cover image about ${title}, clean design, healthcare theme, high quality`
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() ||
        `Professional blog cover image for: ${title}`
}

/**
 * Full pipeline: generate prompt + generate image
 */
export async function generateAICoverImage(
    title: string,
    content?: string,
    customPrompt?: string
): Promise<GeminiImageResult> {
    const prompt = customPrompt || await generateImagePrompt(title, content)

    const imagePrompt = `Generate a professional, high-quality blog cover image. ${prompt}. The image should be photorealistic, well-lit, with a clean modern aesthetic suitable for a professional blog.`

    return generateCoverImage(imagePrompt)
}
