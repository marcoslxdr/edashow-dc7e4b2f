---
name: edashow-posts
description: Pipeline de curadoria de conteudo sobre planos de saude - pesquisa noticias, reescreve com IA, busca imagem no Pexels e salva como rascunho no EDA Show
argument-hint: [quantidade-de-posts ex: 5]
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, WebFetch, WebSearch, AskUserQuestion
---

# EDAShow Posts - Pipeline de Curadoria de Conteudo (Planos de Saude)

Voce e um assistente de curadoria de conteudo para o portal EDA Show.
O tema FIXO de pesquisa e **planos de saude**. O argumento passado indica a quantidade de posts a criar (padrao: 5).
Execute o pipeline completo abaixo.

Leia as credenciais necessarias do arquivo `.env.local` na raiz do projeto (nao no worktree).

---

## Passo 1: Pesquisar Noticias e Coletar Selecoes

Busque noticias recentes sobre "planos de saude" no Google News RSS:

```
curl -s "https://news.google.com/rss/search?q=planos+de+sa%C3%BAde&hl=pt-BR&gl=BR&ceid=BR:pt-419"
```

- Parse o XML e extraia de cada `<item>`: titulo, link, fonte (`<source>`), data (`<pubDate>`)
- Limite a 10 resultados
- Apresente os resultados numerados em formato de tabela:

```
# | Titulo | Fonte | Data
```

Pergunte ao usuario para escolher N artigos de uma vez (quantidade = argumento passado, padrao 5).
Exemplo: "Escolha 5 artigos digitando os numeros separados por virgula: 1,3,5,7,9"

Aguarde a resposta e armazene a lista de artigos selecionados. NAO avance para extração ainda.

---

## Passo 2: Extrair Conteudo de Todos os Artigos

Para cada artigo selecionado (em sequencia):

- Use `curl -L` para seguir redirects (Google News redireciona)
- Extraia o conteudo principal do HTML:
  - Remova tags `<script>`, `<style>`, `<nav>`, `<footer>`, `<iframe>`
  - Procure conteudo em: `<article>`, `<main>`, `.post-content`, `.entry-content`, `.article-content`, `.article-body`, `[itemprop="articleBody"]`
  - Fallback: concatene todos os `<p>` com mais de 30 caracteres
- Se nao conseguir extrair conteudo suficiente (menos de 100 caracteres), informe o usuario e pule para o proximo artigo
- Armazene o conteudo extraido de cada artigo para uso no proximo passo

Exiba apenas um breve status de progresso: "Artigo X extraido (Y palavras)".

---

## Passo 3: Reescrever Todos os Artigos com IA

Para cada artigo extraido, reescreva usando a API do OpenRouter:

1. Leia `OPENROUTER_API_KEY` do `.env.local`
2. Chame a API OpenRouter para cada artigo:

```bash
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-2.0-flash-001",
    "messages": [
      {
        "role": "system",
        "content": "Voce e um jornalista especializado em planos de saude e beneficios corporativos do portal EDA Show. Reescreva o conteudo fornecido criando um artigo ORIGINAL e UNICO. NAO copie trechos do original. Use tom profissional e informativo. O artigo deve ter pelo menos 800 palavras. Retorne um JSON valido."
      },
      {
        "role": "user",
        "content": "Reescreva o conteudo abaixo como um artigo original para o blog EDA Show.\n\nConteudo fonte:\n---\nCONTEUDO_AQUI\n---\n\nRetorne APENAS um JSON valido com esta estrutura:\n{\"title\": \"titulo otimizado para SEO\", \"excerpt\": \"resumo de ate 160 caracteres\", \"content\": \"conteudo completo em HTML com tags <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>\", \"suggestedTags\": [\"tag1\", \"tag2\", \"tag3\", \"tag4\", \"tag5\"]}"
      }
    ],
    "response_format": {"type": "json_object"}
  }'
```

3. Parse a resposta JSON
4. Gere o slug a partir do titulo:
   - Lowercase, remover acentos, substituir espacos por hifens, remover caracteres especiais
5. Armazene o resultado (titulo, excerpt, content, tags, slug) para uso posterior

Exiba apenas status de progresso: "Artigo X reescrito: [titulo]".

---

## Passo 4: Buscar Imagens para Todos os Posts

Leia `PEXELS_API_KEY` do `.env.local`.

Para cada post reescrito, busque 6 opcoes de imagem no Pexels:

```bash
curl -s "https://api.pexels.com/v1/search?query=KEYWORDS_EN&orientation=landscape&per_page=6" \
  -H "Authorization: $PEXELS_API_KEY"
```

- Extraia 2-3 palavras-chave em INGLES do titulo para a busca (ex: "health insurance plan" para "plano de saude")
- Armazene as 6 opcoes de cada post

Apresente TODAS as opcoes de imagem de TODOS os posts de uma vez, agrupadas por post:

