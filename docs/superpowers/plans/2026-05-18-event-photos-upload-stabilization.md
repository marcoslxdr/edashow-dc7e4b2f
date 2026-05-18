# Estabilização do upload de fotos de eventos (WebP + marca d’água) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Passos usam checkbox (`- [ ]`) para marcação.

**Goal:** Corrigir o pipeline Sharp (ordem EXIF → resize → composite → WebP), aplicar opacidade da marca conforme spec base, tornar parâmetros configuráveis via env, opcionalmente marcar thumbnails, e adicionar rollback por arquivo + verificação automatizada via script.

**Architecture:** Extrair leitura de config e geração de buffers derivados para `lib/event-photos/*` (funções puras testáveis). `uploadEventPhotos` orquestra validação, leitura da logo, upload no Supabase com lista de paths para remoção em caso de falha parcial **no mesmo arquivo**, e insert no Postgres. Sem fila e sem novas tabelas.

**Tech Stack:** Next.js 15 server actions, Supabase Storage, Sharp 0.34+, `tsx` para script de verificação.

**Spec:** [`docs/superpowers/specs/2026-05-18-event-photos-upload-stabilization-design.md`](../specs/2026-05-18-event-photos-upload-stabilization-design.md)

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/event-photos/config.ts` | Defaults + parse seguro de `process.env` (números, gravity, booleano thumb). |
| `lib/event-photos/process-variants.ts` | `renderPublicWebp`, `renderThumbnailWebp`, helpers internos (logo + opacidade). |
| `lib/actions/cms-event-photos.ts` | Orquestração de upload, rollback por arquivo, mensagem se logo ausente. |
| `scripts/verify-event-photo-processing.ts` | Gera fixture em memória, chama renderers, valida `metadata.format` e larguras. |
| `.env.example` | Documentar variáveis opcionais (comentários). |
| `package.json` | Script `verify:event-photos` → `tsx scripts/verify-event-photo-processing.ts`. |

---

## Política de falha em lote (definida aqui)

- **Atomicidade:** por **arquivo** (não por request inteiro). Cada arquivo: ou conclui (3 objetos no storage + 1 row) ou, em erro após algum upload, o código remove **todos os objetos já enviados desse arquivo** naquele bucket/prefix e relança o erro.
- **Lote:** se o arquivo 1 ok e o 2 falhar, o 1 permanece (comportamento aceitável para CMS; evita transações distribuídas). Documentar no changelog ou comentário curto na action.

---

### Task 1: Config de processamento

**Files:**

- Create: `lib/event-photos/config.ts`
- Modify: (nenhum até Task 4 para `.env.example`)

- [ ] **Step 1.1:** Criar `lib/event-photos/config.ts` com o conteúdo abaixo.

```typescript
import type { Gravity } from 'sharp'

const GRAVITIES: readonly Gravity[] = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'center',
  'centre',
] as const

export type EventPhotoProcessingConfig = {
  publicMaxWidth: number
  thumbWidth: number
  webpQualityPublic: number
  webpQualityThumb: number
  watermarkWidthPercent: number
  watermarkPaddingPx: number
  watermarkGravity: Gravity
  watermarkOpacity: number
  watermarkOnThumbnail: boolean
}

function parseIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < min || n > max) return fallback
  return n
}

function parseFloatEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < min || n > max) return fallback
  return n
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const v = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return fallback
}

function parseGravity(raw: string | undefined, fallback: Gravity): Gravity {
  if (!raw || raw.trim() === '') return fallback
  const g = raw.trim().toLowerCase() as Gravity
  return (GRAVITIES as readonly string[]).includes(g) ? (g as Gravity) : fallback
}

