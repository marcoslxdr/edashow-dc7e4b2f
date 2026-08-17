import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { requireCmsRole } from '@/lib/actions/cms-authz'

function isBlockedHost(hostname: string) {
    const host = hostname.toLowerCase().replace(/\.$/, '')
    if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') return true
    if (host === '::1' || host === '0.0.0.0' || host === '169.254.169.254') return true

    const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (!ipv4) return false
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 ||
        a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168
}

export async function POST(req: Request) {
    try {
        await requireCmsRole()
    } catch {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    try {
        const { url } = await req.json()

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        let target: URL
        try {
            target = new URL(url)
        } catch {
            return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
        }
        if (!['http:', 'https:'].includes(target.protocol) || isBlockedHost(target.hostname)) {
            return NextResponse.json({ error: 'URL não permitida' }, { status: 400 })
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10_000)
        const response = await fetch(target, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
                { status: response.status }
            )
        }

        const html = await response.text()
        if (html.length > 2_000_000) {
            return NextResponse.json({ error: 'Conteúdo muito grande' }, { status: 413 })
        }
        const $ = cheerio.load(html)

        // Remove scripts, styles, and unwanted elements
        $('script').remove()
        $('style').remove()
        $('nav').remove()
        $('footer').remove()
        $('iframe').remove()
        $('.ad').remove()
        $('[class*="menu"]').remove()
        $('[class*="sidebar"]').remove()
        $('[class*="comment"]').remove()

        // Extract title
        const title = $('h1').first().text().trim() || $('title').text().trim()

        // Extract content - heuristic: find the element with the most text
        let content = ''
        const potentialContentSelectors = ['article', 'main', '.post-content', '.entry-content', '#content', '.content']
        
        for (const selector of potentialContentSelectors) {
            const el = $(selector)
            if (el.length > 0) {
                content = el.text().trim().replace(/\s+/g, ' ')
                break
            }
        }

        // Fallback: look for paragraphs if no main container found
        if (!content) {
            content = $('p').map((i, el) => $(el).text()).get().join('\n\n')
        }

        return NextResponse.json({
            title,
            content: content.trim()
        })

    } catch (error: any) {
        console.error('Fetch error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch content' },
            { status: 500 }
        )
    }
}
