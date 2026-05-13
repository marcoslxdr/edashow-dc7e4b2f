import { marked } from 'marked'

/**
 * Normaliza o HTML do conteudo do post
 * Converte markdown para HTML e remove blockquotes
 */
export function normalizePostContent(html: string): string {
  if (!html) return ''

  // Remove espacos em branco do inicio e fim
  let content = html.trim()

  // Detecta se o conteudo parece ser markdown (tem sintaxe markdown mas poucas tags HTML)
  const hasMarkdownSyntax = /(^|\n)(#{1,6}\s|\*\*|__|\*|_|~~|`|^- |\d+\. )/.test(content)
  const htmlTagCount = (content.match(/<[a-z][\s\S]*?>/gi) || []).length
  const isMarkdown = hasMarkdownSyntax && htmlTagCount < 10

  // Se for markdown, converte para HTML
  if (isMarkdown) {
    content = marked.parse(content, { async: false }) as string
  }

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