export function getEventPhotoProcessingConfig(): EventPhotoProcessingConfig {
  return {
    publicMaxWidth: parseIntEnv('EVENT_PHOTO_PUBLIC_MAX_WIDTH', 1600, 320, 4096),
    thumbWidth: parseIntEnv('EVENT_PHOTO_THUMB_WIDTH', 400, 80, 2048),
    webpQualityPublic: parseIntEnv('EVENT_PHOTO_WEBP_QUALITY_PUBLIC', 80, 30, 100),
    webpQualityThumb: parseIntEnv('EVENT_PHOTO_WEBP_QUALITY_THUMB', 70, 30, 100),
    watermarkWidthPercent: parseIntEnv('EVENT_PHOTO_WATERMARK_WIDTH_PCT', 12, 1, 50),
    watermarkPaddingPx: parseIntEnv('EVENT_PHOTO_WATERMARK_PADDING_PX', 24, 0, 200),
    watermarkGravity: parseGravity(process.env.EVENT_PHOTO_WATERMARK_GRAVITY, 'southeast'),
    watermarkOpacity: parseFloatEnv('EVENT_PHOTO_WATERMARK_OPACITY', 0.35, 0, 1),
    watermarkOnThumbnail: parseBoolEnv('EVENT_PHOTO_WATERMARK_ON_THUMB', false),
  }
}
```

- [ ] **Step 1.2:** Rodar `npx tsc --noEmit` (ou o comando de typecheck do repo, se houver) e corrigir imports até o arquivo compilar.

**Esperado:** sem erros de tipo; `Gravity` resolvido via `import type` de `sharp`.

---

### Task 2: Renderização Sharp (pública + thumb)

**Files:**

- Create: `lib/event-photos/process-variants.ts`

- [ ] **Step 2.1:** Criar `lib/event-photos/process-variants.ts`.

```typescript
import sharp from 'sharp'
import type { EventPhotoProcessingConfig } from './config'

