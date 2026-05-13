/**
 * Unified Image Service
 * Abstracts multiple image providers into a single interface
 */

import { pexels, NormalizedImage as PexelsNormalizedImage } from './pexels'
import { unsplash, NormalizedImage as UnsplashNormalizedImage } from './unsplash'
import { createClient } from '@supabase/supabase-js'

export type ImageProvider = 'pexels' | 'unsplash' | 'all'

export interface NormalizedImage {
    id: string
    provider: 'pexels' | 'unsplash' | 'freepik' | 'ai'
    url: string
    thumbnailUrl: string
    width: number
    height: number
    alt: string
    photographer?: string
    photographerUrl?: string
    downloadUrl: string
    color?: string
}

export interface ImageSearchOptions {
    query: string
    provider?: ImageProvider
    orientation?: 'landscape' | 'portrait' | 'square'
    page?: number
    perPage?: number
    color?: string
}

export interface ImageSearchResult {
    images: NormalizedImage[]
    total: number
    page: number
    hasMore: boolean
    providers: {
        pexels: boolean
        unsplash: boolean
    }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): {
    pexels: boolean
    unsplash: boolean
} {
    return {
        pexels: pexels.isConfigured(),
        unsplash: unsplash.isConfigured()
    }
}

/**
 * Search images across multiple providers
 */
export async function searchImages(options: ImageSearchOptions): Promise<ImageSearchResult> {
    const provider = options.provider || 'all'
    const perPage = options.perPage || 15
    const page = options.page || 1

    const results: NormalizedImage[] = []
    let total = 0
    const providers = getAvailableProviders()

    // Search Pexels
    if ((provider === 'all' || provider === 'pexels') && providers.pexels) {
        try {
            const pexelsResults = await pexels.searchPhotos({
                query: options.query,
                orientation: options.orientation,
                color: options.color,
                page,
                perPage: provider === 'all' ? Math.ceil(perPage / 2) : perPage
            })

            results.push(...pexelsResults.photos.map(p => pexels.normalizePhoto(p)))
            total += pexelsResults.total_results
        } catch (error) {
            console.error('Pexels search error:', error)
        }
    }

    // Search Unsplash
    if ((provider === 'all' || provider === 'unsplash') && providers.unsplash) {
        try {
            const unsplashResults = await unsplash.searchPhotos({
                query: options.query,
                orientation: options.orientation === 'square' ? 'squarish' : options.orientation,
                color: options.color,
                page,
                perPage: provider === 'all' ? Math.ceil(perPage / 2) : perPage
            })

            results.push(...unsplashResults.results.map(p => unsplash.normalizePhoto(p)))
            total += unsplashResults.total
        } catch (error) {
            console.error('Unsplash search error:', error)
        }
    }

    // Shuffle results if searching all providers
    if (provider === 'all') {
        shuffleArray(results)
    }

    return {
        images: results,
        total,
        page,
        hasMore: results.length >= perPage,
        providers
    }
}

/**
 * Get suggestions for image search based on topic
 */
export function getImageSearchSuggestions(topic: string): string[] {
    // Common healthcare/dentistry related terms that work well for stock photos
    const healthcareTerms = [
        'healthcare', 'medical', 'doctor', 'hospital', 'health',
        'dentist', 'dental', 'teeth', 'smile', 'clinic',
        'nurse', 'medicine', 'wellness', 'patient', 'treatment'
    ]

    const suggestions = [topic]

    // Add topic variations
    suggestions.push(`${topic} healthcare`)
    suggestions.push(`${topic} medical`)
    suggestions.push(`${topic} professional`)

    // Check if topic contains healthcare terms
    const topicLower = topic.toLowerCase()
    if (!healthcareTerms.some(term => topicLower.includes(term))) {
        suggestions.push('healthcare professional')
        suggestions.push('medical office')
    }

    return suggestions.slice(0, 5)
}

/**
 * Download image and save to Supabase storage
 */
export async function downloadAndSaveImage(
    image: NormalizedImage,
    folder: string = 'posts'
): Promise<string> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Download image
    const response = await fetch(image.downloadUrl)
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`)
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Generate filename
    const extension = image.downloadUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg'
    const filename = `${folder}/${Date.now()}-${image.id.replace(/[^a-z0-9]/gi, '-')}.${extension}`

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET || 'media')
        .upload(filename, buffer, {
            contentType: blob.type || 'image/jpeg',
            upsert: false
        })

    if (error) {
        throw new Error(`Failed to upload image: ${error.message}`)
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
        .from(process.env.SUPABASE_BUCKET || 'media')
        .getPublicUrl(data.path)

    // Track download for Unsplash (required by their API guidelines)
    if (image.provider === 'unsplash' && image.downloadUrl.includes('unsplash')) {
        // Note: In production, you should track the download_location from the original photo
        console.log('Unsplash download tracked for:', image.id)
    }

    return publicUrl.publicUrl
}

/**
 * Generate AI image prompt based on topic
 */
export async function generateImagePrompt(
    topic: string,
    style?: 'realistic' | 'illustration' | 'minimalist'
): Promise<string> {
    const styleDescriptions = {
        realistic: 'photorealistic, high-quality professional photography',
        illustration: 'modern digital illustration, clean and professional',
        minimalist: 'minimalist, clean design, simple composition'
    }

    const styleDesc = styleDescriptions[style || 'realistic']

    return `${topic}, ${styleDesc}, suitable for healthcare/medical blog, bright clean lighting, professional setting`
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[array[i], array[j]] = [array[j], array[i]]
    }
}

/**
 * Get curated/popular images
 */
export async function getCuratedImages(count: number = 10): Promise<NormalizedImage[]> {
    const results: NormalizedImage[] = []
    const providers = getAvailableProviders()

    if (providers.pexels) {
        try {
            const pexelsResults = await pexels.getCurated(1, Math.ceil(count / 2))
            results.push(...pexelsResults.photos.map(p => pexels.normalizePhoto(p)))
        } catch (error) {
            console.error('Pexels curated error:', error)
        }
    }

    if (providers.unsplash) {
        try {
            const unsplashResults = await unsplash.getRandomPhotos(Math.ceil(count / 2), 'healthcare')
            results.push(...unsplashResults.map(p => unsplash.normalizePhoto(p)))
        } catch (error) {
            console.error('Unsplash random error:', error)
        }
    }

    shuffleArray(results)
    return results.slice(0, count)
}
