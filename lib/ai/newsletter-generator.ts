/**
 * Newsletter Generator Service
 * Creates newsletters based on recent posts
 */

import { openrouter, MODELS } from './openrouter'
import { sql } from '@/lib/db/client'

export interface NewsletterConfig {
    postIds?: string[]
    daysBack?: number
    categoryFilter?: string[]
    tone?: 'professional' | 'casual' | 'formal' | 'friendly'
    style?: 'summary' | 'detailed' | 'listicle' | 'highlights'
    frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
    additionalNotes?: string
}

export interface GeneratedNewsletter {
    title: string
    subject: string
    content: string
    htmlContent: string
    posts: Array<{
        id: string
        title: string
        excerpt: string
    }>
}

interface PostForNewsletter {
    id: string
    title: string
    excerpt: string
    slug: string
    published_at: string
    category?: { name: string } | null
}

/**
 * Get recent posts for newsletter
 */
async function getRecentPosts(
    daysBack: number = 7,
    categoryFilter?: string[]
): Promise<PostForNewsletter[]> {
    const supabase = createAdminClient()
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - daysBack)

    let query = supabase
        .from('posts')
        .select('id, title, excerpt, slug, published_at, categories(name)')
        .eq('status', 'published')
        .gte('published_at', sinceDate.toISOString())
        .order('published_at', { ascending: false })
        .limit(20)

    if (categoryFilter?.length) {
        query = query.in('category_id', categoryFilter)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching posts for newsletter:', error)
        return []
    }

    return (data || []).map(post => ({
        id: post.id,
        title: post.title,
        excerpt: post.excerpt || '',
        slug: post.slug,
        published_at: post.published_at,
        category: post.categories as unknown as { name: string } | null
    }))
}

/**
 * Get posts by IDs
 */
async function getPostsByIds(postIds: string[]): Promise<PostForNewsletter[]> {
    if (!postIds.length) return []

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('posts')
        .select('id, title, excerpt, slug, published_at, categories(name)')
        .in('id', postIds)
        .order('published_at', { ascending: false })

    if (error) {
        console.error('Error fetching posts by IDs:', error)
        return []
    }

    return (data || []).map(post => ({
        id: post.id,
        title: post.title,
        excerpt: post.excerpt || '',
        slug: post.slug,
        published_at: post.published_at,
        category: post.categories as unknown as { name: string } | null
    }))
}

/**
 * Generate newsletter content
 */
export async function generateNewsletter(
    config: NewsletterConfig
): Promise<GeneratedNewsletter> {
    // Get posts
    let posts: PostForNewsletter[]
    if (config.postIds?.length) {
        posts = await getPostsByIds(config.postIds)
    } else {
        posts = await getRecentPosts(config.daysBack || 7, config.categoryFilter)
    }

    if (!posts.length) {
        throw new Error('Nenhum post encontrado para gerar a newsletter')
    }

    const toneDescriptions = {
        professional: 'profissional e informativo',
        casual: 'casual e acessível',
        formal: 'formal e respeitoso',
        friendly: 'amigável e próximo do leitor'
    }

    const styleDescriptions = {
        summary: 'resumos curtos de cada artigo',
        detailed: 'descrições mais longas com contexto',
        listicle: 'formato de lista numerada',
        highlights: 'apenas os destaques principais'
    }

    const frequencyNames = {
        daily: 'diária',
        weekly: 'semanal',
        biweekly: 'quinzenal',
        monthly: 'mensal'
    }

    const postsSummary = posts.map(p => `
- **${p.title}**
  Resumo: ${p.excerpt || 'Sem resumo disponível'}
  Link: /posts/${p.slug}
  ${p.category?.name ? `Categoria: ${p.category.name}` : ''}
`).join('\n')

    const prompt = `Crie uma newsletter para o portal EDA Show com os seguintes posts:

Posts para incluir:
${postsSummary}

Configurações:
- Tom: ${toneDescriptions[config.tone || 'professional']}
- Estilo: ${styleDescriptions[config.style || 'summary']}
- Periodicidade: ${frequencyNames[config.frequency || 'weekly']}

${config.additionalNotes ? `Notas adicionais: ${config.additionalNotes}` : ''}

Crie uma newsletter que inclua:
1. Um título criativo para esta edição
2. Um assunto de email atraente (máximo 60 caracteres)
3. Saudação inicial personalizada
4. Apresentação dos artigos de forma atraente
5. Call-to-action para cada artigo
6. Despedida cordial

Responda em JSON:
{
  "title": "título da newsletter",
  "subject": "assunto do email",
  "content": "conteúdo completo em Markdown"
}`

    const result = await openrouter.generateJSON<{
        title: string
        subject: string
        content: string
    }>(prompt, {
        model: MODELS.CLAUDE_HAIKU,
        temperature: 0.7,
        maxTokens: 3000
    })

    // Generate HTML version
    const htmlContent = await convertToEmailHTML(result.content)

    return {
        title: result.title || 'Newsletter EDA Show',
        subject: result.subject || 'Destaques da semana - EDA Show',
        content: result.content || '',
        htmlContent,
        posts: posts.map(p => ({
            id: p.id,
            title: p.title,
            excerpt: p.excerpt
        }))
    }
}

/**
 * Convert markdown to email-safe HTML
 */
