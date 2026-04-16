/**
 * 100 palavras-chave sobre planos de saúde para geração automática de posts
 * Usadas pelo cron job para selecionar temas aleatórios diariamente
 */
export const HEALTH_INSURANCE_KEYWORDS: string[] = [
  // Dúvidas e problemas comuns (1-10)
  'plano de saúde barato',
  'plano de saúde individual',
  'plano de saúde familiar',
  'plano de saúde para MEI',
  'plano de saúde para autônomo',
  'plano de saúde sem carência',
  'como cancelar plano de saúde',
  'plano de saúde negou cobertura',
  'o que cobre plano de saúde',
  'plano de saúde vale a pena',
  // Tipos de plano (11-20)
  'plano de saúde empresarial',
  'plano de saúde coletivo',
  'plano de saúde por adesão',
  'plano de saúde odontológico',
  'plano de saúde com cobertura nacional',
  'plano de saúde regional',
  'plano de saúde ambulatorial',
  'plano de saúde hospitalar',
  'plano de saúde referência',
  'plano de saúde básico',
  // Coberturas e procedimentos (21-30)
  'cobertura de cirurgia plano de saúde',
  'cobertura de parto plano de saúde',
  'cobertura de psicologia plano de saúde',
  'cobertura de fisioterapia',
  'cobertura de oncologia',
  'cobertura de exames laboratoriais',
  'cobertura de ressonância magnética',
  'cobertura de ortopedia',
  'cobertura de maternidade',
  'cobertura de emergência',
  // Carência e regras (31-40)
  'prazo de carência plano de saúde',
  'carência para parto',
  'carência para cirurgia',
  'doença preexistente plano de saúde',
  'coparticipação plano de saúde',
  'reembolso plano de saúde',
  'portabilidade de carência',
  'reajuste anual plano de saúde',
  'limite de cobertura plano de saúde',
  'exclusões de cobertura',
  // Principais operadoras (41-50)
  'Unimed plano de saúde',
  'Hapvida plano de saúde',
  'Amil plano de saúde',
  'SulAmérica saúde',
  'Bradesco Saúde',
  'NotreDame Intermédica',
  'Porto Seguro saúde',
  'Prevent Senior',
  'Sompo Saúde',
  'Golden Cross',
  // Público-alvo específico (51-60)
  'plano de saúde para idosos',
  'plano de saúde para gestantes',
  'plano de saúde para bebê',
  'plano de saúde para pet',
  'plano de saúde para microempreendedor',
  'plano de saúde para servidor público',
  'plano de saúde para aposentado',
  'plano de saúde para estudante',
  'plano de saúde para casal',
  'plano de saúde para trabalhador informal',
  // Comparativos e escolha (61-70)
  'como escolher plano de saúde',
  'melhor plano de saúde custo-benefício',
  'comparar planos de saúde',
  'simulação plano de saúde',
  'cotação plano de saúde online',
  'plano de saúde x SUS',
  'plano de saúde x seguro saúde',
  'diferença entre planos de saúde',
  'como contratar plano de saúde',
  'plano de saúde mais barato do Brasil',
  // Direitos e ANS (71-80)
  'ANS plano de saúde',
  'direitos do beneficiário plano de saúde',
  'rol de procedimentos ANS',
  'prazo para atendimento plano de saúde',
  'como reclamar plano de saúde',
  'ouvidoria plano de saúde',
  'rescisão unilateral plano de saúde',
  'plano de saúde obrigado a cobrir',
  'ação judicial plano de saúde',
  'PROCON plano de saúde',
  // Preços e economia (81-90)
  'quanto custa plano de saúde',
  'plano de saúde a partir de R$100',
  'desconto em plano de saúde',
  'plano de saúde parcelado',
  'plano de saúde por CPF',
  'plano de saúde com desconto em farmácia',
  'benefícios extras plano de saúde',
  'plano de saúde com telemedicina',
  'reajuste plano de saúde 2025',
  'faixa etária plano de saúde preço',
  // Tendências e novidades (91-100)
  'telemedicina plano de saúde',
  'plano de saúde digital',
  'plano de saúde com app',
  'saúde mental plano de saúde',
  'plano de saúde preventivo',
  'plano de saúde e inteligência artificial',
  'plano de saúde com desconto em academia',
  'plano de saúde sustentável',
  'plano de saúde pós-pandemia',
  'novidades ANS 2025',
]

/**
 * Seleciona N palavras-chave aleatórias sem repetição (Fisher-Yates shuffle)
 */
export function selectRandomKeywords(count: number): string[] {
  const shuffled = [...HEALTH_INSURANCE_KEYWORDS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}
