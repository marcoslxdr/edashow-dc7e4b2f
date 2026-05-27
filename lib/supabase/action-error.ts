/** Converte erros do Supabase/PostgREST em Error para Server Actions (evita HTTP 500 opaco). */
export function toActionError(error: unknown, fallback = 'Erro ao processar a solicitação.'): Error {
    if (error instanceof Error) return error

    if (error && typeof error === 'object') {
        const e = error as { message?: string; code?: string; details?: string; hint?: string }
        const parts = [e.message, e.code, e.details].filter(Boolean)
        if (parts.length) return new Error(parts.join(' — '))
    }

    return new Error(fallback)
}
