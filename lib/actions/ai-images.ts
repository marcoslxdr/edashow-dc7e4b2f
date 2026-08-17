'use server'

/**
 * AI Image Server Actions
 * Server actions for image search, management and AI cover generation
 */

import { searchImages, downloadAndSaveImage, getCuratedImages, getAvailableProviders, NormalizedImage } from '@/lib/images/image-service'
import {
  getCoverImages,
  extractVisualKeywords,
  getAvailableProviders as getAIImageProviders,
  type ImageGenerationResult
} from '@/lib/ai/image-generator'
import { requireCmsRole } from './cms-authz'

export type { NormalizedImage }

export interface ImageSearchParams {
    query: string
    provider?: 'pexels' | 'unsplash' | 'all'
    orientation?: 'landscape' | 'portrait' | 'square'
    page?: number
    perPage?: number
    color?: string
}

/**
 * Check which image providers are configured
 */
export async function checkImageProviders() {
    await requireCmsRole()
    return getAvailableProviders()
}

/**
 * Search images across providers
 */
export async function searchStockImages(params: ImageSearchParams) {
    await requireCmsRole()
    const providers = getAvailableProviders()

    if (!providers.pexels && !providers.unsplash) {
        return {
            images: [],
            total: 0,
            page: 1,
            hasMore: false,
            providers,
            error: 'Nenhuma API de imagens configurada. Adicione PEXELS_API_KEY ou UNSPLASH_ACCESS_KEY ao .env'
        }
    }

    try {
        const result = await searchImages({
            query: params.query,
            provider: params.provider || 'all',
            orientation: params.orientation,
            page: params.page,
            perPage: params.perPage,
            color: params.color
        })

        return {
            ...result,
            error: null
        }
    } catch (error) {
        console.error('Image search error:', error)
        return {
            images: [],
            total: 0,
            page: params.page || 1,
            hasMore: false,
            providers,
            error: error instanceof Error ? error.message : 'Erro ao buscar imagens'
        }
    }
}

/**
 * Get curated/popular images
 */
export async function getCuratedStockImages(count?: number) {
    await requireCmsRole()
    const providers = getAvailableProviders()

    if (!providers.pexels && !providers.unsplash) {
        return {
            images: [],
            error: 'Nenhuma API de imagens configurada'
        }
    }

    try {
        const images = await getCuratedImages(count)
        return { images, error: null }
    } catch (error) {
        console.error('Curated images error:', error)
        return {
            images: [],
            error: error instanceof Error ? error.message : 'Erro ao buscar imagens'
        }
    }
}

/**
 * Download and save image to storage
 */
export async function saveImageToStorage(image: NormalizedImage, folder?: string) {
    await requireCmsRole()
    try {
        const { publicUrl } = await downloadAndSaveImage(image, folder)
        return { url: publicUrl, error: null }
    } catch (error) {
        console.error('Save image error:', error)
        return {
            url: null,
            error: error instanceof Error ? error.message : 'Erro ao salvar imagem'
        }
    }
}

/**
 * Get image search suggestions based on topic
 */
export async function getImageSearchSuggestions(topic: string): Promise<string[]> {
    await requireCmsRole()
    // Healthcare-related search term enhancements
    const baseTerms = [topic]

    // Add variations
    if (!topic.toLowerCase().includes('saúde') && !topic.toLowerCase().includes('health')) {
        baseTerms.push(`${topic} saúde`)
        baseTerms.push(`${topic} healthcare`)
    }

    if (!topic.toLowerCase().includes('médico') && !topic.toLowerCase().includes('medical')) {
        baseTerms.push(`${topic} medical`)
    }

    // Add professional context
    baseTerms.push(`${topic} professional`)
    baseTerms.push(`${topic} clinic`)

    return baseTerms.slice(0, 6)
}

/**
 * Get trending image searches
 */
export async function getTrendingImageSearches(): Promise<string[]> {
    await requireCmsRole()
    return [
        'healthcare technology',
        'dental clinic',
        'medical team',
        'health wellness',
        'doctor patient',
        'medical equipment',
        'hospital',
        'dental care',
        'health insurance',
        'telemedicine'
    ]
}

