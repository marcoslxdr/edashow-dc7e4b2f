import { createOpenAI } from '@ai-sdk/openai';

/**
 * OpenRouter Provider for Vercel AI SDK
 * OpenRouter is compatible with the OpenAI SDK
 */
export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'EDA Show CMS',
  },
});

/**
 * Default model for generations - Gemini 2.5 Flash
 */
export const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash';
export const PREMIUM_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash';

/**
 * Image generation model - Gemini 2.5 Flash Image (Nano Banana)
 */
export const IMAGE_MODEL = 'google/gemini-2.5-flash-image';