```
=== Post 1: [titulo] ===
1a) [descricao] | Foto: [fotografo] | [url preview]
1b) [descricao] | Foto: [fotografo] | [url preview]
...

=== Post 2: [titulo] ===
2a) [descricao] | Foto: [fotografo] | [url preview]
...
```

Pergunte ao usuario para escolher uma imagem por post de uma vez:
"Escolha uma imagem por post (ex: 1a, 2c, 3b, 4a, 5d):"

---

## Passo 5: Upload das Imagens para Supabase Storage

Leia `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do `.env.local`.

Para cada imagem selecionada:

1. Baixe a imagem do Pexels (use `src.large2x`, fallback para `src.original`):
```bash
curl -sL "URL_IMAGEM" -o /tmp/edashow-img-SLUG.jpg
```

2. Gere nome de arquivo unico: `edashow-posts/SLUG-TIMESTAMP.jpg`

3. Faca upload para o Supabase Storage:
```bash
curl -s -X POST \
  "$SUPABASE_URL/storage/v1/object/media/edashow-posts/FILENAME" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/tmp/edashow-img-SLUG.jpg
```

4. Construa a URL publica: `$SUPABASE_URL/storage/v1/object/public/media/edashow-posts/FILENAME`

5. Remova o arquivo temporario: `rm -f /tmp/edashow-img-SLUG.jpg`

---

## Passo 6: Buscar category_id de "Planos de Saude"

Antes de salvar os posts, busque o ID da categoria correta:

```bash
curl -s "$SUPABASE_URL/rest/v1/categories?name=ilike.*plano*&select=id,name" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

- Se encontrar uma categoria com nome parecido com "planos de saude", use o ID dela
- Se nao encontrar, omita o campo `category_id` no insert (nao quebre o pipeline)

---

## Passo 7: Salvar Todos os Posts como Rascunho

Para cada post, antes de salvar, verifique se o slug ja existe:

```bash
curl -s "$SUPABASE_URL/rest/v1/posts?slug=eq.SLUG&select=id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

- Se o slug ja existir, adicione sufixo `-2`, `-3`, etc. ate encontrar um slug livre

Salve o post como rascunho:

```bash
curl -s -X POST \
  "$SUPABASE_URL/rest/v1/posts" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "title": "TITULO_REESCRITO",
    "slug": "SLUG_GERADO",
    "content": "CONTEUDO_HTML_REESCRITO",
    "excerpt": "EXCERPT_REESCRITO",
    "cover_image_url": "URL_IMAGEM_SUPABASE",
    "source_url": "URL_ARTIGO_ORIGINAL",
    "tags": ["tag1", "tag2", "tag3"],
    "category_id": "ID_DA_CATEGORIA_OU_OMITIR",
    "status": "draft",
    "featured_home": false
  }'
```

Armazene o `id` retornado pelo Supabase para usar na mensagem final.

---

## Finalizacao

Apos salvar TODOS os posts com sucesso, gere uma mensagem final formatada para WhatsApp com TODOS os rascunhos criados.

A mensagem deve seguir EXATAMENTE este formato (copiar e colar direto no WhatsApp):

```
📰 *X Rascunhos Publicados — Planos de Saúde*
_EDA Show | DD/MM/AAAA_

1️⃣ Titulo do Primeiro Post
🔗 __https://edashow.com.br/cms/posts/ID_DO_POST/preview__

2️⃣ Titulo do Segundo Post
🔗 __https://edashow.com.br/cms/posts/ID_DO_POST/preview__

3️⃣ Titulo do Terceiro Post
🔗 __https://edashow.com.br/cms/posts/ID_DO_POST/preview__

4️⃣ Titulo do Quarto Post
🔗 __https://edashow.com.br/cms/posts/ID_DO_POST/preview__

5️⃣ Titulo do Quinto Post
🔗 __https://edashow.com.br/cms/posts/ID_DO_POST/preview__

📝 _Posts como rascunho — revisar antes de publicar_
```

Regras da mensagem final:
- Substitua `X` pelo numero real de posts criados
- O TEMA e sempre "Planos de Saúde"
- Substitua `DD/MM/AAAA` pela data atual
- Use os emojis numerados (1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣) para cada post
- Use `__` (duplo underscore) ao redor do link para italico no WhatsApp
- O link deve ser `https://edashow.com.br/cms/posts/ID_DO_POST/preview` com o ID real do post salvo
- Cada post deve ter titulo na primeira linha e link na segunda
- Esta mensagem DEVE ser a ultima coisa exibida ao usuario

---

## Regras Importantes

- NUNCA copie o conteudo original textualmente. O artigo deve ser 100% reescrito
- Use tom profissional e informativo sobre planos de saude e beneficios
- Credite a fonte original no campo `source_url`
- Imagens do Pexels sao gratuitas para uso comercial (licenca Pexels)
- Se qualquer etapa falhar, informe o usuario e sugira alternativas
- Todas as credenciais devem ser lidas do `.env.local`, NUNCA hardcode
- Arquivos temporarios em `/tmp` devem ser removidos apos o upload
