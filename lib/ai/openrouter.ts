/**
 * OpenRouter API Client
 * Unified interface for accessing multiple LLM models
 */

export interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface OpenRouterRequest {
    model?: string
    messages: OpenRouterMessage[]
    max_tokens?: number
    temperature?: number
    stream?: boolean
    response_format?: { type: 'json_object' }
    stop?: string | string[]
}

export interface OpenRouterResponse {
    id: string
    choices: Array<{
        message: {
            role: string
            content: string | null
        }
        finish_reason: string | null
    }>
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
    model: string
}

export interface OpenRouterStreamChunk {
    id: string
    choices: Array<{
        delta: {
            role?: string
            content?: string | null
        }
        finish_reason: string | null
    }>
}

export interface OpenRouterModel {
    id: string
    name: string
    description?: string
    pricing: {
        prompt: string
        completion: string
    }
    context_length: number
}

// Popular models for quick reference
export const MODELS = {
    // Gemini (default)
    GEMINI_25_FLASH: 'google/gemini-2.5-flash',
    GEMINI_25_FLASH_IMAGE: 'google/gemini-2.5-flash-image',
    GEMINI_FLASH: 'google/gemini-flash-1.5',
    GEMINI_PRO: 'google/gemini-pro-1.5',

    // Free models
    FREE_LLAMA: 'meta-llama/llama-3.2-3b-instruct:free',
    FREE_GEMMA: 'google/gemma-2-9b-it:free',
    FREE_QWEN: 'qwen/qwen-2-7b-instruct:free',

    // Fast & cheap
    CLAUDE_HAIKU: 'anthropic/claude-3-haiku',
    GPT_4O_MINI: 'openai/gpt-4o-mini',
    GLM_FLASH: 'z-ai/glm-4.7-flash',

    // DeepSeek
    DEEPSEEK_V4_FLASH: 'deepseek/deepseek-v4-flash',

    // Quality
    CLAUDE_SONNET: 'anthropic/claude-3.5-sonnet',
    GPT_4O: 'openai/gpt-4o',

    // Premium
    CLAUDE_OPUS: 'anthropic/claude-3-opus',
    GPT_4_TURBO: 'openai/gpt-4-turbo',
} as const

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'

class OpenRouterClient {
    private apiKey: string | undefined
    private defaultModel: string

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY
        this.defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || MODELS.GEMINI_25_FLASH
    }

    private getHeaders(): HeadersInit {
        if (!this.apiKey) {
            throw new Error('OPENROUTER_API_KEY not configured')
        }

        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
            'X-Title': 'EDA Show CMS'
        }
    }

    /**
     * Check if API is configured
     */
    isConfigured(): boolean {
        return !!this.apiKey && this.apiKey.length > 0
    }

    /**
     * Get available models from OpenRouter
     */
    async getModels(): Promise<OpenRouterModel[]> {
        const response = await fetch(`${OPENROUTER_API_URL}/models`, {
            headers: this.getHeaders()
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`)
        }

        const data = await response.json()
        return data.data || []
    }

    /**
     * Send a chat completion request
     */
    async chat(request: OpenRouterRequest): Promise<OpenRouterResponse> {
        const body: OpenRouterRequest = {
            model: request.model || this.defaultModel,
            messages: request.messages,
            max_tokens: request.max_tokens || parseInt(process.env.AI_MAX_TOKENS || '4000'),
            temperature: request.temperature ?? parseFloat(process.env.AI_TEMPERATURE || '0.7'),
            stream: false,
            ...request
        }

        const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(`OpenRouter API error: ${error.message || response.statusText}`)
        }

        return response.json()
    }

    /**
     * Send a streaming chat completion request
     */
    async *chatStream(request: OpenRouterRequest): AsyncGenerator<string, void, unknown> {
        const body: OpenRouterRequest = {
            model: request.model || this.defaultModel,
            messages: request.messages,
            max_tokens: request.max_tokens || parseInt(process.env.AI_MAX_TOKENS || '4000'),
            temperature: request.temperature ?? parseFloat(process.env.AI_TEMPERATURE || '0.7'),
            stream: true,
            ...request
        }

        const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(`OpenRouter API error: ${error.message || response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
            throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') {
                        return
                    }
                    try {
                        const chunk: OpenRouterStreamChunk = JSON.parse(data)
                        const content = chunk.choices[0]?.delta?.content
                        if (content) {
                            yield content
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    /**
     * Simple text generation helper
     */
    async generate(
        prompt: string,
        options: {
            systemPrompt?: string
            model?: string
            maxTokens?: number
            temperature?: number
            jsonMode?: boolean
        } = {}
    ): Promise<string> {
        const messages: OpenRouterMessage[] = []

        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt })
        }

        messages.push({ role: 'user', content: prompt })

        const response = await this.chat({
            model: options.model,
            messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
            response_format: options.jsonMode ? { type: 'json_object' } : undefined
        })

        return response.choices[0]?.message?.content || ''
    }

    /**
     * Generate with JSON response
     */
    async generateJSON<T = unknown>(
        prompt: string,
        options: {
            systemPrompt?: string
            model?: string
            maxTokens?: number
            temperature?: number
        } = {}
    ): Promise<T> {
        const content = await this.generate(prompt, {
            ...options,
            jsonMode: true
        })

        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0])
            }
            return JSON.parse(content)
        } catch (error) {
            console.error('Failed to parse JSON response:', content)
            throw new Error('Invalid JSON response from AI')
        }
    }

    /**
     * Calculate estimated cost based on model and tokens
     */
    calculateCost(model: string, promptTokens: number, completionTokens: number): number {
        // Approximate pricing (per 1M tokens)
        const pricing: Record<string, { prompt: number; completion: number }> = {
            'google/gemini-2.5-flash-preview-05-20': { prompt: 0.15, completion: 0.60 },
            'google/gemini-2.5-flash-image-preview': { prompt: 0.10, completion: 0.40 },
            'google/gemini-flash-1.5': { prompt: 0.075, completion: 0.30 },
            'anthropic/claude-3-haiku': { prompt: 0.25, completion: 1.25 },
            'anthropic/claude-3.5-sonnet': { prompt: 3, completion: 15 },
            'anthropic/claude-3-opus': { prompt: 15, completion: 75 },
            'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
            'openai/gpt-4o': { prompt: 2.50, completion: 10 },
            'z-ai/glm-4.7-flash': { prompt: 0.05, completion: 0.10 },
        }

        const modelPricing = pricing[model] || { prompt: 0, completion: 0 }
        const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt
        const completionCost = (completionTokens / 1_000_000) * modelPricing.completion

        return promptCost + completionCost
    }
}

// Export singleton instance
export const openrouter = new OpenRouterClient()
