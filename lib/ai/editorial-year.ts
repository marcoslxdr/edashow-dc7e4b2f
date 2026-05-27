/**
 * Referência temporal para geração de posts (cron, CMS, scripts).
 * Usa o ano civil em execução para manter conteúdo alinhado ao período vigente.
 */

export function getEditorialYear(): number {
  return new Date().getFullYear()
}

/** Parágrafo único para concatenar em instruções adicionais (cron, etc.). */
export function getEditorialYearPromptBlock(): string {
  const y = getEditorialYear()
  return `Ano de referência: ${y} (Brasil). Produza texto com dados, regulamentação e exemplos de mercado coerentes com ${y}. Ao citar fatos de anos anteriores, deixe explícito o período; não trate informações obsoletas como vigentes. Priorize o que for relevante para consumidores de planos de saúde em ${y}.`
}

/** Instruções compartilhadas pelos crons de produção de posts. */
export function getProductionAdditionalInstructions(): string {
  return `Foque no contexto brasileiro de planos de saúde.
Mencione a ANS (Agência Nacional de Saúde Suplementar) quando relevante.
Inclua dicas práticas e acionáveis para o leitor.
Use exemplos reais do mercado brasileiro.
O conteúdo deve ser educativo e ajudar consumidores a tomar decisões informadas.
${getEditorialYearPromptBlock()}`
}
