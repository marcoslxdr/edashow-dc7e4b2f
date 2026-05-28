# Banco de imagens categorizado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Popular e manter um banco local de capas de stock (Pexels + Unsplash) categorizadas por taxonomia visual, com picker de cooldown 45 dias, integrado ao cron diário antes de stock ao vivo e Gemini.

**Architecture:** Tabelas dedicadas `image_bank_*`, assets no bucket `media/image-bank/{slug}/`, seed via `lib/images/image-bank-seed.ts` (CLI + cron semanal), seleção via `pickImageForKeyword` mapeando `health-insurance-keywords` → categoria visual.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Postgres + Storage, Pexels/Unsplash clients existentes (`lib/images/`), `tsx` scripts, Node `node:test` para unit tests leves.

**Spec:** `docs/superpowers/specs/2026-05-27-image-bank-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260527_image_bank.sql` | Tabelas + seed 15 categorias |
| `lib/images/image-bank-config.ts` | Constantes, tipos, lista de categorias |
| `lib/images/keyword-to-visual-category.ts` | Regras keyword → slug |
| `lib/images/image-bank-eligibility.ts` | Pure helpers cooldown (testável) |
| `lib/images/image-bank-picker.ts` | Query Supabase + mark used |
| `lib/images/image-bank-seed.ts` | Busca APIs, download, insert |
| `lib/images/__tests__/keyword-to-visual-category.test.ts` | Unit tests keyword map |
| `lib/images/__tests__/image-bank-eligibility.test.ts` | Unit tests cooldown |
| `scripts/seed-image-bank.ts` | CLI manual |
| `app/api/cron/seed-image-bank/route.ts` | Cron semanal |
| `app/api/cron/daily-posts/route.ts` | Ordem capa: banco → stock → Gemini |
| `vercel.json` | Novo cron domingo 06:00 UTC |
| `package.json` | Scripts `seed:image-bank`, `test:image-bank` |
| `.env.example` | Vars opcionais do banco |

---

### Task 1: Migration e categorias iniciais

**Files:**
- Create: `supabase/migrations/20260527_image_bank.sql`

- [ ] **Step 1: Criar migration completa**

```sql
-- image bank for automated post covers
CREATE TABLE IF NOT EXISTS public.image_bank_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  search_queries JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.image_bank_assets (
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

CREATE INDEX IF NOT EXISTS idx_image_bank_assets_category
  ON public.image_bank_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_assets_last_used
  ON public.image_bank_assets(last_used_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_image_bank_assets_pick
  ON public.image_bank_assets(category_id, last_used_at);

ALTER TABLE public.image_bank_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_bank_assets ENABLE ROW LEVEL SECURITY;

-- service role only (cron/scripts use createAdminClient)
CREATE POLICY image_bank_categories_service ON public.image_bank_categories
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY image_bank_assets_service ON public.image_bank_assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.image_bank_categories (slug, name, search_queries, display_order) VALUES
  ('familia', 'Família e saúde', '["family health insurance","happy family doctor"]'::jsonb, 1),
  ('hospital', 'Hospital', '["modern hospital healthcare","hospital corridor"]'::jsonb, 2),
  ('consulta-medica', 'Consulta médica', '["doctor patient consultation","medical appointment"]'::jsonb, 3),
  ('idosos', 'Idosos', '["elderly healthcare","senior medical care"]'::jsonb, 4),
  ('maternidade', 'Maternidade', '["pregnancy maternity healthcare","mother baby hospital"]'::jsonb, 5),
  ('odontologia', 'Odontologia', '["dental clinic","dentist patient"]'::jsonb, 6),
  ('farmacia', 'Farmácia', '["pharmacy medicine","pharmacist healthcare"]'::jsonb, 7),
  ('documentos', 'Documentos e contratos', '["health insurance documents","signing medical contract"]'::jsonb, 8),
  ('empresarial', 'Corporativo', '["corporate health benefits","office wellness"]'::jsonb, 9),
  ('telemedicina', 'Telemedicina', '["telemedicine","doctor video call healthcare"]'::jsonb, 10),
  ('emergencia', 'Emergência', '["ambulance emergency","emergency room"]'::jsonb, 11),
  ('bem-estar', 'Bem-estar', '["wellness healthy lifestyle","preventive health"]'::jsonb, 12),
  ('saude-mental', 'Saúde mental', '["mental health therapy","psychologist session"]'::jsonb, 13),
  ('custo-economia', 'Custo e economia', '["healthcare budget","saving money medical"]'::jsonb, 14),
  ('exames', 'Exames', '["medical laboratory test","blood test clinic"]'::jsonb, 15)
ON CONFLICT (slug) DO NOTHING;
```

