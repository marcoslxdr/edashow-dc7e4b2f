'use server'

/**
 * AI Inline Server Actions
 * Server actions for inline AI operations in the editor
 */

import {
  rewriteText,
  expandText,
  summarizeText,
  translateText,
  adjustTone,
  fixGrammar,
  simplifyText,
  continueWriting,
  generateAlternatives,
  isAIAvailable,
  type ToneType,
  type TranslateLanguage,
  type InlineOperationResult
} from '@/lib/ai/inline-operations'
import { requireCmsRole } from './cms-authz'

/**
 * Check if AI operations are available
 */
export async function checkAIInlineAvailable(): Promise<boolean> {
  await requireCmsRole()
  return isAIAvailable()
}

/**
 * Rewrite selected text
 */
export async function aiRewrite(
  text: string,
  style: 'more_formal' | 'more_casual' | 'more_concise' | 'more_detailed' | 'different'
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured. Add OPENROUTER_API_KEY to enable.')
  }

  return rewriteText(text, style)
}

/**
 * Expand text with more details
 */
export async function aiExpand(
  text: string,
  context?: string
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  return expandText(text, context)
}

/**
 * Summarize text
 */
export async function aiSummarize(
  text: string,
  maxLength?: number
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  return summarizeText(text, maxLength)
}

/**
 * Translate text
 */
export async function aiTranslate(
  text: string,
  targetLanguage: TranslateLanguage
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  return translateText(text, targetLanguage)
}

/**
 * Adjust tone
 */
export async function aiAdjustTone(
  text: string,
  targetTone: ToneType
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  return adjustTone(text, targetTone)
}

/**
 * Fix grammar and spelling
 */
export async function aiFixGrammar(
  text: string
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  return fixGrammar(text)
}

/**
 * Simplify complex text
 */
export async function aiSimplify(
  text: string
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  return simplifyText(text)
}

/**
 * Continue writing from text
 */
export async function aiContinue(
  text: string,
  context?: string,
  style?: string
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  return continueWriting(text, context, style)
}

/**
 * Generate alternative versions
 */
export async function aiAlternatives(
  text: string,
  count?: number
): Promise<string[]> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  return generateAlternatives(text, count)
}

/**
 * Quick improve - auto-detect what to fix
 */
export async function aiQuickImprove(
  text: string
): Promise<InlineOperationResult> {
  await requireCmsRole()
  if (!isAIAvailable()) {
    throw new Error('AI not configured')
  }

  const { openrouter } = await import('@/lib/ai/openrouter')

  const prompt = `Improve this text by fixing grammar, improving clarity, and making it more engaging.
Keep the original meaning and length similar.

TEXT:
${text}

Return ONLY the improved text, nothing else.`

  const result = await openrouter.generate(prompt, {
    temperature: 0.5,
    maxTokens: Math.max(text.length * 1.5, 500)
  })

  return {
    original: text,
    result: result.trim(),
    operation: 'rewrite',
    metadata: { type: 'quick_improve' }
  }
}