/**
 * Upload local image to storage
 */
export async function uploadImageFromUrl(
    imageUrl: string,
    folder: string = 'uploads'
) {
    await requireCmsRole()
    try {
        // Create a mock NormalizedImage for the upload
        const image: NormalizedImage = {
            id: `upload-${Date.now()}`,
            provider: 'pexels', // Using pexels type as it's just for the upload
            url: imageUrl,
            thumbnailUrl: imageUrl,
            width: 0,
            height: 0,
            alt: 'Uploaded image',
            downloadUrl: imageUrl
        }

        const { publicUrl } = await downloadAndSaveImage(image, folder)
        return { url: publicUrl, error: null }
    } catch (error) {
        console.error('Upload error:', error)
        return {
            url: null,
            error: error instanceof Error ? error.message : 'Erro ao fazer upload'
        }
    }
}

// ============================================
// AI-Powered Cover Image (Gemini + Pexels)
// ============================================

export interface CoverImageRequest {
    title: string
    content?: string
    count?: number
}

export interface GenerateImageRequest {
    title: string
    content?: string
    customPrompt?: string
}

/**
 * Check which AI image providers are available
 */
export async function checkAIImageProviders(): Promise<{
    pexels: boolean
    gemini: boolean
}> {
    await requireCmsRole()
    return {
        ...getAIImageProviders(),
        gemini: !!process.env.OPENROUTER_API_KEY
    }
}

/**
 * Generate a cover image using Gemini 2.5 Flash Image (Nano Banana)
 */
export async function generateAICoverImage(
    request: GenerateImageRequest
): Promise<{ url: string; source: 'gemini'; error: string | null }> {
    await requireCmsRole()
    try {
        const { generateAICoverImage: generateImage } = await import('@/lib/ai/gemini-image-generator')
        const result = await generateImage(request.title, request.content, request.customPrompt)
        return { url: result.url, source: 'gemini', error: null }
    } catch (error) {
        console.error('Gemini image generation error:', error)
        return {
            url: '',
            source: 'gemini',
            error: error instanceof Error ? error.message : 'Erro ao gerar imagem com IA'
        }
    }
}

/**
 * Get AI-powered cover image suggestions based on post content
 * Uses Pexels (FREE) with AI-powered keyword extraction
 */
export async function getAICoverSuggestions(
    request: CoverImageRequest
): Promise<ImageGenerationResult> {
    await requireCmsRole()
    const { title, content, count = 8 } = request

    return getCoverImages(title, {
        content,
        count
    })
}

/**
 * Get visual keywords for AI image search
 */
export async function getAIVisualKeywords(
    title: string,
    content?: string
): Promise<string[]> {
    await requireCmsRole()
    return extractVisualKeywords(title, content)
}

/**
 * Select and upload cover image to storage
 */
export async function selectAICoverImage(
    imageUrl: string,
    source: 'pexels' | 'unsplash' | 'gemini'
): Promise<{ url: string | null; error: string | null }> {
    await requireCmsRole()
    // Gemini images are already in storage
    if (source === 'gemini') {
        return { url: imageUrl, error: null }
    }
    try {
        // Fetch the image
        const response = await fetch(imageUrl)
        if (!response.ok) {
            throw new Error('Failed to fetch image')
        }

        // Create NormalizedImage for upload
        const image: NormalizedImage = {
            id: `${source}-${Date.now()}`,
            provider: source,
            url: imageUrl,
            thumbnailUrl: imageUrl,
            width: 1280,
            height: 720,
            alt: `Cover image from ${source}`,
            downloadUrl: imageUrl
        }

        const { publicUrl } = await downloadAndSaveImage(image, 'covers')
        return { url: publicUrl, error: null }
    } catch (error) {
        console.error('Error selecting cover image:', error)
        return {
            url: null,
            error: error instanceof Error ? error.message : 'Failed to upload cover image'
        }
    }
}