- [ ] **Step 2: Aplicar migration**

```bash
cd /Volumes/SSDdoMarcos/Projetos/edashow-dc7e4b2f
# Opção A — Supabase CLI:
supabase db push
# Opção B — SQL Editor no dashboard Supabase (produção)
```

Expected: `image_bank_categories` com 15 linhas; `image_bank_assets` vazia.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527_image_bank.sql
git commit -m "feat(db): add image bank tables and seed categories"
```

---

### Task 2: Config e tipos

**Files:**
- Create: `lib/images/image-bank-config.ts`

- [ ] **Step 1: Criar arquivo de config**

```typescript
export const IMAGE_BANK_COOLDOWN_DAYS = Number(process.env.IMAGE_BANK_COOLDOWN_DAYS ?? 45)
export const IMAGE_BANK_MIN_PER_CATEGORY = Number(process.env.IMAGE_BANK_MIN_PER_CATEGORY ?? 12)
export const IMAGE_BANK_TARGET_PER_CATEGORY = Number(process.env.IMAGE_BANK_TARGET_PER_CATEGORY ?? 15)
export const IMAGE_BANK_STORAGE_PREFIX = 'image-bank'

export type ImageBankProvider = 'pexels' | 'unsplash'

export interface ImageBankCategoryRow {
  id: string
  slug: string
  name: string
  search_queries: string[]
  display_order: number
  active: boolean
}

