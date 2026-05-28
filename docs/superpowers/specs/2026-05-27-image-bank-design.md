# Banco de imagens categorizado para posts automáticos

**Data:** 2026-05-27  
**Status:** Aprovado (brainstorming)  
**Abordagem:** Tabelas dedicadas `image_bank_*` + seed semanal + picker com cooldown de 45 dias  
**Integração:** Cron `daily-posts` — banco local → stock ao vivo → Gemini por último

---

## Contexto

O EdaShow gera **5 rascunhos/dia** via `GET /api/cron/daily-posts`, com temas de `health-insurance-keywords`. A capa segue hoje: **Gemini (OpenRouter)** → fallback **Pexels** ao vivo, com upload para Supabase Storage (`media` bucket) e URL em `posts.cover_image_url`.

Não existe pool pré-populado: cada execução depende de APIs e de geração IA, o que aumenta latência, custo e falhas (posts sem capa não entram no WhatsApp).

**Objetivo:** Script + cron que populam um **banco local** de imagens de saúde/planos de saúde, categorizadas por taxonomia **visual** (independente das categorias editoriais do CMS), para o agente escolher capas com contexto. Reabastecimento semanal; repetição da mesma imagem só após **45 dias**.

---

## Decisões de produto (fechadas)

| Tema | Decisão |
|------|---------|
| Armazenamento | Cópia completa no Supabase Storage + metadados no Postgres |
| Categorias | Taxonomia visual própria (~15 slugs), não espelha `categories` do CMS |
| Categorização no seed | Regras: queries fixas Pexels/Unsplash por categoria (sem IA de visão) |
| Escala inicial | ~150–300 imagens (~10–20 por categoria; alvo ~15×15 = 225) |
| Fontes | Pexels + Unsplash (dedupe por `provider` + `provider_image_id`) |
| Ordem da capa no cron diário | 1) Banco → 2) Stock ao vivo → 3) Gemini (último) |
| Reabastecimento | Cron semanal + CLI manual |
| Repetição | `last_used_at`; mesma imagem elegível de novo após **45 dias** |

---

## Arquitetura

**Abordagem aprovada (1):** Tabelas `image_bank_categories` e `image_bank_assets` separadas de `media` (uploads manuais do CMS).

```
┌─────────────────────────┐     semanal       ┌─────────────────────────┐
│ GET /api/cron/          │ ────────────────► │ Pexels + Unsplash       │
│     seed-image-bank     │                   │ (queries por categoria) │
└─────────────────────────┘                   └───────────┬─────────────┘
         │ download + dedupe                              │
         ▼                                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Postgres: image_bank_categories, image_bank_assets                   │
│ Storage:  {bucket}/image-bank/{category_slug}/{uuid}.jpg             │
└──────────────────────────────────────────────────────────────────────┘
         ▲
         │ 5×/dia
┌─────────────────────────┐
│ GET /api/cron/daily-posts│
└─────────────────────────┘
  keyword → categoria visual → pick asset → senão stock → senão Gemini
```

**Não adotar:** estender `media` com flags de pool (mistura CMS/automação); manifesto JSON-only sem tabela de uso.

---

## 1. Modelo de dados

### 1.1 Migration `image_bank`

```sql
CREATE TABLE public.image_bank_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  search_queries JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.image_bank_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.image_bank_categories(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('pexels', 'unsplash')),
  provider_image_id TEXT NOT NULL,
  attribution_text TEXT,
  attribution_url TEXT,
  width INT,
  height INT,
  alt_text TEXT,
  last_used_at TIMESTAMPTZ,
  use_count INT NOT NULL DEFAULT 0,
  seeded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_image_id)
);

CREATE INDEX idx_image_bank_assets_category ON public.image_bank_assets(category_id);
CREATE INDEX idx_image_bank_assets_last_used ON public.image_bank_assets(last_used_at NULLS FIRST);
CREATE INDEX idx_image_bank_assets_pick ON public.image_bank_assets(category_id, last_used_at);
```

**RLS:** Leitura pública não necessária para assets do pool (só service role no cron/scripts). Políticas: service role full access; anon sem acesso (igual padrão admin do projeto).

**Seed de categorias:** Inserir as 15 linhas na migration ou em script idempotente logo após `CREATE`.

### 1.2 Taxonomia visual inicial

