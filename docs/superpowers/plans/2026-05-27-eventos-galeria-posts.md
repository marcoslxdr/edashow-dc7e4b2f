# Eventos: galeria, vídeos, posts e página pública — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar fluxo de eventos no CMS (stepper + dialogs), corrigir vídeos, vincular posts via `event_id`, enriquecer upload de galeria (arquivo + media + reutilizar), e unificar conteúdo na página pública `/events/[slug]`.

**Architecture:** Server actions com `createAdminClient` para CMS; painéis compartilhados (`EventGalleryPanel`, `EventVideosPanel`, `EventPostsPanel`) usados no editor e nos dialogs da listagem. UI segue `PRODUCT.md` / `DESIGN.md` (register product, laranja restrito, stepper horizontal).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind 4, shadcn Dialog/Tabs, Supabase, sharp (galeria), sonner.

**Spec:** `docs/superpowers/specs/2026-05-27-eventos-galeria-posts-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260527_posts_event_id.sql` | `posts.event_id` FK |
| `lib/actions/cms-event-videos.ts` | Erros legíveis, revalidate por slug |
| `lib/actions/cms-event-photos.ts` | `ensureGalleryForEvent`, `attachExistingEventPhotos`, `attachMediaToEventGallery`, `searchEventGalleries` |
| `lib/actions/cms-event-posts.ts` | **new** — list, link, search posts |
| `lib/supabase/api.ts` | `getPostsByEventSlug` (público) |
| `components/cms/EventStepper.tsx` | **new** — 4 steps, lock sem `eventId` |
| `components/cms/EventGalleryPanel.tsx` | **new** — settings + PhotoSourcePicker + grid |
| `components/cms/PhotoSourcePicker.tsx` | **new** — Enviar / Biblioteca / Outras galerias |
| `components/cms/EventVideosPanel.tsx` | **new** — thin wrapper |
| `components/cms/EventPostsPanel.tsx` | **new** — list + link + novo post |
| `components/cms/events/EventGalleryDialog.tsx` | **new** |
| `components/cms/events/EventVideosDialog.tsx` | **new** |
| `components/cms/events/EventPostsDialog.tsx` | **new** |
| `components/cms/EventEditor.tsx` | Stepper + painéis |
| `app/cms/events/page.tsx` | Ícones ação + dialogs + badge posts |
| `app/events/[slug]/page.tsx` | Galeria inline, cobertura, CTA inscrição |
| `app/events/[slug]/gallery/page.tsx` | Redirect permanente |
| `app/cms/posts/new/page.tsx` ou `PostEditor` | Ler `?event_id=` |

---

### Task 1: Migration `posts.event_id`

**Files:**
- Create: `supabase/migrations/20260527_posts_event_id.sql`

- [ ] **Step 1: Criar migration**

```sql
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_event_id ON public.posts(event_id);

COMMENT ON COLUMN public.posts.event_id IS 'Evento associado à cobertura editorial (opcional)';
```

- [ ] **Step 2: Aplicar localmente**

```bash
# Se usar Supabase CLI linkado:
supabase db push
# Ou executar SQL no dashboard Supabase (produção)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527_posts_event_id.sql
git commit -m "feat(db): add posts.event_id for event coverage"
```

---

### Task 2: Corrigir server actions de vídeo

**Files:**
- Modify: `lib/actions/cms-event-videos.ts`

- [ ] **Step 1: Helper de erro Supabase**

No topo do arquivo, após imports:

```typescript
function formatSupabaseError(context: string, error: { message?: string; code?: string; details?: string; hint?: string }) {
  const parts = [context, error.message, error.code].filter(Boolean)
  if (process.env.NODE_ENV === 'development' && error.hint) parts.push(`hint: ${error.hint}`)
  return parts.join(' — ')
}
```

- [ ] **Step 2: `addEventVideo` com mensagem clara e revalidate por slug**

Substituir corpo de `addEventVideo` após parse da URL:

```typescript
const supabase = createAdminClient()

const { data: event, error: eventLookupError } = await supabase
  .from('events')
  .select('slug')
  .eq('id', data.event_id)
  .single()

if (eventLookupError) {
  throw new Error(formatSupabaseError('Evento não encontrado', eventLookupError))
}

// ... count + insert existentes ...

if (error) {
  if (error.code === '42P01') {
    throw new Error('Tabela event_videos ausente. Aplique a migration 20260526_event_gallery_drive_and_videos.sql.')
  }
  throw new Error(formatSupabaseError('Não foi possível salvar o vídeo', error))
}

revalidatePath('/cms/events')
if (event?.slug) {
  revalidatePath(`/events/${event.slug}`)
}
revalidatePath('/events')
return row
```

