import { NextResponse } from 'next/server'

/**
 * Validates the API key from the Authorization header.
 * Expects: Authorization: Bearer <POSTS_API_KEY>
 *
 * The key is configured via the POSTS_API_KEY environment variable.
 */
export function validateApiKey(request: Request): { valid: true } | { valid: false; error: NextResponse } {
    const apiKey = process.env.POSTS_API_KEY

    if (!apiKey) {
        return {
            valid: false,
            error: NextResponse.json(
                { error: 'POSTS_API_KEY não está configurado no servidor.' },
                { status: 500 }
            )
        }
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            valid: false,
            error: NextResponse.json(
                {
                    error: 'Header de autorização ausente ou inválido.',
                    hint: 'Use: Authorization: Bearer <SUA_API_KEY>'
                },
                { status: 401 }
            )
        }
    }

    const token = authHeader.slice(7).trim()
    if (token !== apiKey) {
        return {
            valid: false,
            error: NextResponse.json(
                { error: 'API key inválida.' },
                { status: 403 }
            )
        }
    }

    return { valid: true }
}

/**
 * Generates a URL-friendly slug from a title string.
 */
export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
