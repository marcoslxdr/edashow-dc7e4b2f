'use client'

import React from 'react'
import Link from 'next/link'
import { Sparkles, RefreshCw, Wand2, Newspaper, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isPostGenerationEnabled } from '@/lib/feature-flags'

const postGenerationEnabled = isPostGenerationEnabled()

export default function AIDashboardPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-orange-500" />
          Centro de Inteligência Artificial
        </h1>
        <p className="text-gray-500 mt-2">
          Aumente sua produtividade editorial com ferramentas de IA otimizadas para o EDA Show.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow border-orange-100 bg-gradient-to-br from-white to-orange-50/30">
          <CardHeader>
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-4">
              <Wand2 className="text-white w-6 h-6" />
            </div>
            <CardTitle>Gerador de Posts SEO</CardTitle>
            <CardDescription>
              Crie posts completos a partir de um tópico ou palavras-chave. Inclui meta tags e estrutura otimizada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {postGenerationEnabled ? (
              <Link href="/cms/ai/generator">
                <Button className="w-full bg-orange-500 hover:bg-orange-600">
                  Começar Geração
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Button className="w-full" disabled variant="secondary">
                Geração temporariamente desabilitada
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-blue-100 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
              <RefreshCw className="text-white w-6 h-6" />
            </div>
            <CardTitle>Reescritor de Matérias</CardTitle>
            <CardDescription>
              Transforme notícias externas em conteúdo original com o tom de voz do EDA Show.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/cms/ai/rewriter">
              <Button className="w-full bg-blue-500 hover:bg-blue-600">
                Começar Reescrita
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dicas de Uso</h2>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5" />
            <span>Seja específico nas instruções adicionais para obter resultados mais precisos.</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5" />
            <span>Sempre revise o conteúdo gerado antes de publicar para garantir a acurácia dos fatos.</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5" />
            <span>A reescrita de matérias é ideal para cobrir notícias de última hora mantendo a originalidade.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
