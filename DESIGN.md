---
name: EDA Show
description: Portal editorial de saúde suplementar com CMS laranja e superfícies claras
colors:
  primary: "#FF6F00"
  primary-hover: "#E66300"
  background: "#FFFFFF"
  foreground: "#1A1A1A"
  muted: "#FAFAFA"
  muted-foreground: "#64748B"
  secondary: "#F5F5F5"
  border: "#E5E5E5"
  destructive: "#DC2626"
  accent-surface: "#FFF7ED"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input-default:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: EDA Show

## 1. Overview

**Creative North Star: "The Editorial Workshop"**

Sistema visual de veículo especializado em saúde suplementar: fundo claro, tipografia Inter única, laranja como único acento saturado. Densidade confortável no CMS; páginas públicas com hierarquia editorial forte (hero, seções, CTA de inscrição). Rejeita aparência de SaaS genérico ou clínica teal.

**Key Characteristics:**

- Tema claro por padrão (escritório / leitura diurna)
- Estratégia de cor **Restrained**: neutros quentes + laranja ≤10% da área visível em telas de produto
- shadcn/ui + Radix: bordas `1px`, radius ~10px, sombras leves só em hover/elevação
- Motion curta (150–200ms, ease-out) para estado, não decoração
- Português BR; copy curta, sem repetir o título na introdução

## 2. Colors

Paleta centrada em laranja editorial sobre neutros quentes, sem preto puro nem branco estéril.

### Primary

- **Signal Orange** (#FF6F00): CTAs primários, step ativo no CMS, links de ação, badges de status "em breve", focus ring.
- **Burnt Orange** (#E66300): hover de botão primário.

### Neutral

- **Ink** (#1A1A1A): texto principal, títulos.
- **Paper** (#FFFFFF): fundo de página e cards CMS.
- **Mist** (#FAFAFA / #F5F5F5): fundos secundários, inputs, sidebar accent.
- **Slate Muted** (#64748B): metadados, labels, placeholders.
- **Hairline** (#E5E5E5): bordas de card, divisores de tabela.

### Semantic

- **Alert Red** (#DC2626): exclusão, erros destrutivos.
- **Warm Wash** (#FFF7ED): fundos de destaque suave (local do evento, avisos âmbar).

**The One Signal Rule.** Laranja aparece em botão primário, indicador de etapa ativa, anel de foco e no máximo um CTA hero por viewport. Se a tela parece "toda laranja", removeu demais do neutro.

## 3. Typography

**Display / Body / Label Font:** Inter (Google Fonts), fallback system-ui.

**Character:** Neutra, legível, confiança de produto editorial. Uma família evita ruído entre CMS e site público.

### Hierarchy

- **Display** (700, clamp 2rem–3.75rem, line-height 1.1): títulos de evento e hero público.
- **Headline** (700, 1.875rem): seções "Sobre o Evento", "Cobertura".
- **Title** (600, 1.25rem): títulos de card, nomes na DataTable CMS.
- **Body** (400, 1rem, line-height 1.6, max 70ch em prose): descrições, artigos.
- **Label** (600, 0.75rem, uppercase tracking): colunas de tabela, tags de status.

**The Single Voice Rule.** Não misturar fonte display decorativa no CMS. Expressividade vem de escala e peso, não de segunda família.

## 4. Elevation

Profundidade por **tom e borda**, não por sombras pesadas. Cards CMS: `border border-gray-200`, fundo branco, `shadow-sm` opcional em hover de linha interativa.

### Shadow Vocabulary

- **Rest** (`none` ou borda apenas): cards de formulário, painéis CMS.
- **Lift** (`0 1px 3px rgba(26,26,26,0.08)`): botão default com `shadow`, dropdown.
- **Overlay** (`0 10px 40px rgba(26,26,26,0.12)`): Dialog de anexo rápido na listagem de eventos.

**The Flat-By-Default Rule.** Sombras só respondem a hover, dialog ou elemento flutuante. Se parece Material Design 2014, a sombra está forte demais.

## 5. Components

### Buttons

- **Shape:** cantos 8–10px (`rounded-md` / `--radius` 0.625rem).
- **Primary:** fundo Signal Orange, texto branco, `font-medium`; hover Burnt Orange; focus ring laranja 3px a 50% opacidade.
- **Outline:** borda Hairline, fundo Paper; hover Mist.
- **Ghost:** sem borda; hover Mist para ações secundárias na tabela.
- **Destructive:** borda/ texto Alert Red em fundo branco no CMS (não bloco vermelho sólido para "Excluir evento").

### Cards / Containers

- **Corner:** 10–16px (`rounded-xl` em painéis CMS).
- **Background:** Paper; sem card dentro de card.
- **Padding:** 24px (`p-6`) em painéis de editor; 16px em células densas.

### Inputs / Fields

- **Style:** borda Hairline, altura ~40px, ícone leading opcional (calendário, pin).
- **Focus:** `ring-2 ring-orange-500` (token `--ring`).
- **Date / URL:** mesma altura que texto para alinhar grid do EventEditor.

### Navigation

- **CMS:** sidebar branca, item ativo com fundo Mist + texto laranja; ícones Lucide 16–20px inline.
- **Público:** header editorial existente; links com hover sublinhado ou cor primária.

### Stepper (Eventos CMS)

- Indicador horizontal: etapa ativa `border-b-2 border-primary text-primary`; bloqueada `text-muted-foreground` + ícone cadeado.
- Sem gradiente no texto do step.

### Photo upload zone

- Borda tracejada 2px Hairline; drag-over: borda primary + fundo Warm Wash.
- Grid de preview 4–6 colunas, thumbs quadradas, botão remover no hover.

## 6. Do's and Don'ts

### Do:

- **Do** usar tokens `primary`, `background`, `foreground`, `border` do `globals.css`.
- **Do** manter CMS previsível: DataTable, Dialog shadcn, toast Sonner para feedback.
- **Do** limitar prose pública a ~70ch.
- **Do** usar empty states com próximo passo ("Salve o evento para anexar fotos").

### Don't:

- **Don't** usar dashboard SaaS genérico, dark roxo, cards idênticos em grid infinito.
- **Don't** usar estética de ferramenta de IA: gradient text, glassmorphism decorativo, neon.
- **Don't** usar healthcare cliché (teal dominante, ícones de hospital).
- **Don't** usar hero-metric template ou bordas laterais coloridas >1px em listas.
- **Don't** animar layout com bounce/elastic; preferir ease-out-quart ~200ms.
- **Don't** esconder galeria/vídeos/posts do evento em rotas separadas sem link claro na página principal.
