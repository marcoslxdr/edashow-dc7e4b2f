export interface KeywordCategoryRule {
  pattern: RegExp
  slug: string
}

export const KEYWORD_CATEGORY_RULES: KeywordCategoryRule[] = [
  { pattern: /odont|dental|dentista/i, slug: 'odontologia' },
  { pattern: /maternidade|parto|beb[eê]|gestante/i, slug: 'maternidade' },
  { pattern: /empresarial|mei|coletivo|corporativ/i, slug: 'empresarial' },
  { pattern: /psicolog|mental|terapia/i, slug: 'saude-mental' },
  { pattern: /hospital|interna[cç][aã]o/i, slug: 'hospital' },
  { pattern: /idoso|terceira idade|senior/i, slug: 'idosos' },
  { pattern: /telemedicina|consulta online|digital/i, slug: 'telemedicina' },
  { pattern: /emerg[eê]ncia|ambul[aâ]ncia/i, slug: 'emergencia' },
  { pattern: /exame|laborat|resson[aâ]ncia|tomografia/i, slug: 'exames' },
  { pattern: /cancelar|contrato|document|burocrac/i, slug: 'documentos' },
  { pattern: /barato|economia|custo|pre[cç]o/i, slug: 'custo-economia' },
  { pattern: /fam[ií]lia|familiar/i, slug: 'familia' },
  { pattern: /farm[aá]cia|rem[eé]dio/i, slug: 'farmacia' },
  { pattern: /consulta|m[eé]dico|cl[ií]nica/i, slug: 'consulta-medica' },
]

export const DEFAULT_VISUAL_CATEGORY_SLUG = 'bem-estar'

export function keywordToVisualCategorySlug(keyword: string): string {
  const normalized = keyword.trim()
  for (const rule of KEYWORD_CATEGORY_RULES) {
    if (rule.pattern.test(normalized)) return rule.slug
  }
  return DEFAULT_VISUAL_CATEGORY_SLUG
}
