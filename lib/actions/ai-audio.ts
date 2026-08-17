'use server'

/**
 * AI Audio Server Actions
 * Server actions for audio transcription and processing
 */

import {
  transcribeAudio,
  processTranscription,
  isTranscriptionAvailable,
  validateAudioFile,
  getSupportedFormats,
  type TranscriptionResult,
  type ProcessedTranscription as ProcessedTranscriptionType
} from '@/lib/ai/transcription'
import { requireCmsRole } from './cms-authz'

// Re-export type for consumers
export type ProcessedTranscription = ProcessedTranscriptionType

/**
 * Check if transcription service is available
 */
export async function checkTranscriptionService(): Promise<{
  available: boolean
  supportedFormats: string[]
  maxFileSize: string
}> {
  await requireCmsRole()
  return {
    available: isTranscriptionAvailable(),
    supportedFormats: getSupportedFormats(),
    maxFileSize: '25MB'
  }
}

/**
 * Transcribe audio file
 */
export async function transcribeAudioFile(
  formData: FormData
): Promise<ProcessedTranscription> {
  await requireCmsRole()
  const file = formData.get('audio') as File

  if (!file) {
    throw new Error('No audio file provided')
  }

  // Validate file
  const validation = validateAudioFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Check if service is available
  if (!isTranscriptionAvailable()) {
    throw new Error('Transcription service not configured. Add OPENAI_API_KEY to enable.')
  }

  // Get language hint if provided
  const language = formData.get('language') as string | undefined
  const prompt = formData.get('prompt') as string | undefined

  // Transcribe
  const transcription = await transcribeAudio(file, {
    language: language || undefined,
    prompt: prompt || undefined
  })

  // Process into structured content
  const processed = await processTranscription(transcription)

  return processed
}

/**
 * Transcribe audio from URL
 */
export async function transcribeAudioFromUrl(
  url: string,
  options?: {
    language?: string
    prompt?: string
  }
): Promise<ProcessedTranscription> {
  await requireCmsRole()
  if (!isTranscriptionAvailable()) {
    throw new Error('Transcription service not configured. Add OPENAI_API_KEY to enable.')
  }

  // Fetch audio from URL
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch audio from URL')
  }

  const blob = await response.blob()

  // Determine filename from URL or content-disposition
  const urlPath = new URL(url).pathname
  const filename = urlPath.split('/').pop() || 'audio.mp3'

  const file = new File([blob], filename, { type: blob.type || 'audio/mpeg' })

  // Validate
  const validation = validateAudioFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Transcribe
  const transcription = await transcribeAudio(file, options)

  // Process
  return processTranscription(transcription)
}

/**
 * Get raw transcription without processing
 */
export async function getRawTranscription(
  formData: FormData
): Promise<TranscriptionResult> {
  await requireCmsRole()
  const file = formData.get('audio') as File

  if (!file) {
    throw new Error('No audio file provided')
  }

  const validation = validateAudioFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  if (!isTranscriptionAvailable()) {
    throw new Error('Transcription service not configured')
  }

  const language = formData.get('language') as string | undefined

  return transcribeAudio(file, {
    language: language || undefined
  })
}

/**
 * Re-process existing transcription with AI
 */
export async function reprocessTranscription(
  rawText: string,
  duration?: number
): Promise<ProcessedTranscription> {
  await requireCmsRole()
  const { processTranscription } = await import('@/lib/ai/transcription')

  return processTranscription({
    text: rawText,
    duration
  })
}

/**
 * Validate audio file before upload
 */
export async function validateAudio(
  formData: FormData
): Promise<{
  valid: boolean
  error?: string
  fileInfo?: {
    name: string
    size: number
    type: string
  }
}> {
  await requireCmsRole()
  const file = formData.get('audio') as File

  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  const validation = validateAudioFile(file)

  return {
    ...validation,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type
    }
  }
}
