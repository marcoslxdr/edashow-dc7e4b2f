import { Sparkles } from 'lucide-react'

export function PostGenerationDisabled() {
  return (
    <div className="max-w-lg mx-auto mt-12 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
        <Sparkles className="h-6 w-6 text-amber-600" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">Geração de posts pausada</h2>
      <p className="mt-2 text-sm text-gray-600">
        A geração automática e manual de posts por IA está temporariamente desabilitada.
        Você ainda pode criar e editar posts manualmente em Posts.
      </p>
    </div>
  )
}
