# Galeria de Fotos de Eventos — Design Spec

> **Data:** 2026-05-14
> **Status:** Aprovado
> **Autor:** AI Agent

---

## 1. Objetivo

Permitir que administradores do CMS vinculem galerias de fotos aos eventos existentes. As fotos públicas devem conter a marca d'água do EdaShow, serem otimizadas para web, e a página da galeria deve oferecer um canal de contato para solicitar as imagens em alta qualidade (sem marca d'água).

---

## 2. Arquitetura

A solução é construída sobre o stack existente (Next.js 15, Supabase, Tailwind, shadcn/ui).

- **Upload:** Server Action que recebe arquivos, processa com `sharp`, e salva em dois buckets do Supabase Storage.
- **Banco:** Duas novas tabelas relacionadas (`event_photo_galleries`, `event_photos`).
- **CMS:** Nova aba no `EventEditor` para gerenciar a galeria.
- **Pública:** Nova rota `/events/[slug]/gallery` que exibe as fotos otimizadas e o botão de contato.

---

## 3. Esquema de Banco de Dados (Supabase)

### 3.1 `event_photo_galleries`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default gen_random_uuid() |
| `event_id` | uuid | FK → events(id), NOT NULL, UNIQUE (1 galeria por evento) |
| `title` | text | NOT NULL |
| `description` | text | nullable |
| `is_public` | boolean | default true |
| `contact_email` | text | nullable |
| `contact_whatsapp` | text | nullable |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

### 3.2 `event_photos`

| Coluna | Tipo | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default gen_random_uuid() |
| `gallery_id` | uuid | FK → event_photo_galleries(id), NOT NULL |
| `original_url` | text | NOT NULL (bucket privado) |
| `watermarked_url` | text | NOT NULL (bucket público) |
| `thumbnail_url` | text | NOT NULL (bucket público) |
| `display_order` | int | default 0 |
| `file_size` | bigint | nullable |
| `created_at` | timestamptz | default now() |

### 3.3 Buckets de Storage

- **`event-photos-original`** — Privado. Acesso restrito via `service_role_key`. Guarda o arquivo original em alta qualidade.
- **`event-photos-public`** — Público. Guarda a versão com marca d'água e a thumbnail.

---

## 4. Server Actions (`lib/actions/cms-event-photos.ts`)

### 4.1 `createOrUpdateGallery(data)`
Cria ou atualiza o registro da galeria vinculada a um evento.

### 4.2 `uploadEventPhotos(galleryId: string, files: File[])`
1. Recebe array de `File`.
2. Para cada arquivo:
   a. Valida tipo (image/jpeg, image/png, image/webp) e tamanho (max 20MB).
   b. Lê o buffer.
   c. Processa com `sharp`:
      - **Public version:** resize para max 1600px de largura, qualidade 80, formato webp. Aplica marca d'água.
      - **Thumbnail:** resize para 400px de largura, qualidade 70, formato webp.
   d. Faz upload da original para `event-photos-original`.
   e. Faz upload da publica para `event-photos-public`.
   f. Faz upload da thumbnail para `event-photos-public`.
   g. Insere registro em `event_photos`.
3. Retorna array de registros criados.

### 4.3 `deleteEventPhoto(photoId: string)`
Remove o registro do banco e os arquivos dos dois buckets.

### 4.4 `reorderEventPhotos(photoIds: string[])`
Atualiza o campo `display_order` conforme a nova ordem.

### 4.5 `getGalleryByEventSlug(slug: string)`
Busca a galeria pública de um evento, com todas as fotos ordenadas por `display_order`.

### 4.6 `deleteGallery(galleryId: string)`
Remove a galeria, todas as fotos vinculadas, e os arquivos dos buckets.

---

## 5. Marca d'Água

- **Asset:** Imagem PNG da logo do EdaShow. O agente deverá localizar o logo atual do site (provavelmente em `public/` ou como componente React) e salvá-lo como `public/watermark-logo.png` com fundo transparente.
- **Processamento:** Usar `sharp.composite([{ input: logoBuffer, gravity: 'southeast', blend: 'over' }])`.
- **Ajustes:**
  - Redimensionar a logo para ~12% da largura da imagem alvo.
  - Aplicar padding de 24px das bordas.
  - Opacidade: 35%.
- **Armazenamento:** A logo PNG será salva em `public/watermark-logo.png` e lida como buffer durante o processamento.

---

## 6. Componentes de UI

### 6.1 CMS — EventEditor (`components/cms/EventEditor.tsx`)
Adicionar uma nova aba **"Galeria de Fotos"** ao editor de eventos existente.

**Nova aba contém:**
- Campo `title` da galeria.
- Campo `description` (textarea).
- Toggle `is_public`.
- Campos `contact_email` e `contact_whatsapp`.
- Componente de upload drag-and-drop (`components/cms/GalleryUploader.tsx`).
- Grid de fotos com ordenação drag-and-drop (`components/cms/GalleryPhotoGrid.tsx`).
- Botão para excluir a galeria inteira.

