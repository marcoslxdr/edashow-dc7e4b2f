import { NextResponse } from 'next/server'
import { sendText, getInstanceStatus } from '@/lib/evolution/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/evolution/test
 * Verifica status da instância
 *
 * POST /api/evolution/test
 * Envia mensagem de teste para o número do dono
 * Body (opcional): { "number": "5548...", "message": "..." }
 */

export async function GET() {
  const status = await getInstanceStatus()
  return NextResponse.json({ status })
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const number = body.number || process.env.EVOLUTION_OWNER_NUMBER
  const message = body.message || `✅ *Teste EdaShow*\n\nConexão com Evolution API funcionando!\n\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`

  if (!number) {
    return NextResponse.json(
      { error: 'Número não informado. Configure EVOLUTION_OWNER_NUMBER ou passe "number" no body.' },
      { status: 400 }
    )
  }

  const result = await sendText({ number, text: message })

  return NextResponse.json({
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    to: number,
  }, { status: result.success ? 200 : 500 })
}
