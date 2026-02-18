# API de Posts – EdaShow

Guia completo para criar, atualizar, listar e excluir posts diretamente no EdaShow via API REST.

---

## Sumário

1. [Configuração inicial](#1-configuração-inicial)
2. [Autenticação](#2-autenticação)
3. [Endpoints disponíveis](#3-endpoints-disponíveis)
   - [Listar posts](#31-get-apiposts--listar-posts)
   - [Criar post](#32-post-apiposts--criar-post)
   - [Buscar post por ID](#33-get-apipostsid--buscar-post-por-id)
   - [Atualizar post](#34-put-apipostsid--atualizar-post)
   - [Excluir post](#35-delete-apipostsid--excluir-post)
   - [Upload de imagem](#36-post-apipostsupload--upload-de-imagem)
4. [Campos disponíveis](#4-campos-disponíveis)
5. [Exemplos por ferramenta](#5-exemplos-por-ferramenta)
   - [cURL](#51-curl)
   - [Python (requests)](#52-python-requests)
   - [Node.js (fetch)](#53-nodejs-fetch)
   - [n8n (automação)](#54-n8n)
   - [Make / Zapier (webhook)](#55-make--zapier)
6. [Códigos de erro](#6-códigos-de-erro)
7. [IDs úteis](#7-ids-úteis)

---

## 1. Configuração inicial

### Adicionar a variável de ambiente

No arquivo `.env` (ou nas variáveis de ambiente do Vercel/servidor), adicione:

```env
POSTS_API_KEY=sua-chave-secreta-aqui
```

Gere uma chave forte. Exemplos:

```bash
# Linux / macOS
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Importante:** Reinicie o servidor após adicionar a variável.

---

## 2. Autenticação

Todos os endpoints exigem o header:

```
Authorization: Bearer <POSTS_API_KEY>
```

Sem este header (ou com chave errada) a API retorna `401` ou `403`.

---

## 3. Endpoints disponíveis

**Base URL:** `https://seu-dominio.com.br` (ou `http://localhost:3000` em desenvolvimento)

---

### 3.1 `GET /api/posts` – Listar posts

Retorna lista de posts com filtros e paginação.

**Query params:**

| Parâmetro     | Tipo   | Padrão | Descrição                              |
|---------------|--------|--------|----------------------------------------|
| `status`      | string | —      | `draft`, `published` ou `archived`     |
| `category_id` | string | —      | UUID da categoria                      |
| `limit`       | number | `20`   | Máximo de resultados (máx: 100)        |
| `offset`      | number | `0`    | Paginação                              |

**Resposta:**
```json
{
  "posts": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "count": 5
  }
}
```

---

### 3.2 `POST /api/posts` – Criar post

Cria um novo post. Retorna `201` com o post criado.

**Headers:**
```
Authorization: Bearer <POSTS_API_KEY>
Content-Type: application/json
```

**Body (JSON):**

| Campo             | Tipo    | Obrigatório | Descrição                                              |
|-------------------|---------|-------------|--------------------------------------------------------|
| `title`           | string  | **Sim**     | Título do post                                         |
| `content`         | string  | **Sim**     | Conteúdo em HTML ou texto puro                         |
| `excerpt`         | string  | Não         | Resumo curto (aparece em listagens)                    |
| `cover_image_url` | string  | Não         | URL da imagem destaque (use o endpoint de upload)      |
| `category_id`     | string  | Não         | UUID da categoria                                      |
| `columnist_id`    | string  | Não         | UUID do colunista/autor                                |
| `status`          | string  | Não         | `"draft"` (padrão), `"published"` ou `"archived"`      |
| `tags`            | array   | Não         | `["tag1", "tag2"]`                                     |
| `featured_home`   | boolean | Não         | Destaque na homepage (`false` padrão)                  |
| `meta_description`| string  | Não         | Descrição SEO                                          |
| `source_url`      | string  | Não         | URL da fonte original                                  |
| `published_at`    | string  | Não         | Data ISO 8601. Se `status=published` e omitido, usa agora |
| `slug`            | string  | Não         | Slug personalizado (gerado do título se omitido)       |

**Resposta (201):**
```json
{
  "post": {
    "id": "uuid-do-post",
    "title": "Meu Post",
    "slug": "meu-post",
    "status": "published",
    ...
  }
}
```

---

### 3.3 `GET /api/posts/[id]` – Buscar post por ID

Retorna um post específico com dados de categoria e autor.

**Resposta (200):**
```json
{
  "post": {
    "id": "...",
    "title": "...",
    "category": { "id": "...", "name": "...", "slug": "..." },
    "author": { "id": "...", "name": "...", "slug": "..." },
    ...
  }
}
```

---

### 3.4 `PUT /api/posts/[id]` – Atualizar post

Atualização parcial: envie **apenas os campos que deseja alterar**.

**Body (JSON):** Mesmos campos do `POST /api/posts`, todos opcionais.

**Resposta (200):**
```json
{
  "post": { ... }
}
```

---

### 3.5 `DELETE /api/posts/[id]` – Excluir post

Remove o post permanentemente.

**Resposta (200):**
```json
{
  "success": true,
  "message": "Post excluído com sucesso."
}
```

---

### 3.6 `POST /api/posts/upload` – Upload de imagem

Faz upload de uma imagem para o Supabase Storage e retorna a URL pública para usar como `cover_image_url`.

**Headers:**
```
Authorization: Bearer <POSTS_API_KEY>
Content-Type: multipart/form-data
```

**Body (form-data):**

| Campo    | Tipo   | Obrigatório | Descrição                                      |
|----------|--------|-------------|------------------------------------------------|
| `file`   | File   | **Sim**     | Imagem (JPEG, PNG, WebP, GIF, AVIF – máx 10MB)|
| `folder` | string | Não         | Subpasta no storage (padrão: `"api-posts"`)    |

**Resposta (200):**
```json
{
  "url": "https://xxx.supabase.co/storage/v1/object/public/edashow-media/api-posts/1234567890-foto.jpg",
  "filename": "api-posts/1234567890-foto.jpg",
  "size": 204800,
  "mime_type": "image/jpeg"
}
```

---

## 4. Campos disponíveis

### Status do post

| Valor       | Significado                                          |
|-------------|------------------------------------------------------|
| `draft`     | Rascunho – visível apenas no CMS                     |
| `published` | Publicado – visível no site                          |
| `archived`  | Arquivado – fora do ar, mantido no banco             |

### Como obter IDs de categorias e colunistas

Use o endpoint de listagem de posts (`GET /api/posts`) ou consulte diretamente o CMS em `/cms/posts`.

Você também pode listar categorias consultando o Supabase ou usando a API de busca interna.

---

## 5. Exemplos por ferramenta

### 5.1 cURL

**Upload de imagem:**
```bash
curl -X POST https://seu-dominio.com.br/api/posts/upload \
  -H "Authorization: Bearer SUA_API_KEY" \
  -F "file=@/caminho/para/imagem.jpg" \
  -F "folder=api-posts"
```

**Criar post publicado:**
```bash
curl -X POST https://seu-dominio.com.br/api/posts \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Novo Show Anunciado",
    "content": "<p>Conteúdo completo do post aqui.</p>",
    "excerpt": "Resumo do post.",
    "cover_image_url": "https://xxx.supabase.co/storage/v1/object/public/edashow-media/api-posts/1234-imagem.jpg",
    "status": "published",
    "tags": ["shows", "novidades"]
  }'
```

**Atualizar status de um post:**
```bash
curl -X PUT https://seu-dominio.com.br/api/posts/UUID-DO-POST \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'
```

**Listar apenas rascunhos:**
```bash
curl "https://seu-dominio.com.br/api/posts?status=draft&limit=10" \
  -H "Authorization: Bearer SUA_API_KEY"
```

**Excluir post:**
```bash
curl -X DELETE https://seu-dominio.com.br/api/posts/UUID-DO-POST \
  -H "Authorization: Bearer SUA_API_KEY"
```

---

### 5.2 Python (requests)

```python
import requests

BASE_URL = "https://seu-dominio.com.br"
API_KEY  = "SUA_API_KEY"
HEADERS  = {"Authorization": f"Bearer {API_KEY}"}

# --- Upload de imagem ---
with open("imagem.jpg", "rb") as f:
    resp = requests.post(
        f"{BASE_URL}/api/posts/upload",
        headers=HEADERS,
        files={"file": ("imagem.jpg", f, "image/jpeg")},
        data={"folder": "api-posts"}
    )
image_url = resp.json()["url"]

# --- Criar post ---
post_data = {
    "title": "Novo Show Anunciado",
    "content": "<p>Conteúdo completo do post aqui.</p>",
    "excerpt": "Resumo do show.",
    "cover_image_url": image_url,
    "status": "published",
    "tags": ["shows", "agenda"],
    "featured_home": True,
}
resp = requests.post(f"{BASE_URL}/api/posts", headers=HEADERS, json=post_data)
post = resp.json()["post"]
print("Post criado:", post["id"], post["slug"])

# --- Atualizar post ---
update_data = {"excerpt": "Novo resumo editado."}
resp = requests.put(
    f"{BASE_URL}/api/posts/{post['id']}",
    headers=HEADERS,
    json=update_data
)

# --- Listar posts publicados ---
resp = requests.get(
    f"{BASE_URL}/api/posts",
    headers=HEADERS,
    params={"status": "published", "limit": 10}
)
print(resp.json())

# --- Excluir post ---
resp = requests.delete(f"{BASE_URL}/api/posts/{post['id']}", headers=HEADERS)
print(resp.json())
```

---

### 5.3 Node.js (fetch)

```javascript
const BASE_URL = 'https://seu-dominio.com.br'
const API_KEY  = 'SUA_API_KEY'
const headers  = { Authorization: `Bearer ${API_KEY}` }

// --- Upload de imagem (Node 18+ com FormData nativo) ---
async function uploadImage(filePath) {
  const { createReadStream, statSync } = await import('fs')
  const FormData = (await import('form-data')).default
  const form = new FormData()
  form.append('file', createReadStream(filePath))
  form.append('folder', 'api-posts')

  const res = await fetch(`${BASE_URL}/api/posts/upload`, {
    method: 'POST',
    headers: { ...headers, ...form.getHeaders() },
    body: form
  })
  return (await res.json()).url
}

// --- Criar post ---
async function createPost(imageUrl) {
  const res = await fetch(`${BASE_URL}/api/posts`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Novo Show Anunciado',
      content: '<p>Conteúdo completo aqui.</p>',
      excerpt: 'Resumo do post.',
      cover_image_url: imageUrl,
      status: 'published',
      tags: ['shows', 'novidades'],
      featured_home: false
    })
  })
  const { post } = await res.json()
  console.log('Post criado:', post.id)
  return post
}

// --- Atualizar post ---
async function updatePost(id, fields) {
  const res = await fetch(`${BASE_URL}/api/posts/${id}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  })
  return res.json()
}

// --- Execução ---
const imageUrl = await uploadImage('./foto.jpg')
const post = await createPost(imageUrl)
await updatePost(post.id, { status: 'published' })
```

---

### 5.4 n8n

O n8n pode usar o node **HTTP Request** para chamar todos os endpoints.

#### Fluxo sugerido: RSS → Upload → Criar Post

1. **Trigger:** `Schedule` ou `RSS Feed Read`
2. **HTTP Request – Upload de imagem:**
   - Method: `POST`
   - URL: `https://seu-dominio.com.br/api/posts/upload`
   - Authentication: `Header Auth` → `Authorization: Bearer SUA_API_KEY`
   - Body: `Form Data` → campo `file` com a imagem (Binary Data)
3. **Set node:** Armazene `{{ $json.url }}` como `cover_image_url`
4. **HTTP Request – Criar Post:**
   - Method: `POST`
   - URL: `https://seu-dominio.com.br/api/posts`
   - Authentication: `Header Auth` → `Authorization: Bearer SUA_API_KEY`
   - Body: `JSON`
     ```json
     {
       "title": "{{ $json.title }}",
       "content": "{{ $json.content }}",
       "excerpt": "{{ $json.excerpt }}",
       "cover_image_url": "{{ $node['Set'].json.cover_image_url }}",
       "status": "published",
       "tags": {{ $json.tags }}
     }
     ```

**Dica n8n:** Use o node `Code` para sanitizar o HTML do conteúdo antes de enviar.

---

### 5.5 Make / Zapier

**Make (Integromat):**
1. Adicione o módulo **HTTP → Make a Request**
2. URL: `https://seu-dominio.com.br/api/posts`
3. Method: `POST`
4. Headers: `Authorization: Bearer SUA_API_KEY`, `Content-Type: application/json`
5. Body: JSON com os campos desejados

**Zapier:**
1. Action: **Webhooks by Zapier → POST**
2. URL: `https://seu-dominio.com.br/api/posts`
3. Payload Type: `JSON`
4. Headers: `Authorization: Bearer SUA_API_KEY`
5. Data: campos do post

---

## 6. Códigos de erro

| HTTP | Significado                                                        |
|------|--------------------------------------------------------------------|
| 400  | Dados inválidos (campo faltando, UUID inválido, slug duplicado)    |
| 401  | Header `Authorization` ausente ou mal formatado                    |
| 403  | API key inválida                                                   |
| 404  | Post não encontrado                                                |
| 413  | Arquivo muito grande (acima de 10 MB)                              |
| 415  | Tipo de arquivo não suportado                                      |
| 500  | Erro interno do servidor (verifique logs e variáveis de ambiente)  |

**Formato de erro:**
```json
{
  "error": "Mensagem descritiva do erro.",
  "code": "23505"
}
```

---

## 7. IDs úteis

Para usar `category_id` e `columnist_id` você precisa dos UUIDs cadastrados no banco.

**Via CMS:** Acesse `/cms` → Categories / Columnists e copie o ID da URL ao editar.

**Via API (listagem de posts):**
```bash
curl "https://seu-dominio.com.br/api/posts?status=published&limit=1" \
  -H "Authorization: Bearer SUA_API_KEY"
```
A resposta inclui `category.id` e `author.id` que você pode reutilizar.

**Via Supabase Dashboard:** Project → Table Editor → `categories` ou `columnists` → coluna `id`.

---

## Resumo rápido

```
POST   /api/posts/upload    → Upload de imagem, retorna URL
GET    /api/posts           → Lista posts (filtros opcionais)
POST   /api/posts           → Cria novo post
GET    /api/posts/:id       → Busca post por ID
PUT    /api/posts/:id       → Atualiza post (parcialmente)
DELETE /api/posts/:id       → Exclui post
```

Todos os endpoints exigem o header `Authorization: Bearer <POSTS_API_KEY>`.
