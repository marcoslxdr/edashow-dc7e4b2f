# Eventos: galeria, vídeos, posts e página pública unificada

**Data:** 2026-05-27  
**Status:** Aprovado (brainstorming)  
**Abordagem:** Wizard no editor + dialogs na listagem CMS + página pública em seções únicas  
**UI:** Impeccable register `product` (CMS e superfície pública de leitura)

---

## Contexto

O CMS de eventos hoje usa três abas (Detalhes, Galeria, Vídeos). A galeria aceita apenas upload por arquivo (drag-and-drop), sem picker da biblioteca `/cms/media` nem reutilização de fotos de outros eventos. Vídeos falham em produção com erro genérico de Server Components. Posts não têm vínculo com eventos. A página pública `/events/[slug]` não lista posts nem exibe a galeria inline (redireciona para `/gallery`). O fluxo real do negócio é: criar evento antes, anexar fotos e cobertura depois.

## Decisões de produto (fechadas)

| Tema | Decisão |
|------|---------|
| Posts ↔ evento | Coluna `event_id` em `posts` (1 evento por post, opcional) |
| Criação de evento | Apenas etapa **Detalhes** obrigatória |
| Galeria / vídeos no create | Opcionais; etapas bloqueadas até existir `events.id` |
| Listagem `/cms/events` | Três dialogs separados por ícone: galeria, vídeos, posts |
| Fontes de fotos | Upload + biblioteca CMS + copiar de outras galerias de evento |
| Página pública | Tudo em `/events/[slug]`; `/events/[slug]/gallery` → redirect 301 |
| UI | Impeccable product: light, laranja só em primário/estado ativo, stepper familiar |

## Arquitetura recomendada

**Abordagem 1 (aprovada):** Stepper no `EventEditor` + três `Dialog` na `DataTable` de eventos, componentes compartilhados entre editor e dialogs (`EventGalleryPanel`, `EventVideosPanel`, `EventPostsPanel`).

Não adotar: editor único em scroll infinito (pior para “etapas”); hub só na listagem (fragmenta edição completa).

---

## 1. Modelo de dados

### 1.1 Migration: posts ligados a eventos

```sql
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_event_id ON public.posts(event_id);
```

- Post sem evento: `event_id IS NULL` (comportamento atual).
- Excluir evento: posts permanecem, `event_id` vira `NULL`.

### 1.2 Galeria e vídeos (existente)

- `event_photo_galleries` (1:1 com `events`)
- `event_photos` (N por galeria)
- `event_videos` (N por evento)

Garantir migration `20260526_event_gallery_drive_and_videos.sql` aplicada em produção.

### 1.3 Novas server actions

| Action | Responsabilidade |
|--------|------------------|
| `attachExistingEventPhotos(galleryId, photoIds[])` | Insere linhas em `event_photos` copiando `original_url`, `watermarked_url`, `thumbnail_url` e `display_order` incrementado; **não** reprocessa watermark |
| `attachMediaToEventGallery(galleryId, mediaIds[])` | Para cada item da tabela `media`, baixa/processa via pipeline existente de `uploadEventPhotos` (watermark + variantes) |
| `getEventPosts(eventId)` | Posts com `event_id` e status publicado/rascunho (CMS) |
| `linkPostToEvent(postId, eventId \| null)` | Atualiza `posts.event_id` |
| `searchPostsForLink(query?, excludeEventId?)` | Autocomplete para vincular post existente |

### 1.4 Correção do bug de vídeo

**Causa provável:** tabela `event_videos` ausente ou RLS bloqueando insert em produção; erro propagado como falha genérica de RSC.

**Correção:**

1. Verificar/aplicar migration em produção.
2. Em `addEventVideo`: capturar erro Supabase e `throw new Error(mensagem legível)` (código + hint em dev).
3. `revalidatePath` apenas: `/cms/events`, `/cms/events/[id]`, `/events/[slug]` (evitar paths inválidos).
4. Cliente (`EventVideosEditor`): exibir `error.message` no toast; nunca depender de re-render RSC após action.

---

## 2. CMS — EventEditor (stepper)

Substituir tabs por **stepper horizontal** com quatro etapas:

| # | Etiqueta | Conteúdo | No create (sem `id`) |
|---|----------|----------|----------------------|
| 1 | Detalhes | Campos atuais do formulário | Ativa, obrigatória |
| 2 | Galeria | `EventGalleryPanel` | Bloqueada (cadeado + tooltip) |
| 3 | Vídeos | `EventVideosPanel` | Bloqueada |
| 4 | Posts | `EventPostsPanel` | Bloqueada |

**Comportamento create:**

- Botão **Criar evento** salva só detalhes; `router.replace(/cms/events/{id})`.
- Toast: “Evento criado. Você pode anexar galeria, vídeos e posts quando quiser.”
- Após `id`, etapas 2–4 desbloqueiam.

**Impeccable (product):**

- Tema claro (escritório, tarefa pós-evento).
- Accent `#FF6F00` / `primary` apenas em CTA primário, step ativo, focus ring.
- Sem gradient text, glassmorphism decorativo, side-stripe borders.
- Empty states com copy acionável (ex.: “Nenhuma foto ainda. Arraste imagens ou escolha da biblioteca.”).
- Transições 150–200ms, `ease-out` (step indicator, drag-over).

### 2.1 EventGalleryPanel

Extrair lógica atual da aba Galeria + novo **`PhotoSourcePicker`** com três modos (segmented control ou sub-tabs):