Remover `revalidatePath('/events')` duplicado se já existir antes do return.

- [ ] **Step 3: Mesmo padrão em `deleteEventVideo`**

Buscar `event_id` do vídeo antes de deletar, obter `slug`, revalidar `/events/[slug]`.

- [ ] **Step 4: Verificar migration em produção**

Confirmar que `event_videos` existe (SQL editor ou `npm run test:db`). Documentar no PR se migration manual foi necessária.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/cms-event-videos.ts
git commit -m "fix(events): surface video insert errors and revalidate event page"
```

---

### Task 3: Extender `cms-event-photos` (galeria automática + anexos)

**Files:**
- Modify: `lib/actions/cms-event-photos.ts`

- [ ] **Step 1: `ensureGalleryForEvent`**

```typescript
export async function ensureGalleryForEvent(eventId: string) {
  const existing = await getGalleryByEventId(eventId)
  if (existing) return existing

  return createOrUpdateGallery({
    event_id: eventId,
    title: 'Galeria de Fotos',
    is_public: true,
  })
}
```

- [ ] **Step 2: `attachExistingEventPhotos`**

```typescript
export async function attachExistingEventPhotos(galleryId: string, photoIds: string[]) {
  if (!photoIds.length) return []

  const supabase = createAdminClient()
  const { data: sources, error: fetchError } = await supabase
    .from('event_photos')
    .select('original_url, watermarked_url, thumbnail_url, file_size')
    .in('id', photoIds)

  if (fetchError) throw fetchError
  if (!sources?.length) throw new Error('Nenhuma foto encontrada para copiar.')

  const { count } = await supabase
    .from('event_photos')
    .select('id', { count: 'exact', head: true })
    .eq('gallery_id', galleryId)

  let order = count ?? 0
  const rows = sources.map((s) => ({
    gallery_id: galleryId,
    original_url: s.original_url,
    watermarked_url: s.watermarked_url,
    thumbnail_url: s.thumbnail_url,
    file_size: s.file_size,
    display_order: order++,
  }))

  const { data, error } = await supabase.from('event_photos').insert(rows).select()
  if (error) throw error

  revalidatePath('/cms/events')
  revalidatePath('/events')
  return data
}
```

- [ ] **Step 3: Extrair processamento de buffer (DRY para media)**

Extrair de `uploadEventPhotos` uma função interna:

```typescript
async function insertProcessedPhotoFromBuffer(
  supabase: ReturnType<typeof createAdminClient>,
  galleryId: string,
  buffer: Buffer,
  mimeType: string,
  fileSize: number,
  baseName: string,
) {
  // mover lógica sharp + storage upload + insert de uma iteração do loop atual
  // retornar photoRecord
}
```

Refatorar loop de `uploadEventPhotos` para chamar `insertProcessedPhotoFromBuffer`.

- [ ] **Step 4: `attachMediaToEventGallery`**

```typescript
export async function attachMediaToEventGallery(galleryId: string, mediaIds: string[]) {
  if (!mediaIds.length) return []

  const supabase = createAdminClient()
  const { data: mediaRows, error } = await supabase
    .from('media')
    .select('id, url, filename, mime_type, size')
    .in('id', mediaIds)

  if (error) throw error
  if (!mediaRows?.length) throw new Error('Mídia não encontrada.')

  const uploaded: any[] = []
  for (const item of mediaRows) {
    const res = await fetch(item.url)
    if (!res.ok) throw new Error(`Falha ao baixar ${item.filename ?? item.id}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const mime = item.mime_type || 'image/jpeg'
    const photo = await insertProcessedPhotoFromBuffer(
      supabase,
      galleryId,
      buffer,
      mime,
      item.size ?? buffer.length,
      item.filename ?? `media-${item.id}`,
    )
    uploaded.push(photo)
  }

  revalidatePath('/cms/events')
  revalidatePath('/events')
  return uploaded
}
```

- [ ] **Step 5: `searchEventGalleries` para picker**

```typescript
export async function searchEventGalleries(query: string, excludeEventId?: string) {
  const supabase = createAdminClient()
  let q = supabase
    .from('event_photo_galleries')
    .select('id, title, event_id, events!inner(id, title, slug), photos:event_photos(id, thumbnail_url, watermarked_url)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (excludeEventId) q = q.neq('event_id', excludeEventId)
  if (query.trim()) q = q.ilike('events.title', `%${query.trim()}%`)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/actions/cms-event-photos.ts
git commit -m "feat(events): attach photos from media and other galleries"
```

---

### Task 4: Server actions de posts do evento

**Files:**
- Create: `lib/actions/cms-event-posts.ts`

- [ ] **Step 1: Implementar arquivo completo**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getEventPosts(eventId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, slug, status, published_at, cover_image_url')
    .eq('event_id', eventId)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

export async function linkPostToEvent(postId: string, eventId: string | null) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('posts')
    .update({ event_id: eventId })
    .eq('id', postId)
    .select('slug')
    .single()

  if (error) throw error

  revalidatePath('/cms/events')
  revalidatePath('/cms/posts')
  if (eventId) {
    const { data: ev } = await supabase.from('events').select('slug').eq('id', eventId).single()
    if (ev?.slug) revalidatePath(`/events/${ev.slug}`)
  }
  if (data?.slug) revalidatePath(`/posts/${data.slug}`)
  return data
}

export async function searchPostsForLink(query: string, excludeEventId?: string) {
  const supabase = createAdminClient()
  let q = supabase
    .from('posts')
    .select('id, title, slug, status, event_id')
    .order('updated_at', { ascending: false })
    .limit(15)

  if (query.trim()) q = q.ilike('title', `%${query.trim()}%`)
  if (excludeEventId) q = q.or(`event_id.is.null,event_id.neq.${excludeEventId}`)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/cms-event-posts.ts
git commit -m "feat(events): cms actions to link posts to events"
```

---

### Task 5: API pública `getPostsByEventSlug`

**Files:**
- Modify: `lib/supabase/api.ts`

- [ ] **Step 1: Adicionar função**

```typescript
export async function getPostsByEventSlug(slug: string, limit = 12) {
  const supabase = getPublicSupabaseClient()

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('slug', slug)
    .single()

  if (eventError?.code === 'PGRST116') return []
  if (eventError) throw eventError
  if (!event) return []

  const { data, error } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image_url, published_at')
    .eq('event_id', event.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/api.ts
git commit -m "feat(api): fetch published posts by event slug"
```

---

### Task 6: `EventStepper` (Impeccable product)

**Files:**
- Create: `components/cms/EventStepper.tsx`

- [ ] **Step 1: Componente**

Props: `activeStep: 'details' | 'gallery' | 'videos' | 'posts'`, `onStepChange`, `eventId?: string`, contagens opcionais.

Renderizar 4 botões horizontais com `border-b-2`:
- Ativo: `border-primary text-primary`
- Bloqueado (sem `eventId` e step !== details): `opacity-50 cursor-not-allowed`, ícone `Lock`, `title="Salve o evento para acessar"`
- Badge numérico opcional em Galeria/Vídeos/Posts

Sem gradient text. Transição `transition-colors duration-200 ease-out`.

- [ ] **Step 2: Commit**

```bash
git add components/cms/EventStepper.tsx
git commit -m "feat(cms): horizontal event editor stepper"
```

---

### Task 7: `PhotoSourcePicker` + `EventGalleryPanel`

**Files:**
- Create: `components/cms/PhotoSourcePicker.tsx`
- Create: `components/cms/EventGalleryPanel.tsx`
- Modify: `components/cms/GalleryUploader.tsx` (opcional: aceitar `onEnsureGallery` callback)

- [ ] **Step 1: `PhotoSourcePicker`**

Tabs shadcn: `Enviar` | `Biblioteca` | `Outras galerias`.

- **Enviar:** `<GalleryUploader galleryId={galleryId} onUploadComplete={onRefresh} />` (só render se `galleryId`).
- **Biblioteca:** chamar `getMedia()`, grid multi-select, botão "Adicionar à galeria" → `attachMediaToEventGallery(galleryId, selectedIds)`.
- **Outras galerias:** input busca debounced → `searchEventGalleries(q, excludeEventId)` → selecionar galeria → thumbs multi-select → `attachExistingEventPhotos`.

- [ ] **Step 2: `EventGalleryPanel`**

Props: `eventId: string`, `onGalleryChange?: () => void`.

Estado: carrega `getGalleryByEventId`; se upload/anexo e sem galeria, chama `ensureGalleryForEvent(eventId)` primeiro.

Topo: formulário metadados (título, descrição, Drive, contatos, público) + "Salvar galeria".

Meio: `PhotoSourcePicker` quando `gallery?.id`.

Baixo: `GalleryPhotoGrid` se houver fotos.

Empty state (DESIGN.md): *"Nenhuma foto ainda. Arraste imagens, escolha da biblioteca ou copie de outro evento."*

- [ ] **Step 3: Commit**

```bash
git add components/cms/PhotoSourcePicker.tsx components/cms/EventGalleryPanel.tsx
git commit -m "feat(cms): event gallery panel with multi-source photo picker"
```

---

### Task 8: Painéis de vídeos e posts

**Files:**
- Create: `components/cms/EventVideosPanel.tsx`
- Create: `components/cms/EventPostsPanel.tsx`

- [ ] **Step 1: `EventVideosPanel`**

```tsx
export function EventVideosPanel({ eventId, videos, onChange }: { eventId: string; videos: any[]; onChange: () => void }) {
  return <EventVideosEditor eventId={eventId} videos={videos} onChange={onChange} />
}
```

- [ ] **Step 2: `EventPostsPanel`**

- Lista `getEventPosts(eventId)` em `useEffect`.
- Cada linha: título, status badge, link editar `/cms/posts/{id}`, botão desvincular → `linkPostToEvent(id, null)`.
- Busca: Input + lista `searchPostsForLink` → botão Vincular.
- Link: `<Link href={`/cms/posts/new?event_id=${eventId}`}>Novo post de cobertura</Link>`.

- [ ] **Step 3: Commit**

```bash
git add components/cms/EventVideosPanel.tsx components/cms/EventPostsPanel.tsx
git commit -m "feat(cms): event videos and posts panels"
```

---

### Task 9: Refatorar `EventEditor` para stepper

**Files:**
- Modify: `components/cms/EventEditor.tsx`

- [ ] **Step 1: Substituir `activeTab` por `activeStep` com tipo union**

- [ ] **Step 2: Remover bloco de tabs manual; usar `<EventStepper />`**

- [ ] **Step 3: Render condicional**

- `details` → formulário atual (inalterado em campos).
- `gallery` → `<EventGalleryPanel eventId={currentEvent.id} onGalleryChange={fetchGallery} />` se `currentEvent.id`, senão null.
- `videos` → fetch videos + `EventVideosPanel`.
- `posts` → `EventPostsPanel`.

- [ ] **Step 4: Ajustar create flow**

Após `saveEvent` sem id:

```typescript
toast.success('Evento criado. Você pode anexar galeria, vídeos e posts quando quiser.')
router.replace(`/cms/events/${saved.id}`)
```

Não mudar step automaticamente para galeria (usuário escolhe).

- [ ] **Step 5: Commit**

```bash
git add components/cms/EventEditor.tsx
git commit -m "refactor(cms): event editor uses four-step stepper"
```

---

### Task 10: Dialogs na listagem `/cms/events`

**Files:**
- Create: `components/cms/events/EventGalleryDialog.tsx`
- Create: `components/cms/events/EventVideosDialog.tsx`
- Create: `components/cms/events/EventPostsDialog.tsx`
- Modify: `app/cms/events/page.tsx`

- [ ] **Step 1: Dialogs finos**

Cada um recebe `event: { id, title }`, `open`, `onOpenChange`.

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Galeria — {event.title}</DialogTitle>
    </DialogHeader>
    <EventGalleryPanel eventId={event.id} />
  </DialogContent>
</Dialog>
```

Vídeos: `max-w-lg`. Posts: `max-w-2xl`.

- [ ] **Step 2: Coluna ações na `DataTable`**

Adicionar coluna `actions` com três `Button variant="ghost" size="icon"`:
- `Camera` → gallery dialog
- `Youtube` → videos dialog
- `FileText` → posts dialog

`e.stopPropagation()` em cada `onClick`.

Estado: `dialogEvent`, `dialogType: 'gallery' | 'videos' | 'posts' | null`.

- [ ] **Step 3: Badge `post_count`**

No `fetchEvents`, para cada evento:

```typescript
const { count: postCount } = await supabase
  .from('posts')
  .select('id', { count: 'exact', head: true })
  .eq('event_id', event.id)
```

Ou query agregada se preferir performance (YAGNI: N+1 ok para dezenas de eventos).

- [ ] **Step 4: Commit**

```bash
git add components/cms/events/*.tsx app/cms/events/page.tsx
git commit -m "feat(cms): quick-attach dialogs on events list"
```

---

### Task 11: Post editor — `event_id` via query string

**Files:**
- Modify: `components/cms/PostEditor.tsx` (ou página new em `app/cms/posts/new/page.tsx`)

- [ ] **Step 1: Ler searchParams**

```typescript
const searchParams = useSearchParams()
const presetEventId = searchParams.get('event_id')
```

No estado inicial do post ou no `savePost` payload, incluir `event_id: presetEventId` quando criando novo post.

- [ ] **Step 2: UI opcional**

Select somente leitura "Evento vinculado" se `presetEventId` presente (buscar título do evento).

- [ ] **Step 3: Commit**

```bash
git add components/cms/PostEditor.tsx
git commit -m "feat(cms): pre-fill event_id when creating post from event"
```

---

### Task 12: Página pública unificada

**Files:**
- Modify: `app/events/[slug]/page.tsx`
- Create or modify: `components/events/EventGallerySection.tsx` (**new**, opcional)
- Create: `components/events/EventCoveragePosts.tsx` (**new**)

- [ ] **Step 1: Fetch posts**

```typescript
const [gallery, eventVideos, coveragePosts] = await Promise.all([
  getGalleryByEventSlug(params.slug),
  getEventVideosBySlug(params.slug),
  getPostsByEventSlug(params.slug),
])
```

- [ ] **Step 2: CTA inscrição para qualquer status com URL**

Trocar condição:

```typescript
{event.registration_url && (
```

(remover `&& event.status === 'upcoming'` nos dois CTAs).

- [ ] **Step 3: Remover botão "Ver Galeria" que só linka `/gallery`**

Substituir por seção inline `id="galeria"` quando `gallery?.photos?.length`:

- Grid 2–4 colunas com `thumbnail_url` ou `watermarked_url`.
- Reutilizar `GalleryLightbox` com array de URLs.
- Manter botão Drive se `drive_download_url`.

- [ ] **Step 4: Seção Cobertura**

Se `coveragePosts.length > 0`:

```tsx
<section id="cobertura" className="mb-12">
  <h2 className="text-3xl font-bold text-gray-900 mb-6">Cobertura</h2>
  <EventCoveragePosts posts={coveragePosts} />
</section>
```

Componente: cards com `cover_image_url`, título, link `/posts/${slug}`; mobile `flex overflow-x-auto gap-4`, desktop `grid grid-cols-3 gap-6`.

- [ ] **Step 5: Reordenar seções conforme spec**

Ordem: Hero → CTA inscrição (se URL) → Data/local → Vídeos → Galeria → Cobertura → Sobre → organizadores...

- [ ] **Step 6: Commit**

```bash
git add app/events/[slug]/page.tsx components/events/EventCoveragePosts.tsx components/events/EventGallerySection.tsx
git commit -m "feat(events): inline gallery, coverage posts, registration CTA"
```

---

### Task 13: Redirect `/events/[slug]/gallery`

**Files:**
- Modify: `app/events/[slug]/gallery/page.tsx`

- [ ] **Step 1: Substituir conteúdo por redirect**

```typescript
import { redirect } from 'next/navigation'

export default async function EventGalleryRedirectPage({
  params,
}: {
  params: { slug: string }
}) {
  redirect(`/events/${params.slug}#galeria`)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/events/[slug]/gallery/page.tsx
git commit -m "feat(events): redirect legacy gallery route to main event page"
```

---

### Task 14: Validação manual e build

- [ ] **Step 1: Build**

```bash
npm run build
```

Esperado: build completa (projeto ignora TS errors no config, mas verificar sem erros fatais novos).

- [ ] **Step 2: Checklist manual (spec §6)**

| Cenário | OK |
|---------|-----|
| Criar evento só detalhes | |
| Vídeo YouTube + Instagram | |
| Upload galeria | |
| Biblioteca media | |
| Copiar de outra galeria | |
| Dialog na listagem | |
| Vincular / desvincular post | |
| Página pública: galeria + posts + inscrição past | |
| `/events/x/gallery` redirect | |

- [ ] **Step 3: Commit final se ajustes**

```bash
git commit -m "chore: event gallery posts QA fixes"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `posts.event_id` | 1 |
| Vídeo bug + migration | 2 |
| attach photos media/other | 3 |
| cms-event-posts | 4 |
| getPostsByEventSlug | 5 |
| Stepper + create só detalhes | 6, 9 |
| PhotoSourcePicker 3 fontes | 7 |
| EventGalleryPanel | 7 |
| EventVideosPanel | 8 |
| EventPostsPanel | 8 |
| Dialogs listagem | 10 |
| Página pública seções | 12 |
| Redirect gallery | 13 |
| Impeccable UI tokens | 6, 7, 10 (classes primary, empty states) |
| Post new ?event_id= | 11 |

**Gaps:** none.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-eventos-galeria-posts.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints  

Which approach?