### 6.2 `components/cms/GalleryUploader.tsx`
- Área de drop para múltiplos arquivos.
- Preview dos arquivos selecionados.
- Indicador de carregamento (spinner) durante o upload, pois o processamento server-side com sharp é rápido para poucas fotos.
- Validação de tipo e tamanho.
- Botão "Enviar Fotos" que chama `uploadEventPhotos`.

### 6.3 `components/cms/GalleryPhotoGrid.tsx`
- Grid de thumbnails.
- Drag-and-drop para reordenar (usar HTML5 drag and drop nativo para evitar adicionar novas dependências).
- Botão de exclusão por foto.
- Lightbox para preview rápido no CMS.

### 6.4 Pública — Página da Galeria (`app/events/[slug]/gallery/page.tsx`)
- **Layout:**
  - Header com título do evento e botão "Voltar ao evento".
  - Título e descrição da galeria.
  - Grid responsivo de fotos (3 colunas desktop, 2 tablet, 1 mobile).
  - Cada foto: thumbnail com lazy loading. Clique abre lightbox com versão maior.
  - Banner/CTA fixo ou no final: "Solicitar imagens em alta qualidade".
- **Modal de Contato:**
  - Mostra `contact_email` (com mailto: link).
  - Mostra `contact_whatsapp` (com link wa.me).
  - Texto instrucional: "Entre em contato para receber as fotos originais sem marca d'água."

### 6.5 Pública — Lightbox (`components/GalleryLightbox.tsx`)
- Componente reutilizável para visualização em tela cheia.
- Navegação entre fotos (setas/esquerda/direita).
- Fechar com ESC ou clique fora.
- Usar `next/image` com `priority` para a foto ativa.

---

## 7. Rota Pública

- **`/events/[slug]/gallery`**
  - Busca o evento pelo slug.
  - Se não existir ou não tiver galeria pública → `notFound()`.
  - Renderiza a galeria com as fotos ordenadas.

---

## 8. Segurança & RLS

### 8.1 Políticas de Storage
- `event-photos-original`:
  - SELECT: service_role apenas (RLS bypass).
- `event-photos-public`:
  - SELECT: anon (público).

### 8.2 Políticas de Tabela (Supabase RLS)
- `event_photo_galleries`:
  - SELECT: todos (anon/authenticated) quando `is_public = true`. Administradores autenticados (CMS) podem SELECT/INSERT/UPDATE/DELETE todos.
- `event_photos`:
  - SELECT: todos quando a galeria pai é pública.
  - Administradores autenticados: full CRUD.

> **Nota:** No projeto atual, as server actions usam `createAdminClient()` (service role) para bypass do RLS. As policies são uma camada de segurança adicional.

---

## 9. Fluxo de Dados (Upload)

```
Admin (CMS)
  │
  ▼
[Drag & Drop] ──► [GalleryUploader]
  │
  ▼
[uploadEventPhotos] (Server Action)
  │
  ├──► sharp: resize + watermark ──► Buffer (webp)
  │
  ├──► Upload original ──► Supabase Storage (bucket privado)
  │
  ├──► Upload public ──► Supabase Storage (bucket público)
  │
  ├──► Upload thumbnail ──► Supabase Storage (bucket público)
  │
  └──► INSERT ──► event_photos
```

---

## 10. Testes

- **Teste de upload:** Verificar se `sharp` gera corretamente as versões public/thumbnail.
- **Teste de exclusão:** Verificar se o registro e os arquivos no storage são removidos.
- **Teste de acesso público:** Verificar se a rota `/events/[slug]/gallery` retorna 404 quando a galeria não existe ou não é pública.
- **Teste de marca d'água:** Verificar se a logo aparece nas imagens públicas.

---

## 11. Arquivos a Criar/Modificar

### Novos Arquivos
- `supabase/migrations/20260514_create_event_photo_tables.sql`
- `lib/actions/cms-event-photos.ts`
- `components/cms/GalleryUploader.tsx`
- `components/cms/GalleryPhotoGrid.tsx`
- `components/GalleryLightbox.tsx`
- `app/events/[slug]/gallery/page.tsx`
- `public/watermark-logo.png` (ou script para gerar)

### Arquivos Modificados
- `components/cms/EventEditor.tsx` — adicionar aba de galeria
- `app/events/[slug]/page.tsx` — adicionar link para a galeria quando existir
- `app/cms/events/page.tsx` — indicar visualmente quais eventos têm galeria (badge)

---

## 12. Decisões de Design

| Decisão | Justificativa |
|---------|---------------|
| 1 galeria por evento | Simplicidade. Se necessário, evoluir para N galerias no futuro. |
| Bucket separado (original vs público) | Segurança clara: original nunca é exposto publicamente. |
| Processamento server-side com `sharp` | Controle total, previsibilidade, e otimização de CPU no servidor Vercel (função serverless). |
| Rota vinculada ao slug do evento | URLs amigáveis e descritivas: `/events/congresso-2026/gallery`. |
| Botão de contato = email/whatsapp direto | Requisito do usuário (opção B). Não requer formulário backend. |