| slug | name (PT) | search_queries (exemplos EN para APIs) |
|------|-----------|------------------------------------------|
| `familia` | Família e saúde | `family health insurance`, `happy family doctor` |
| `hospital` | Hospital | `modern hospital healthcare`, `hospital corridor` |
| `consulta-medica` | Consulta médica | `doctor patient consultation`, `medical appointment` |
| `idosos` | Idosos | `elderly healthcare`, `senior medical care` |
| `maternidade` | Maternidade | `pregnancy maternity healthcare`, `mother baby hospital` |
| `odontologia` | Odontologia | `dental clinic`, `dentist patient` |
| `farmacia` | Farmácia | `pharmacy medicine`, `pharmacist healthcare` |
| `documentos` | Documentos e contratos | `health insurance documents`, `signing medical contract` |
| `empresarial` | Corporativo | `corporate health benefits`, `office wellness` |
| `telemedicina` | Telemedicina | `telemedicine`, `doctor video call healthcare` |
| `emergencia` | Emergência | `ambulance emergency`, `emergency room` |
| `bem-estar` | Bem-estar | `wellness healthy lifestyle`, `preventive health` |
| `saude-mental` | Saúde mental | `mental health therapy`, `psychologist session` |
| `custo-economia` | Custo e economia | `healthcare budget`, `saving money medical` |
| `exames` | Exames | `medical laboratory test`, `blood test clinic` |

**Meta por categoria:** 15 imagens no steady state (mínimo operacional 12 antes do cron semanal reabastecer).

**Split provedor:** Alternar Pexels e Unsplash por página de resultados; meta ~50/50 ao longo do seed.

### 1.3 Storage

- **Bucket:** `SUPABASE_BUCKET` (default `media`)
- **Path:** `image-bank/{category_slug}/{uuid}.jpg` (ou extensão real do arquivo)
- **Upload:** Reutilizar `downloadAndSaveImage()` de `lib/images/image-service.ts` onde possível
- **URL pública:** Gravar em `image_bank_assets.public_url`; posts continuam usando `cover_image_url` string

---