async function rgbaLogoWithOpacity(
  watermarkPng: Buffer,
  targetImageWidthPx: number,
  config: EventPhotoProcessingConfig,
): Promise<Buffer> {
  const logoWidth = Math.max(
    1,
    Math.round(targetImageWidthPx * (config.watermarkWidthPercent / 100)),
  )

  const { data, info } = await sharp(watermarkPng)
    .resize(logoWidth, null, { withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const opacity = config.watermarkOpacity
  const n = data.length
  for (let i = 0; i < n; i += 4) {
    data[i + 3] = Math.min(255, Math.round(data[i + 3] * opacity))
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer()
}

async function toResizedRgbBuffer(
  originalBuffer: Buffer,
  maxWidth: number,
): Promise<Buffer> {
  return sharp(originalBuffer)
    .rotate()
    .resize(maxWidth, null, { withoutEnlargement: true })
    .toBuffer()
}

export async function renderPublicWebp(
  originalBuffer: Buffer,
  watermarkPng: Buffer,
  config: EventPhotoProcessingConfig,
): Promise<Buffer> {
  const resized = await toResizedRgbBuffer(originalBuffer, config.publicMaxWidth)
  const meta = await sharp(resized).metadata()
  const w = meta.width ?? config.publicMaxWidth
  const logo = await rgbaLogoWithOpacity(watermarkPng, w, config)

  return sharp(resized)
    .composite([
      {
        input: logo,
        gravity: config.watermarkGravity,
        blend: 'over',
        left: config.watermarkPaddingPx,
        top: config.watermarkPaddingPx,
      },
    ])
    .webp({ quality: config.webpQualityPublic })
    .toBuffer()
}

export async function renderThumbnailWebp(
  originalBuffer: Buffer,
  watermarkPng: Buffer,
  config: EventPhotoProcessingConfig,
): Promise<Buffer> {
  const resized = await toResizedRgbBuffer(originalBuffer, config.thumbWidth)

  if (!config.watermarkOnThumbnail) {
    return sharp(resized).webp({ quality: config.webpQualityThumb }).toBuffer()
  }

  const meta = await sharp(resized).metadata()
  const w = meta.width ?? config.thumbWidth
  const logo = await rgbaLogoWithOpacity(watermarkPng, w, config)

  return sharp(resized)
    .composite([
      {
        input: logo,
        gravity: config.watermarkGravity,
        blend: 'over',
        left: config.watermarkPaddingPx,
        top: config.watermarkPaddingPx,
      },
    ])
    .webp({ quality: config.webpQualityThumb })
    .toBuffer()
}
```

- [ ] **Step 2.2:** Rodar `npx tsc --noEmit` e ajustar até compilar.

**Esperado:** `renderPublicWebp` / `renderThumbnailWebp` retornam `Buffer` WebP; ordem das operações: rotate → resize → composite → webp.

---

### Task 3: Script de verificação (substituto de suite Jest neste repo)

**Files:**

- Create: `scripts/verify-event-photo-processing.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 3.1:** Adicionar em `package.json` dentro de `"scripts"`:

```json
"verify:event-photos": "tsx scripts/verify-event-photo-processing.ts"
```

- [ ] **Step 3.2:** Criar `scripts/verify-event-photo-processing.ts`.

```typescript
import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { getEventPhotoProcessingConfig } from '../lib/event-photos/config'
import { renderPublicWebp, renderThumbnailWebp } from '../lib/event-photos/process-variants'

async function main() {
  const logoPath = join(process.cwd(), 'public', 'watermark-logo.png')
  let watermark: Buffer
  try {
    watermark = await readFile(logoPath)
  } catch {
    console.error('FAIL: coloque public/watermark-logo.png para rodar este script.')
    process.exit(1)
  }

  const fixture = await sharp({
    create: {
      width: 2000,
      height: 1200,
      channels: 3,
      background: { r: 200, g: 100, b: 40 },
    },
  })
    .jpeg()
    .toBuffer()

  const config = getEventPhotoProcessingConfig()

  const publicBuf = await renderPublicWebp(fixture, watermark, config)
  const pubMeta = await sharp(publicBuf).metadata()
  if (pubMeta.format !== 'webp') {
    console.error('FAIL: público não é WebP:', pubMeta.format)
    process.exit(1)
  }
  if ((pubMeta.width ?? 0) > config.publicMaxWidth) {
    console.error('FAIL: largura pública maior que max', pubMeta.width, config.publicMaxWidth)
    process.exit(1)
  }

  const thumbConfig = {
    ...config,
    watermarkOnThumbnail: false,
  }
  let thumbBuf = await renderThumbnailWebp(fixture, watermark, thumbConfig)
  let thumbMeta = await sharp(thumbBuf).metadata()
  if (thumbMeta.format !== 'webp') {
    console.error('FAIL: thumb não é WebP')
    process.exit(1)
  }
  if ((thumbMeta.width ?? 0) > config.thumbWidth) {
    console.error('FAIL: largura thumb maior que max')
    process.exit(1)
  }

  const thumbMarked = await renderThumbnailWebp(fixture, watermark, {
    ...config,
    watermarkOnThumbnail: true,
  })
  thumbMeta = await sharp(thumbMarked).metadata()
  if (thumbMeta.format !== 'webp') {
    console.error('FAIL: thumb com marca não é WebP')
    process.exit(1)
  }

  console.log('OK: event photo processing (public + thumb + thumb+marca).')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3.3:** Executar `npm run verify:event-photos`.

**Esperado:** saída `OK: event photo processing...` e código de saída 0. Se faltar a logo, instalar asset ou pular script até Task 5.

---

### Task 4: Integrar na server action + rollback + mensagem de logo

**Files:**

- Modify: `lib/actions/cms-event-photos.ts`

- [ ] **Step 4.1:** No topo de `cms-event-photos.ts`, remover duplicação de constantes substituídas por config onde fizer sentido, e adicionar:

```typescript
import { getEventPhotoProcessingConfig } from '@/lib/event-photos/config'
import { renderPublicWebp, renderThumbnailWebp } from '@/lib/event-photos/process-variants'
```

- [ ] **Step 4.2:** Alterar `getWatermarkBuffer` para lançar erro legível se o arquivo não existir (em português), por exemplo:

```typescript
async function getWatermarkBuffer() {
  const logoPath = join(process.cwd(), 'public', 'watermark-logo.png')
  try {
    return await readFile(logoPath)
  } catch {
    throw new Error(
      'Arquivo de marca d\'água ausente. Adicione `public/watermark-logo.png` (PNG com transparência).',
    )
  }
}
```

- [ ] **Step 4.3:** Em `uploadEventPhotos`, **antes** do `for`:

```typescript
const processingConfig = getEventPhotoProcessingConfig()
let watermarkBuffer: Buffer
try {
  watermarkBuffer = await getWatermarkBuffer()
} catch (e) {
  throw e
}
```

- [ ] **Step 4.4:** Substituir o bloco interno que hoje faz `sharp(buffer)` inline por chamadas a `renderPublicWebp(buffer, watermarkBuffer, processingConfig)` e `renderThumbnailWebp(buffer, watermarkBuffer, processingConfig)`.

- [ ] **Step 4.5:** Implementar rollback por arquivo. Padrão sugerido (adaptar nomes de variáveis ao código existente):

```typescript
const originalObjectPath = `${galleryId}/${fileName}.${ext}`
const publicObjectPath = `${galleryId}/${fileName}_public.webp`
const thumbObjectPath = `${galleryId}/${fileName}_thumb.webp`

const uploadedPaths: { bucket: 'event-photos-original' | 'event-photos-public'; path: string }[] = []

try {
  // após upload original bem-sucedido:
  uploadedPaths.push({ bucket: 'event-photos-original', path: originalObjectPath })

  const publicBuffer = await renderPublicWebp(buffer, watermarkBuffer, processingConfig)
  const thumbnailBuffer = await renderThumbnailWebp(buffer, watermarkBuffer, processingConfig)

  // upload public → uploadedPaths.push
  // upload thumb → uploadedPaths.push

  // insert row
} catch (err) {
  for (const { bucket, path } of uploadedPaths.reverse()) {
    await supabase.storage.from(bucket).remove([path])
  }
  throw err
}
```

**Nota:** garantir que `uploadedPaths` só inclui paths efetivamente enviados; se o insert falhar após os 3 uploads, o loop remove os três.

- [ ] **Step 4.6:** Remover imports/uso de `sharp` deste arquivo **se** não restarem outros usos; caso ainda use `sharp` para outra coisa, manter.

- [ ] **Step 4.7:** `npm run lint` e corrigir problemas introduzidos.

**Esperado:** upload continua criando mesmos paths e colunas; pipeline não chama `.webp()` antes de `.composite()`; thumb sem marca quando `EVENT_PHOTO_WATERMARK_ON_THUMB` falso.

---

### Task 5: Documentação de ambiente

**Files:**

- Modify: `.env.example`

- [ ] **Step 5.1:** Adicionar seção (após bloco de Supabase ou “Cron”, conforme estilo do arquivo):

```env
# ==========================================
# Event photo gallery (CMS upload — Sharp / WebP)
# Opcional; valores abaixo são os defaults no código.
# EVENT_PHOTO_PUBLIC_MAX_WIDTH=1600
# EVENT_PHOTO_THUMB_WIDTH=400
# EVENT_PHOTO_WEBP_QUALITY_PUBLIC=80
# EVENT_PHOTO_WEBP_QUALITY_THUMB=70
# EVENT_PHOTO_WATERMARK_WIDTH_PCT=12
# EVENT_PHOTO_WATERMARK_PADDING_PX=24
# EVENT_PHOTO_WATERMARK_GRAVITY=southeast
# EVENT_PHOTO_WATERMARK_OPACITY=0.35
# EVENT_PHOTO_WATERMARK_ON_THUMB=0
```

---

### Task 6: Smoke manual + atualizar spec

**Files:**

- Modify: `docs/superpowers/specs/2026-05-18-event-photos-upload-stabilization-design.md` (linha de status, se desejado)

- [ ] **Step 6.1:** `npm run dev`, no CMS abrir um evento com galeria, enviar 1 JPG e 1 PNG; confirmar preview na grade e URLs no bucket público como WebP.

- [ ] **Step 6.2:** Excluir uma foto e confirmar remoção dos 3 objetos (como regressão já exigida pelo spec).

- [ ] **Step 6.3:** (Opcional) Ajustar no spec a linha `**Status:**` para `Implementado` quando o PR for mergeado.

---

## Self-review do plano vs spec

1. **Cobertura:** Pipeline corrigido (§2.1), logo ausente (§2.1), opacidade (§2.1), env (§2.2), thumb opcional (§2.2), rollback (§2.1 ambiguidade fechada na política deste plano), teste via script (§6), sem fila (§2.3).
2. **Placeholders:** Nenhum TBD remanescente nos passos acima.
3. **Consistência:** Nomes `getEventPhotoProcessingConfig`, `renderPublicWebp`, `renderThumbnailWebp` usados de forma uniforme; paths de storage iguais ao código atual (`*_public.webp`, `*_thumb.webp`).

---

**Plano salvo em:** `docs/superpowers/plans/2026-05-18-event-photos-upload-stabilization.md`

Duas opções de execução:

1. **Subagent-Driven (recomendado)** — um subagente por task, revisão entre tasks, iteração rápida.
2. **Inline** — executar tasks nesta sessão com `executing-plans`, em lotes com checkpoints.

Qual abordagem você prefere para a implementação?