export interface ImageBankAssetRow {
  id: string
  category_id: string
  storage_path: string
  public_url: string
  provider: ImageBankProvider
  provider_image_id: string
  attribution_text: string | null
  attribution_url: string | null
  width: number | null
  height: number | null
  alt_text: string | null
  last_used_at: string | null
  use_count: number
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/images/image-bank-config.ts
git commit -m "feat(images): add image bank configuration constants"
```

---

### Task 3: Mapeamento keyword → categoria visual

**Files:**
- Create: `lib/images/keyword-to-visual-category.ts`
- Create: `lib/images/__tests__/keyword-to-visual-category.test.ts`

- [ ] **Step 1: Implementar regras (ordem importa)**

```typescript
export interface KeywordCategoryRule {
  pattern: RegExp
  slug: string
}

export const KEYWORD_CATEGORY_RULES: KeywordCategoryRule[] = [
  { pattern: /odont|dental|dentista/i, slug: 'odontologia' },
  { pattern: /maternidade|parto|beb[eê]|gestante/i, slug: 'maternidade' },
  { pattern: /empresarial|mei|coletivo|corporativ/i, slug: 'empresarial' },
  { pattern: /psicolog|mental|terapia/i, slug: 'saude-mental' },
  { pattern: /hospital|interna[cç][aã]o/i, slug: 'hospital' },
  { pattern: /idoso|terceira idade|senior/i, slug: 'idosos' },
  { pattern: /telemedicina|consulta online|digital/i, slug: 'telemedicina' },
  { pattern: /emerg[eê]ncia|ambul[aâ]ncia/i, slug: 'emergencia' },
  { pattern: /exame|laborat|resson[aâ]ncia|tomografia/i, slug: 'exames' },
  { pattern: /cancelar|contrato|document|burocrac/i, slug: 'documentos' },
  { pattern: /barato|economia|custo|pre[cç]o/i, slug: 'custo-economia' },
  { pattern: /fam[ií]lia|familiar/i, slug: 'familia' },
  { pattern: /farm[aá]cia|rem[eé]dio/i, slug: 'farmacia' },
  { pattern: /consulta|m[eé]dico|cl[ií]nica/i, slug: 'consulta-medica' },
]

export const DEFAULT_VISUAL_CATEGORY_SLUG = 'bem-estar'

export function keywordToVisualCategorySlug(keyword: string): string {
  const normalized = keyword.trim()
  for (const rule of KEYWORD_CATEGORY_RULES) {
    if (rule.pattern.test(normalized)) return rule.slug
  }
  return DEFAULT_VISUAL_CATEGORY_SLUG
}
```

- [ ] **Step 2: Escrever testes**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keywordToVisualCategorySlug } from '../keyword-to-visual-category'

test('maps odontologia', () => {
  assert.equal(keywordToVisualCategorySlug('plano odontológico'), 'odontologia')
})

test('maps maternidade', () => {
  assert.equal(keywordToVisualCategorySlug('cobertura de parto plano de saúde'), 'maternidade')
})

test('default bem-estar', () => {
  assert.equal(keywordToVisualCategorySlug('plano de saúde referência'), 'bem-estar')
})

test('maps exames', () => {
  assert.equal(keywordToVisualCategorySlug('cobertura de ressonância magnética'), 'exames')
})
```

- [ ] **Step 3: Rodar testes**

```bash
npm run test:image-bank
```

(Adicionar script na Task 8; até lá: `npx tsx --test lib/images/__tests__/keyword-to-visual-category.test.ts`)

Expected: 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/images/keyword-to-visual-category.ts lib/images/__tests__/keyword-to-visual-category.test.ts
git commit -m "feat(images): map post keywords to visual image bank categories"
```

---

### Task 4: Helpers de elegibilidade (cooldown)

**Files:**
- Create: `lib/images/image-bank-eligibility.ts`
- Create: `lib/images/__tests__/image-bank-eligibility.test.ts`

- [ ] **Step 1: Funções puras**

```typescript
import { IMAGE_BANK_COOLDOWN_DAYS } from './image-bank-config'

export function isAssetEligible(
  lastUsedAt: Date | null,
  now: Date,
  cooldownDays: number = IMAGE_BANK_COOLDOWN_DAYS
): boolean {
  if (!lastUsedAt) return true
  const ms = cooldownDays * 24 * 60 * 60 * 1000
  return now.getTime() - lastUsedAt.getTime() >= ms
}

export function comparePickPriority(
  a: { last_used_at: string | null },
  b: { last_used_at: string | null }
): number {
  if (!a.last_used_at && !b.last_used_at) return 0
  if (!a.last_used_at) return -1
  if (!b.last_used_at) return 1
  return new Date(a.last_used_at).getTime() - new Date(b.last_used_at).getTime()
}
```

- [ ] **Step 2: Testes**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAssetEligible } from '../image-bank-eligibility'

test('never used is eligible', () => {
  assert.equal(isAssetEligible(null, new Date('2026-05-27'), 45), true)
})

test('used 44 days ago is not eligible', () => {
  const now = new Date('2026-05-27')
  const last = new Date('2026-04-14') // 43 days — adjust if needed
  assert.equal(isAssetEligible(last, now, 45), false)
})

test('used 46 days ago is eligible', () => {
  const now = new Date('2026-05-27')
  const last = new Date('2026-04-10')
  assert.equal(isAssetEligible(last, now, 45), true)
})
```

- [ ] **Step 3: Run + commit**

```bash
npx tsx --test lib/images/__tests__/image-bank-eligibility.test.ts
git add lib/images/image-bank-eligibility.ts lib/images/__tests__/image-bank-eligibility.test.ts
git commit -m "feat(images): add image bank cooldown eligibility helpers"
```

---

### Task 5: Picker (seleção + mark used)

**Files:**
- Create: `lib/images/image-bank-picker.ts`

- [ ] **Step 1: Implementar picker**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { keywordToVisualCategorySlug } from './keyword-to-visual-category'
import { isAssetEligible } from './image-bank-eligibility'
import type { ImageBankAssetRow } from './image-bank-config'

export interface PickedImageBankAsset {
  assetId: string
  publicUrl: string
  categorySlug: string
  provider: 'pexels' | 'unsplash'
}

export async function pickImageForKeyword(keyword: string): Promise<PickedImageBankAsset | null> {
  const categorySlug = keywordToVisualCategorySlug(keyword)
  const supabase = createAdminClient()
  const now = new Date()

  const { data: category, error: catError } = await supabase
    .from('image_bank_categories')
    .select('id, slug')
    .eq('slug', categorySlug)
    .eq('active', true)
    .maybeSingle()

  if (catError || !category) {
    console.warn('[IMAGE-BANK] category not found:', categorySlug, catError?.message)
    return null
  }

  const { data: assets, error: assetsError } = await supabase
    .from('image_bank_assets')
    .select('id, public_url, provider, last_used_at, use_count, seeded_at')
    .eq('category_id', category.id)

  if (assetsError || !assets?.length) {
    console.warn('[IMAGE-BANK] no assets for category:', categorySlug)
    return null
  }

  const eligible = (assets as ImageBankAssetRow[])
    .filter((a) => isAssetEligible(a.last_used_at ? new Date(a.last_used_at) : null, now))

  if (!eligible.length) {
    console.warn('[IMAGE-BANK] pool exhausted (cooldown) for:', categorySlug)
    return null
  }

  eligible.sort((a, b) => {
    const aTime = a.last_used_at ? new Date(a.last_used_at).getTime() : 0
    const bTime = b.last_used_at ? new Date(b.last_used_at).getTime() : 0
    if (aTime !== bTime) return aTime - bTime
    return new Date(a.seeded_at).getTime() - new Date(b.seeded_at).getTime()
  })

  const pick = eligible[Math.floor(Math.random() * Math.min(3, eligible.length))]

  const { error: updateError } = await supabase
    .from('image_bank_assets')
    .update({
      last_used_at: now.toISOString(),
      use_count: (pick.use_count ?? 0) + 1,
    })
    .eq('id', pick.id)

  if (updateError) {
    console.error('[IMAGE-BANK] failed to mark used:', updateError.message)
    return null
  }

  return {
    assetId: pick.id,
    publicUrl: pick.public_url,
    categorySlug: category.slug,
    provider: pick.provider,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/images/image-bank-picker.ts
git commit -m "feat(images): pick categorized cover from local image bank"
```

---

### Task 6: Seed (busca + download + insert)

**Files:**
- Create: `lib/images/image-bank-seed.ts`

- [ ] **Step 1: Tipos de resultado**

```typescript
export interface ImageBankSeedResult {
  categorySlug: string
  inserted: number
  skipped: number
  errors: string[]
}
```

- [ ] **Step 2: Implementar `seedImageBank`**

Lógica principal em `lib/images/image-bank-seed.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { searchImages, downloadAndSaveImage, type NormalizedImage } from './image-service'
import {
  IMAGE_BANK_MIN_PER_CATEGORY,
  IMAGE_BANK_TARGET_PER_CATEGORY,
  IMAGE_BANK_STORAGE_PREFIX,
  type ImageBankCategoryRow,
} from './image-bank-config'

export interface SeedImageBankOptions {
  dryRun?: boolean
  categorySlug?: string
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function assetExists(provider: string, providerImageId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('image_bank_assets')
    .select('id')
    .eq('provider', provider)
    .eq('provider_image_id', providerImageId)
    .maybeSingle()
  return !!data
}

export async function seedImageBank(options: SeedImageBankOptions = {}): Promise<ImageBankSeedResult[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('image_bank_categories')
    .select('*')
    .eq('active', true)
    .order('display_order')

  if (options.categorySlug) query = query.eq('slug', options.categorySlug)

  const { data: categories, error } = await query
  if (error || !categories?.length) throw new Error(error?.message || 'No categories')

  const results: ImageBankSeedResult[] = []

  for (const cat of categories as ImageBankCategoryRow[]) {
    const result: ImageBankSeedResult = {
      categorySlug: cat.slug,
      inserted: 0,
      skipped: 0,
      errors: [],
    }

    const { count } = await supabase
      .from('image_bank_assets')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', cat.id)

    const currentCount = count ?? 0
    if (currentCount >= IMAGE_BANK_TARGET_PER_CATEGORY) {
      results.push(result)
      continue
    }

    const needed = IMAGE_BANK_TARGET_PER_CATEGORY - currentCount
    const queries = Array.isArray(cat.search_queries) ? cat.search_queries : []

    for (const q of queries) {
      if (result.inserted >= needed) break

      for (const provider of ['pexels', 'unsplash'] as const) {
        if (result.inserted >= needed) break
        try {
          const search = await searchImages({
            query: q,
            provider,
            orientation: 'landscape',
            perPage: 10,
            page: 1,
          })

          for (const img of search.images) {
            if (result.inserted >= needed) break
            const providerId = img.id.replace(/^(pexels|unsplash)-/, '')
            if (await assetExists(img.provider, providerId)) {
              result.skipped++
              continue
            }

            if (options.dryRun) {
              result.inserted++
              continue
            }

            const folder = `${IMAGE_BANK_STORAGE_PREFIX}/${cat.slug}`
            const publicUrl = await downloadAndSaveImage(img, folder)

            const { data: uploadedPath } = await supabase.storage
              .from(process.env.SUPABASE_BUCKET || 'media')
              .list(folder)

            const storagePath = `${folder}/${publicUrl.split('/').pop()}`

            const { error: insertError } = await supabase.from('image_bank_assets').insert({
              category_id: cat.id,
              storage_path: storagePath,
              public_url: publicUrl,
              provider: img.provider,
              provider_image_id: providerId,
              attribution_text: img.photographer ?? null,
              attribution_url: img.photographerUrl ?? null,
              width: img.width,
              height: img.height,
              alt_text: img.alt || q,
            })

            if (insertError) {
              result.errors.push(insertError.message)
            } else {
              result.inserted++
            }

            await sleep(350)
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.includes('429')) await sleep(2000)
          result.errors.push(`${provider}/${q}: ${msg}`)
        }
      }
    }

    console.log(
      `[IMAGE-BANK-SEED] ${cat.slug}: +${result.inserted} skip=${result.skipped} err=${result.errors.length}`
    )
    results.push(result)
  }

  return results
}
```

**Nota:** Ajustar `storage_path` após `downloadAndSaveImage` — alterar `downloadAndSaveImage` para retornar `{ publicUrl, storagePath }` OU derivar path do retorno. Opção mínima: em `image-bank-seed.ts`, passar folder e reconstruir:

```typescript
const timestamp = Date.now()
const safeId = img.id.replace(/[^a-z0-9]/gi, '-')
const storagePath = `${folder}/${timestamp}-${safeId}.jpg`
```

Refatorar chamada para upload com path fixo se `downloadAndSaveImage` não aceitar path custom — ver implementação em `image-service.ts:152-199` e duplicar upload mínimo só para `image-bank` se necessário (YAGNI: estender `downloadAndSaveImage` com param opcional `filename?: string`).

- [ ] **Step 3: Estender `downloadAndSaveImage` (opcional mas recomendado)**

Modify: `lib/images/image-service.ts`

Adicionar parâmetro opcional:

```typescript
export async function downloadAndSaveImage(
  image: NormalizedImage,
  folder: string = 'posts',
  filename?: string
): Promise<{ publicUrl: string; storagePath: string }> {
  // ... existing download ...
  const finalName = filename ?? `${Date.now()}-${image.id.replace(/[^a-z0-9]/gi, '-')}.${extension}`
  const storagePath = `${folder}/${finalName}`
  // upload using storagePath
  return { publicUrl: publicUrl.publicUrl, storagePath }
}
```

Atualizar call sites existentes para usar `.publicUrl` se mudar retorno de `string` → objeto (grep `downloadAndSaveImage` e ajustar).

- [ ] **Step 4: Commit**

```bash
git add lib/images/image-bank-seed.ts lib/images/image-service.ts
git commit -m "feat(images): seed image bank from Pexels and Unsplash"
```

---

### Task 7: CLI script

**Files:**
- Create: `scripts/seed-image-bank.ts`

- [ ] **Step 1: CLI**

```typescript
import 'dotenv/config'
import { seedImageBank } from '../lib/images/image-bank-seed'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const categoryArg = args.find((a) => a.startsWith('--category='))
  const categorySlug = categoryArg?.split('=')[1]

  console.log('[IMAGE-BANK-SEED] starting', { dryRun, categorySlug })
  const results = await seedImageBank({ dryRun, categorySlug })
  console.log(JSON.stringify(results, null, 2))
  const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
  process.exit(totalInserted > 0 || dryRun ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Teste manual dry-run**

```bash
npm run seed:image-bank -- --dry-run --category=hospital
```

Expected: JSON com `inserted` simulado, sem rows novas no DB.

- [ ] **Step 3: Seed real (staging) uma categoria**

```bash
npm run seed:image-bank -- --category=hospital
```

Expected: até 15 assets em `image_bank_assets` para slug `hospital`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-image-bank.ts
git commit -m "chore(scripts): add image bank seed CLI"
```

---

### Task 8: Cron semanal + package.json + vercel.json

**Files:**
- Create: `app/api/cron/seed-image-bank/route.ts`
- Modify: `vercel.json`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Rota cron**

```typescript
import { NextResponse } from 'next/server'
import { seedImageBank } from '@/lib/images/image-bank-seed'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[IMAGE-BANK-SEED] cron started')
  const results = await seedImageBank()
  const summary = {
    categories: results.length,
    inserted: results.reduce((s, r) => s + r.inserted, 0),
    skipped: results.reduce((s, r) => s + r.skipped, 0),
    errors: results.flatMap((r) => r.errors),
    timestamp: new Date().toISOString(),
  }
  console.log('[IMAGE-BANK-SEED] cron done', summary)
  return NextResponse.json({ success: true, results, summary })
}
```

- [ ] **Step 2: vercel.json**

```json
"crons": [
  {
    "path": "/api/cron/daily-posts",
    "schedule": "0 11 * * *"
  },
  {
    "path": "/api/cron/seed-image-bank",
    "schedule": "0 6 * * 0"
  }
]
```

- [ ] **Step 3: package.json scripts**

```json
"seed:image-bank": "tsx scripts/seed-image-bank.ts",
"test:image-bank": "tsx --test lib/images/__tests__/keyword-to-visual-category.test.ts lib/images/__tests__/image-bank-eligibility.test.ts"
```

- [ ] **Step 4: .env.example**

```
# Image bank (optional overrides)
IMAGE_BANK_COOLDOWN_DAYS=45
IMAGE_BANK_MIN_PER_CATEGORY=12
IMAGE_BANK_TARGET_PER_CATEGORY=15
```

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/seed-image-bank/route.ts vercel.json package.json .env.example
git commit -m "feat(cron): weekly image bank seed job"
```

---

### Task 9: Integrar no daily-posts (banco → stock → Gemini)

**Files:**
- Modify: `app/api/cron/daily-posts/route.ts` (função `generateOnePost`, ~linhas 105-153)

- [ ] **Step 1: Import picker**

```typescript
import { pickImageForKeyword } from '@/lib/images/image-bank-picker'
```

- [ ] **Step 2: Substituir bloco de capa**

Remover tentativa Gemini-first. Nova ordem:

```typescript
    let coverImageUrl = ''
    let imageSource = 'none'

    // 1) Local image bank
    console.log(`[DAILY] Trying image bank for keyword: "${keyword}"`)
    try {
      const bankPick = await pickImageForKeyword(keyword)
      if (bankPick?.publicUrl) {
        coverImageUrl = bankPick.publicUrl
        imageSource = 'image-bank'
        console.log(`[DAILY] Image bank: ${bankPick.categorySlug} (${bankPick.provider})`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`[DAILY] Image bank failed: ${msg}`)
    }

    // 2) Live stock (Pexels/Unsplash)
    if (!coverImageUrl) {
      console.log(`[DAILY] Falling back to live stock...`)
      try {
        const imageResult = await getAICoverSuggestions({
          title: post.title,
          content: post.content,
          count: 1,
        })
        if (imageResult.images.length > 0) {
          const saved = await selectAICoverImage(
            imageResult.images[0].url,
            imageResult.images[0].source as 'pexels' | 'unsplash' | 'gemini'
          )
          if (saved.url) {
            coverImageUrl = saved.url
            imageSource = imageResult.images[0].source || 'stock'
            console.log(`[DAILY] Stock image saved`)
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log(`[DAILY] Stock failed: ${msg}`)
      }
    }

    // 3) Gemini last
    if (!coverImageUrl) {
      console.log(`[DAILY] Last resort: Gemini cover...`)
      try {
        const geminiResult = await generateAICoverImage({
          title: post.title,
          content: post.content,
        })
        if (geminiResult.url && !geminiResult.error) {
          coverImageUrl = geminiResult.url
          imageSource = 'gemini'
          console.log(`[DAILY] Gemini cover generated`)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.log(`[DAILY] Gemini failed: ${msg}`)
      }
    }
```

- [ ] **Step 3: Teste local (opcional, 1 keyword)**

```bash
# Com CRON_SECRET e keys configuradas:
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/daily-posts" | jq .
```

Expected: `imageSource` preferencialmente `image-bank` após seed completo.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/daily-posts/route.ts
git commit -m "feat(cron): prefer local image bank over live stock and Gemini"
```

---

### Task 10: Seed inicial completo + verificação

**Files:** (nenhum novo)

- [ ] **Step 1: Rodar seed completo (staging/prod)**

```bash
npm run seed:image-bank
```

Expected: ~225 inserts totais (15 categorias × ~15), logs sem erro massivo de API.

- [ ] **Step 2: Verificar SQL**

```sql
SELECT c.slug, COUNT(a.id) AS assets
FROM image_bank_categories c
LEFT JOIN image_bank_assets a ON a.category_id = c.id
GROUP BY c.slug
ORDER BY c.display_order;
```

Expected: cada slug ≥ 10 assets.

- [ ] **Step 3: Rodar testes**

```bash
npm run test:image-bank
```

Expected: all PASS.

- [ ] **Step 4: Commit doc de verificação (opcional)**

Se ajustes finos no seed, commit separado:

```bash
git commit -m "fix(images): tune image bank seed paths and rate limits"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Tabelas `image_bank_*` | Task 1 |
| 15 categorias visuais | Task 1 migration seed |
| Queries Pexels/Unsplash | Task 6 |
| Storage `image-bank/{slug}/` | Task 6 |
| Cooldown 45 dias | Task 4, 5 |
| Cron semanal | Task 8 |
| CLI manual | Task 7 |
| daily-posts ordem banco→stock→gemini | Task 9 |
| Pexels + Unsplash + dedupe | Task 6 |
| Atribuição campos | Task 6 insert |
| Unit tests keyword + cooldown | Task 3, 4 |

---

## Manual test plan (pós-implementação)

1. `npm run test:image-bank` — verde
2. `npm run seed:image-bank -- --dry-run` — sem side effects
3. Query SQL contagem por categoria ≥ 10
4. `pickImageForKeyword('plano odontológico')` via script temporário ou cron — retorna URL
5. Rodar `daily-posts` — maioria com `imageSource: 'image-bank'`
6. Repetir pick mesma categoria 5× — não repete mesmo `assetId` dentro de 45 dias
7. Vercel cron `seed-image-bank` dispara domingo (verificar logs)