## 2. Módulos de aplicação

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/images/image-bank-config.ts` | Constantes: categorias, queries, `IMAGE_BANK_COOLDOWN_DAYS=45`, `IMAGE_BANK_MIN_PER_CATEGORY=12`, `IMAGE_BANK_TARGET_PER_CATEGORY=15` |
| `lib/images/image-bank-seed.ts` | Buscar Pexels/Unsplash, dedupe, download, insert; retorno `{ inserted, skipped, errors }` |
| `lib/images/image-bank-picker.ts` | `pickImageForKeyword(keyword): Promise<{ url, assetId } \| null>` com regra de cooldown |
| `lib/images/keyword-to-visual-category.ts` | Regras regex/substring PT → `slug` da categoria visual |
| `scripts/seed-image-bank.ts` | CLI: `npm run seed:image-bank` com flags `--dry-run`, `--category=slug` |
| `app/api/cron/seed-image-bank/route.ts` | Cron semanal protegido por `CRON_SECRET` |
| `app/api/cron/daily-posts/route.ts` | Inserir passo 1 (banco) antes de stock/Gemini; Gemini por último |

### 2.1 Regras `keyword → categoria visual`

Primeiro match vence (ordem importa). Exemplos:

| Padrão (case insensitive) | Categoria |
|---------------------------|-----------|
| `odont`, `dental`, `dentista` | `odontologia` |
| `maternidade`, `parto`, `bebê`, `bebe`, `gestante` | `maternidade` |
| `empresarial`, `mei`, `coletivo`, `corporativ` | `empresarial` |
| `psicolog`, `mental`, `terapia` | `saude-mental` |
| `hospital`, `internação`, `internacao` | `hospital` |
| `idoso`, `terceira idade`, `senior` | `idosos` |
| `telemedicina`, `online`, `digital` | `telemedicina` |
| `emergência`, `emergencia`, `ambulância` | `emergencia` |
| `exame`, `laborat`, `ressonância`, `tomografia` | `exames` |
| `cancelar`, `contrato`, `document`, `burocrac` | `documentos` |
| `barato`, `economia`, `custo`, `preço`, `preco` | `custo-economia` |
| `família`, `familia`, `familiar` | `familia` |
| `farmácia`, `farmacia`, `remédio`, `remedio` | `farmacia` |
| default | `bem-estar` |

### 2.2 Picker (cooldown 45 dias)

Asset **elegível** se:

- `last_used_at IS NULL`, ou
- `last_used_at < now() - interval '45 days'`

**Ordenação:** `last_used_at ASC NULLS FIRST`, depois `random()` ou `seeded_at ASC` para variedade.

**Ao usar:** `UPDATE` `last_used_at = now()`, `use_count = use_count + 1`.

**Sem elegível na categoria:** retornar `null` → cron diário cai para stock ao vivo.

### 2.3 Seed semanal

1. Para cada `image_bank_categories` com `active = true`:
2. Contar assets na categoria (todos, não só elegíveis).
3. Se `count < IMAGE_BANK_MIN_PER_CATEGORY` (12): buscar até `IMAGE_BANK_TARGET_PER_CATEGORY` (15).
4. Para cada query em `search_queries`: chamar Pexels e Unsplash com paginação limitada.
5. Ignorar se `(provider, provider_image_id)` já existe.
6. Baixar, upload Storage, insert row com atribuição obrigatória do provedor.
7. Log estruturado por categoria.

**Rate limits:** backoff exponencial (ex. 1s, 2s, 4s) em 429; continuar próxima categoria em erro fatal isolado.

---

## 3. Cron e CLI

### 3.1 `vercel.json`

```json
{
  "path": "/api/cron/seed-image-bank",
  "schedule": "0 6 * * 0"
}
```

Domingo 06:00 UTC (ajustável). Mesmo padrão de auth que `daily-posts`: header `Authorization: Bearer ${CRON_SECRET}`.

### 3.2 `package.json`

```json
"seed:image-bank": "tsx scripts/seed-image-bank.ts"
```

### 3.3 Fluxo `daily-posts` (capa)

Por post gerado:

1. `pickImageForKeyword(keyword)` → se URL, setar `cover_image_url`, marcar uso no asset, `imageSource: 'image-bank'`.
2. Senão: `getAICoverSuggestions` + `selectAICoverImage` (Pexels ao vivo) → `imageSource: 'stock'`.
3. Senão: `generateAICoverImage` (Gemini) → `imageSource: 'gemini'`.
4. Senão: post sem capa (comportamento atual).

---

## 4. Atribuição e licença

| Provedor | Obrigatório |
|----------|-------------|
| Pexels | `attribution_text` / link do fotógrafo quando API retornar |
| Unsplash | UTM + crédito conforme [Unsplash API Guidelines](https://unsplash.com/api) |

Campos persistidos para auditoria; exibição no site da capa do post não exige UI nova neste escopo.

---

## 5. Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `PEXELS_API_KEY` | Seed + stock ao vivo |
| `UNSPLASH_ACCESS_KEY` | Seed + stock ao vivo |
| `SUPABASE_SERVICE_ROLE_KEY` | Insert/update assets |
| `SUPABASE_BUCKET` | Upload path |
| `CRON_SECRET` | Crons seed e daily |
| `IMAGE_BANK_COOLDOWN_DAYS` | Opcional; default `45` |
| `IMAGE_BANK_MIN_PER_CATEGORY` | Opcional; default `12` |
| `IMAGE_BANK_TARGET_PER_CATEGORY` | Opcional; default `15` |

---

## 6. Erros e observabilidade

| Cenário | Comportamento |
|---------|----------------|
| Chave API ausente | Seed loga erro; provedor omitido; picker/stock usam o disponível |
| Download falha | Não insere row; tenta próxima imagem |
| Categoria abaixo do mínimo após seed | Log warning; daily usa fallback stock/Gemini |
| Duplicata cross-provider | Mesmo `provider_image_id` só dentro do mesmo provider; hash perceptual fora de escopo v1 |

Logs prefixo `[IMAGE-BANK]` / `[IMAGE-BANK-SEED]`.

---

## 7. Testes

| Tipo | Escopo |
|------|--------|
| Unit | `keyword-to-visual-category` — casos PT, default `bem-estar` |
| Unit | `image-bank-picker` — elegibilidade 45d, ordenação, incremento `use_count` |
| Unit | dedupe — segundo insert mesmo `provider`+`id` ignorado |
| Integração (opcional) | seed `--dry-run` não grava Storage |
| Manual | `npm run seed:image-bank -- --category=hospital`; rodar daily-posts em staging |

---

## 8. Fora de escopo (v1)

- IA para classificar imagens ou gerar tags
- UI CMS para browse do banco
- Mapeamento 1:1 com `categories` editoriais
- Deduplicação perceptual (hash de imagem) entre Pexels e Unsplash
- CDN separado do bucket Supabase existente

---

## 9. Critérios de sucesso

1. Após seed manual ou primeiro cron semanal: ≥150 assets no banco, ≥10 por categoria ativa.
2. `daily-posts` usa capa do banco na maioria dos posts quando há assets elegíveis na categoria mapeada.
3. Mesma `image_bank_assets.id` não é escolhida duas vezes dentro de 45 dias (exceto se pool esgotado e fallback permitir — nesse caso stock/Gemini, não reuso forçado do banco).
4. Gemini só é chamado quando banco e stock ao vivo falham.
5. Atribuição Pexels/Unsplash armazenada em ≥95% dos assets inseridos.

---

## Referências no codebase

- `app/api/cron/daily-posts/route.ts` — agente diário
- `lib/actions/ai-images.ts` — capa IA + stock
- `lib/images/image-service.ts`, `pexels.ts`, `unsplash.ts` — provedores
- `lib/constants/health-insurance-keywords.ts` — temas dos posts
- `supabase/migrations/20240101000000_baseline_edashow_core.sql` — `posts`, `media`
