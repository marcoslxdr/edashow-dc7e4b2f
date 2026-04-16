/**
 * Evolution API Client - Integração WhatsApp
 * Docs: https://doc.evolution-api.com
 */

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL || ''
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'edashow'

export interface SendTextOptions {
  number: string // Ex: "5548865362230" (sem @s.whatsapp.net)
  text: string
  delay?: number // ms de delay antes de enviar
}

export interface SendTextResult {
  success: boolean
  messageId?: string
  error?: string
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST' = 'POST',
  body?: unknown
): Promise<T> {
  if (!EVOLUTION_BASE_URL) throw new Error('EVOLUTION_API_URL não configurada')
  if (!EVOLUTION_API_KEY) throw new Error('EVOLUTION_API_KEY não configurada')

  const url = `${EVOLUTION_BASE_URL}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Evolution API ${res.status}: ${errText}`)
  }

  return res.json() as Promise<T>
}

/** Envia mensagem de texto via WhatsApp */
export async function sendText(options: SendTextOptions): Promise<SendTextResult> {
  try {
    const data = await request<{ key?: { id?: string } }>(
      `/message/sendText/${EVOLUTION_INSTANCE}`,
      'POST',
      {
        number: options.number,
        text: options.text,
        delay: options.delay ?? 1000,
      }
    )

    return {
      success: true,
      messageId: data?.key?.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Retorna o status da instância */
export async function getInstanceStatus(): Promise<{
  connected: boolean
  state?: string
  error?: string
}> {
  try {
    const data = await request<{ instance?: { state?: string } }>(
      `/instance/connectionState/${EVOLUTION_INSTANCE}`,
      'GET'
    )
    const state = data?.instance?.state
    return {
      connected: state === 'open',
      state,
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Envia mensagem formatada para o número do dono (self-notification) */
export async function notifyOwner(message: string): Promise<SendTextResult> {
  const ownerNumber = process.env.EVOLUTION_OWNER_NUMBER
  if (!ownerNumber) {
    return { success: false, error: 'EVOLUTION_OWNER_NUMBER não configurada' }
  }
  return sendText({ number: ownerNumber, text: message })
}
