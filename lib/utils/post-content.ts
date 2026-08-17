import { marked } from 'marked'

function sanitizeHtml(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|svg|math|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|svg|math|link|meta|base)[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src|action|xlink:href)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi, '')
}

/**
 * Normaliza o HTML do conteudo do post
 * Converte markdown para HTML e remove blockquotes
 */
export function normalizePostContent(html: string): string {
  if (!html) return ''

  // Remove espacos em branco do inicio e fim
  let content = html.trim()

  // Detecta se o conteudo parece ser markdown (tem sintaxe markdown clara)
  const hasMarkdownSyntax = /(^|\n)(#{1,6}\s|\*\*|__|\*|_|~~|`|^- |\d+\. )/.test(content)
  
  // Se detectar sintaxe markdown, converte para HTML
  // marked consegue lidar com conteudo misturado (markdown + HTML)
  if (hasMarkdownSyntax) {
    content = marked.parse(content, { async: false }) as string
  }

  content = sanitizeHtml(content)

  // Remove TODAS as tags de abertura e fechamento de blockquote
  content = content.replace(/<\/?blockquote[^>]*>/gi, '')

  // Remove espacos extras que possam ter sobrado
  content = content.trim()

  // Se o conteudo resultante estiver vazio, retorna string vazia
  if (!content) return ''

  // Se o conteudo nao tem tags <p>, envolve em paragrafos
  if (!content.includes('<p>') && !content.includes('<h1>') && !content.includes('<h2>') &&
    !content.includes('<h3>') && !content.includes('<ul>') && !content.includes('<ol>')) {
    // Divide por quebras de linha e cria paragrafos
    const paragraphs = content
      .split(/\n\n+/)
      .filter(p => p.trim())
      .map(p => `<p>${p.trim()}</p>`)
      .join('\n')
    return paragraphs
  }

  return content
}