async function convertToEmailHTML(markdown: string): Promise<string> {
    const prompt = `Converta o seguinte Markdown para HTML otimizado para email:

${markdown}

Requisitos:
1. Use tabelas para layout (emails não suportam flexbox/grid)
2. Estilos inline em cada elemento
3. Fontes seguras: Arial, Helvetica, sans-serif
4. Cores do EDA Show: laranja (#f97316), cinza escuro (#1f2937)
5. Links com cor destacada
6. Espaçamento adequado
7. Responsivo com max-width

Retorne apenas o HTML do corpo do email (sem <html>, <head>, <body>).`

    const html = await openrouter.generate(prompt, {
        model: MODELS.CLAUDE_HAIKU,
        temperature: 0.3,
        maxTokens: 4000
    })

    // Wrap in basic email template
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Newsletter EDA Show</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #f97316; padding: 24px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">EDA Show</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px;">
                            ${html}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1f2937; padding: 24px; text-align: center;">
                            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                                © ${new Date().getFullYear()} EDA Show. Todos os direitos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

/**
 * Save newsletter to database
 */
export async function saveNewsletter(
    newsletter: GeneratedNewsletter,
    config: NewsletterConfig,
    scheduledFor?: Date
): Promise<string> {
    const rows = await sql`
        INSERT INTO newsletters (title, subject, content, html_content, post_ids, tone, style, status, scheduled_for)
        VALUES (${newsletter.title}, ${newsletter.subject}, ${newsletter.content}, ${newsletter.htmlContent},
            ${JSON.stringify(newsletter.posts.map((p: any) => p.id))}, ${config.tone || 'professional'},
            ${config.style || 'summary'}, ${scheduledFor ? 'scheduled' : 'draft'},
            ${scheduledFor?.toISOString() || null})
        RETURNING id
    `
    if (!rows || rows.length === 0) throw new Error('Failed to save newsletter')
    return rows[0].id
}

/**
 * Get newsletter schedules
 */
export async function getNewsletterSchedules() {
    try {
        return sql`SELECT * FROM newsletter_schedules WHERE is_active = true ORDER BY next_run_at ASC` as Promise<any[]>
    } catch {
        return []
    }
}

/**
 * Create or update newsletter schedule
 */
export async function upsertNewsletterSchedule(schedule: {
    id?: string
    name: string
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
    dayOfWeek?: number
    dayOfMonth?: number
    timeOfDay?: string
    tone?: string
    style?: string
    categoryFilter?: string[]
    isActive?: boolean
}): Promise<string> {
    const nextRunAt = calculateNextRunTime(schedule)

    let result
    if (schedule.id) {
        result = await sql`
            UPDATE newsletter_schedules SET name = ${schedule.name}, frequency = ${schedule.frequency},
                day_of_week = ${schedule.dayOfWeek ?? null}, day_of_month = ${schedule.dayOfMonth ?? null},
                time_of_day = ${schedule.timeOfDay || '09:00:00'}, tone = ${schedule.tone || 'professional'},
                style = ${schedule.style || 'summary'}, category_filter = ${JSON.stringify(schedule.categoryFilter || [])},
                is_active = ${schedule.isActive ?? true}, next_run_at = ${nextRunAt?.toISOString() ?? null}
            WHERE id = ${schedule.id} RETURNING id
        `
    } else {
        result = await sql`
            INSERT INTO newsletter_schedules (name, frequency, day_of_week, day_of_month, time_of_day, tone, style, category_filter, is_active, next_run_at)
            VALUES (${schedule.name}, ${schedule.frequency}, ${schedule.dayOfWeek ?? null}, ${schedule.dayOfMonth ?? null},
                ${schedule.timeOfDay || '09:00:00'}, ${schedule.tone || 'professional'}, ${schedule.style || 'summary'},
                ${JSON.stringify(schedule.categoryFilter || [])}, ${schedule.isActive ?? true}, ${nextRunAt?.toISOString() ?? null})
            RETURNING id
        `
    }

    if (!result || result.length === 0) throw new Error('Failed to save schedule')
    return result[0].id
}

/**
 * Calculate next run time for a schedule
 */
function calculateNextRunTime(schedule: {
    frequency: string
    dayOfWeek?: number
    dayOfMonth?: number
    timeOfDay?: string
}): Date | null {
    const now = new Date()
    const [hours, minutes] = (schedule.timeOfDay || '09:00').split(':').map(Number)
    const next = new Date()
    next.setHours(hours, minutes, 0, 0)

    switch (schedule.frequency) {
        case 'daily':
            if (next <= now) next.setDate(next.getDate() + 1)
            break
        case 'weekly':
            if (schedule.dayOfWeek !== undefined) {
                next.setDate(next.getDate() + ((7 + schedule.dayOfWeek - next.getDay()) % 7 || 7))
            }
            break
        case 'biweekly':
            if (schedule.dayOfWeek !== undefined) {
                next.setDate(next.getDate() + ((7 + schedule.dayOfWeek - next.getDay()) % 7 || 14))
            }
            break
        case 'monthly':
            if (schedule.dayOfMonth !== undefined) {
                next.setDate(schedule.dayOfMonth)
                if (next <= now) next.setMonth(next.getMonth() + 1)
            }
            break
    }

    return next
}
