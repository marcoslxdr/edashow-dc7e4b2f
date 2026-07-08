/**
 * OpenCode Go API Client
 * https://opencode.ai/docs/go/
 */

export interface OpenCodeMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface OpenCodeRequest {
    model?: string
    messages: OpenCodeMessage[]
    max_tokens?: number
    temperature?: number
    stream?: boolean
    response_format?: { type: 'json_object' }
    stop?: string | string[]
}

export interface OpenCodeResponse {
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

export interface OpenCodeStreamChunk {
    id: string
    choices: Array<{
        delta: {
            role?: string
            content?: string | null
        }
        finish_reason: string | null
    }>
}

export interface OpenCodeModel {
    id: string
    object: string
    created: number
    owned_by: string
}

/** OpenCode Go model IDs — https://opencode.ai/docs/go/ */
export const MODELS = {
    // Post generation
    KIMI_K2_6: 'kimi-k2.6',
    KIMI_K2_7_CODE: 'kimi-k2.7-code',
    GLM_5_2: 'glm-5.2',
    GLM_5_1: 'glm-5.1',

    // Fast & cheap — categorization, keywords, SEO
    DEEPSEEK_V4_FLASH: 'deepseek-v4-flash',
    MIMO_V2_5: 'mimo-v2.5',
    DEEPSEEK_V4_PRO: 'deepseek-v4-pro',
} as const

const OPENCODE_API_URL =
    process.env.OPENCODE_API_BASE?.replace(/\/$/, '') || 'https://opencode.ai/zen/go/v1'

function stripModelPrefix(model: string): string {
    return model.replace(/^opencode-go\//, '').replace(/^opencode\//, '')
}

function resolveChatEndpoint(): string {
    return `${OPENCODE_API_URL}/chat/completions`
}

function resolveModelId(model?: string): string {
    const raw =
        model ||
        process.env.OPENCODE_POST_MODEL ||
        process.env.OPENCODE_DEFAULT_MODEL ||
        MODELS.KIMI_K2_6
    return stripModelPrefix(raw)
}

class OpenCodeClient {
    private apiKey: string | undefined

    constructor() {
        this.apiKey = process.env.OPENCODE_API_KEY
    }

    private getHeaders(): HeadersInit {
        if (!this.apiKey) {
            throw new Error('OPENCODE_API_KEY not configured')
        }

        return {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        }
    }

    isConfigured(): boolean {
        return !!this.apiKey && this.apiKey.length > 0
    }

    async getModels(): Promise<OpenCodeModel[]> {
        const response = await fetch(`${OPENCODE_API_URL}/models`, {
            headers: this.getHeaders(),
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch OpenCode models: ${response.statusText}`)
        }

        const data = await response.json()
        return data.data || []
    }

    async chat(request: OpenCodeRequest): Promise<OpenCodeResponse> {
        const model = resolveModelId(request.model)
        const body: OpenCodeRequest = {
            model,
            messages: request.messages,
            max_tokens: request.max_tokens || parseInt(process.env.AI_MAX_TOKENS || '4000', 10),
            temperature: request.temperature ?? parseFloat(process.env.AI_TEMPERATURE || '0.7'),
            stream: false,
            ...request,
            model,
        }

        const endpoint = resolveChatEndpoint()
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            const message =
                (error as { error?: { message?: string }; message?: string }).error?.message ||
                (error as { message?: string }).message ||
                response.statusText
            throw new Error(`OpenCode API error: ${message}`)
        }

        return response.json() as Promise<OpenCodeResponse>
    }

    async *chatStream(request: OpenCodeRequest): AsyncGenerator<string, void, unknown> {
        const model = resolveModelId(request.model)
        const body: OpenCodeRequest = {
            model,
            messages: request.messages,
            max_tokens: request.max_tokens || parseInt(process.env.AI_MAX_TOKENS || '4000', 10),
            temperature: request.temperature ?? parseFloat(process.env.AI_TEMPERATURE || '0.7'),
            stream: true,
            ...request,
            model,
        }

        const endpoint = resolveChatEndpoint()
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            const message =
                (error as { error?: { message?: string } }).error?.message || response.statusText
            throw new Error(`OpenCode API error: ${message}`)
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
                    if (data === '[DONE]') return
                    try {
                        const chunk: OpenCodeStreamChunk = JSON.parse(data)
                        const content = chunk.choices[0]?.delta?.content
                        if (content) yield content
                    } catch {
                        // skip invalid JSON
                    }
                }
            }
        }
    }

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
        const messages: OpenCodeMessage[] = []
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt })
        }
        messages.push({ role: 'user', content: prompt })

        const response = await this.chat({
            model: options.model,
            messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
            response_format: options.jsonMode ? { type: 'json_object' } : undefined,
        })

        return response.choices[0]?.message?.content || this.extractReasoningContent(response.choices[0]) || ''
    }

    private extractReasoningContent(choice?: OpenCodeResponse['choices'][0]): string {
        const message = choice?.message as { reasoning_content?: string } | undefined
        const reasoning = message?.reasoning_content
        if (!reasoning || typeof reasoning !== 'string') return ''
        return reasoning
    }

    async generateJSON<T = unknown>(
        prompt: string,
        options: {
            systemPrompt?: string
            model?: string
            maxTokens?: number
            temperature?: number
        } = {}
    ): Promise<T> {
        const content = await this.generate(prompt, { ...options, jsonMode: true })
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) return JSON.parse(jsonMatch[0])
            return JSON.parse(content)
        } catch {
            console.error('Failed to parse JSON response:', content)
            throw new Error('Invalid JSON response from OpenCode')
        }
    }

    calculateCost(model: string, promptTokens: number, completionTokens: number): number {
        const bare = stripModelPrefix(model)
        const pricing: Record<string, { prompt: number; completion: number }> = {
            'kimi-k2.6': { prompt: 0.95, completion: 4.0 },
            'kimi-k2.7-code': { prompt: 0.95, completion: 4.0 },
            'glm-5.2': { prompt: 1.4, completion: 4.4 },
            'glm-5.1': { prompt: 1.4, completion: 4.4 },
            'deepseek-v4-flash': { prompt: 0.14, completion: 0.28 },
            'deepseek-v4-pro': { prompt: 1.74, completion: 3.48 },
            'mimo-v2.5': { prompt: 0.14, completion: 0.28 },
            'mimo-v2.5-pro': { prompt: 1.74, completion: 3.48 },
        }

        const modelPricing = pricing[bare] || { prompt: 0, completion: 0 }
        const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt
        const completionCost = (completionTokens / 1_000_000) * modelPricing.completion
        return promptCost + completionCost
    }
}

export const opencode = new OpenCodeClient()

export function getPostModel(model?: string): string {
    return resolveModelId(model)
}

export function getFastModel(): string {
    return (
        process.env.OPENCODE_FAST_MODEL ||
        process.env.OPENCODE_DEFAULT_MODEL ||
        MODELS.DEEPSEEK_V4_FLASH
    ).replace(/^opencode-go\//, '').replace(/^opencode\//, '')
}
