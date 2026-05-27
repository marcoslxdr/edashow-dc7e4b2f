# Product

## Register

product

## Users

**Leitores (público):** profissionais e gestores do mercado de saúde suplementar no Brasil. Consultam notícias, cobertura de eventos e congressos no celular ou desktop, muitas vezes após o evento (galeria, vídeos, matérias).

**Editores (CMS):** equipe editorial e marketing da EDA Show. Publicam posts, configuram eventos, sobem galerias pós-congresso, vinculam cobertura. Trabalham em escritório, luz ambiente clara, tarefas repetíveis que exigem velocidade e confiança na ferramenta.

## Product Purpose

Portal editorial e hub de eventos para o setor de saúde suplementar: publicar conteúdo, divulgar congressos, centralizar inscrição, galeria, vídeos e matérias relacionadas a cada evento. Sucesso = leitor encontra tudo sobre um evento em uma página; editor cria o evento rápido e anexa material depois sem fricção.

## Brand Personality

**Confiante, editorial, acolhedor.** Voz direta em português brasileiro, sem jargão de startup. Autoridade de veículo especializado, não de clínica genérica. Laranja como sinal de energia e ação, não como decoração barulhenta.

## Anti-references

- Dashboard SaaS genérico (dark mode roxo, cards idênticos com ícone + título + texto)
- Estética "ferramenta de IA" (gradientes neon, glassmorphism, texto em gradiente)
- Healthcare cliché (branco + teal + ícones de cruz)
- Landing page de métricas hero (número grande + label pequeno + stats)
- Bordas laterais coloridas em cards e alertas (side-stripe)
- Modais para tudo; preferir fluxo inline ou dialogs só para tarefas rápidas pontuais (ex.: anexar galeria na listagem)

## Design Principles

1. **Tarefa primeiro:** o CMS deve sumir na tarefa (publicar, anexar fotos, vincular post). Familiaridade de ferramentas boas (Notion, Linear) vence novidade visual.
2. **Laranja com disciplina:** accent só em ação primária, seleção ativa e foco; superfícies permanecem neutras quentes.
3. **Editorial na leitura, operacional na gestão:** páginas públicas podem ser mais expressivas; `/cms/*` permanece denso, claro e previsível.
4. **Pós-evento é o fluxo real:** criar evento exige pouco; galeria, vídeos e posts vêm depois, sem bloquear publicação.
5. **Mostrar o trabalho:** fotos, vídeos e cobertura aparecem juntos na página do evento; o leitor não caça em rotas escondidas.

## Accessibility & Inclusion

- Alvo **WCAG 2.1 AA** em texto, contraste e foco visível.
- Suporte a `prefers-reduced-motion` em animações não essenciais (botões Framer podem respeitar reduced motion).
- Labels e `aria-*` em formulários CMS, uploads e dialogs de anexo.
- Conteúdo em português; hierarquia de heading semântica nas páginas públicas.