1. **Enviar** — `GalleryUploader` existente (drag-and-drop, JPG/PNG/WEBP, 20MB).
2. **Biblioteca** — grid `getMedia()`, multi-select, botão “Adicionar à galeria” → `attachMediaToEventGallery`.
3. **Outras galerias** — busca por título de evento → lista de galerias → grid de thumbs com multi-select → `attachExistingEventPhotos`.

Auto-criar registro `event_photo_galleries` na primeira ação de foto (se ainda não existir), com defaults atuais (`title`, `is_public`, etc.).

Configurações da galeria (título, Drive, contatos) permanecem no topo do painel; “Salvar galeria” só para metadados.

### 2.2 EventVideosPanel

Wrapper de `EventVideosEditor` (sem mudança de UX além de erros claros).

### 2.3 EventPostsPanel

- Lista posts onde `event_id = currentEvent.id` (título, status, data).
- **Vincular existente:** combobox/busca → `linkPostToEvent`.
- **Novo post:** link `/cms/posts/new?event_id={id}` ou dialog mínimo que redireciona com query preservada.
- **Desvincular:** `linkPostToEvent(postId, null)`.

---

## 3. CMS — Listagem `/cms/events`

Na coluna de ações (ou ao lado do nome), três botões ícone com `stopPropagation` (não abrir editor):

| Ícone | Dialog | Conteúdo |
|-------|--------|----------|
| Câmera | `EventGalleryDialog` | `EventGalleryPanel` completo |
| YouTube | `EventVideosDialog` | `EventVideosPanel` |
| Artigo | `EventPostsDialog` | `EventPostsPanel` |

- Larguras: galeria `max-w-3xl`, vídeos `max-w-lg`, posts `max-w-2xl`.
- shadcn `Dialog`: `aria-labelledby`, foco inicial no primeiro campo.
- Persistência incremental: uploads e add vídeo salvam sem fechar; fechar dialog não descarta já persistido.

Badges na linha do evento: contagem fotos, vídeos, posts (estender badges atuais).

**Justificativa modal (Impeccable):** tarefa rápida pós-evento sem navegar para editor completo; alternativa inline na tabela seria cramped.

---

## 4. Página pública `/events/[slug]`

### 4.1 Estrutura de seções (ordem)

1. Hero (capa, status, título) — existente  
2. CTA inscrição — se `registration_url` preenchido (**mostrar também para `past`/`finished`**, não só `upcoming`)  
3. Data e local — existente  
4. **Vídeos** — `EventVideoEmbeds`  
5. **Galeria** — grid responsivo + lightbox reutilizando `GalleryLightbox` / padrão de `GalleryClient`  
6. **Cobertura** — cards de posts com `event_id` (capa, título, link `/posts/{slug}`)  
7. Sobre / organizadores / patrocinadores / palestrantes — existente  

### 4.2 Redirect

`app/events/[slug]/gallery/page.tsx` → redirect permanente para `/events/[slug]#galeria` (ou query preservada).

### 4.3 Data fetching

- `getPostsByEventId(slug)` em `lib/supabase/api.ts` (join event por slug, posts `status = published` no público).
- Galeria: manter `getGalleryByEventSlug`; render inline se `photos.length > 0`.

### 4.4 Impeccable (leitura)

- Prose descrição max ~70ch.
- Galeria: grid 2–4 colunas, lazy images, sem cards genéricos repetidos.
- Posts cobertura: scroll horizontal no mobile, grid no desktop.

---

## 5. Arquivos principais (implementação)

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/20260527_posts_event_id.sql` | Nova coluna `event_id` |
| `lib/actions/cms-event-photos.ts` | `attachExistingEventPhotos`, `attachMediaToEventGallery` |
| `lib/actions/cms-event-videos.ts` | Erros explícitos, revalidate paths |
| `lib/actions/cms-event-posts.ts` | **novo** — link, list, search |
| `lib/supabase/api.ts` | `getPostsByEventSlug` |
| `components/cms/EventEditor.tsx` | Stepper, painéis |
| `components/cms/EventGalleryPanel.tsx` | **novo** |
| `components/cms/PhotoSourcePicker.tsx` | **novo** |
| `components/cms/EventPostsPanel.tsx` | **novo** |
| `components/cms/events/EventGalleryDialog.tsx` | **novo** (e vídeos/posts) |
| `app/cms/events/page.tsx` | Ícones + dialogs |
| `app/events/[slug]/page.tsx` | Seções galeria + posts + CTA inscrição |
| `app/events/[slug]/gallery/page.tsx` | Redirect |

---

## 6. Testes e validação

| Cenário | Esperado |
|---------|----------|
| Criar evento só com detalhes | Sucesso sem galeria/vídeo/post |
| Adicionar vídeo YouTube/Instagram | Toast sucesso; aparece na lista e na página pública |
| Upload + biblioteca + copiar galeria | Fotos na galeria com watermark onde aplicável |
| Dialog galeria na listagem | Upload sem abrir editor completo |
| Vincular post | `event_id` setado; aparece em Cobertura na página pública |
| `/events/{slug}/gallery` | Redirect para página principal |
| Produção sem migration vídeos | Mensagem clara no toast (não digest RSC) |

---

## 7. Fora de escopo

- N:N posts ↔ eventos (só `event_id` em `posts`).
- Edição rich-text de post dentro do dialog de evento (só vincular ou link para editor de posts).
- Regenerar PRODUCT.md/DESIGN.md (recomendado: `impeccable teach` + `document` em sessão separada).

---

## 8. Próximo passo

Após review deste arquivo: gerar plano em `docs/superpowers/plans/2026-05-27-eventos-galeria-posts.md` via skill **writing-plans**.
