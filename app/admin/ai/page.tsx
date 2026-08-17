import { getPersonas, getKnowledgeBlocks } from '@/lib/actions/ai-config'
import { AIConfigTabs } from '@/components/admin/ai/ai-config-tabs'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/actions/cms-authz'

export const dynamic = 'force-dynamic'

export default async function AdminAIPage() {
  try {
    await requireAdmin()
  } catch {
    redirect('/cms/login')
  }
  const personas = await getPersonas().catch(() => [])
  const knowledgeBlocks = await getKnowledgeBlocks().catch(() => [])

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Configuração do Motor de IA</h1>
        <p className="text-muted-foreground">
          Gerencie as Personas e a Base de Conhecimento que alimentam a geração de conteúdo.
        </p>
      </div>

      <AIConfigTabs 
        initialPersonas={personas} 
        initialKnowledge={knowledgeBlocks} 
      />
    </div>
  )
}
