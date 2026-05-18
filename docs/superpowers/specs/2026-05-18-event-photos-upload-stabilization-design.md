# Galeria de eventos — Estabilização do upload (WebP + marca d’água)

> **Data:** 2026-05-18  
> **Status:** Aguardando revisão final  
> **Base:** Estende e corrige o desenho em [`2026-05-14-galeria-fotos-eventos-design.md`](./2026-05-14-galeria-fotos-eventos-design.md) sem alterar o modelo mental (buckets, tabelas, rota pública, CMS).

---

## 1. Objetivo

Garantir que o upload de fotos no CMS seja **confiável** (erros tratados, saída consistente) e **evoluído** com parâmetros ajustáveis de compressão WebP e marca d’água, incluindo opção de aplicar marca também na **thumbnail**.

---

## 2. Escopo

### 2.1 Corrigir (A)

- Reproduzir falhas atuais (upload, sharp, storage) e corrigir causas raiz.
- Ajustar o pipeline **Sharp** para ordem correta: leitura do buffer → (orientação EXIF, se necessário) → `resize` → `composite` (marca) → codificação **WebP** na versão pública. A codificação WebP não deve preceder o composite de forma que quebre o resultado ou gere erros em runtime.
- Garantir que `public/watermark-logo.png` exista ou retornar erro explícito ao administrador (mensagem clara).
- Alinhar implementação à especificação de 2026-05-14 quanto à **opacidade ~35%** da marca: se o asset não tiver alpha, aplicar opacidade via Sharp (ex.: `ensureAlpha` + ajuste de canal ou `composite` com opacidade suportada pela versão do Sharp em uso).
- Tratar falhas parciais em lote de forma documentada: após implementação, o plano deve indicar se uploads anteriores no mesmo lote exigem limpeza manual ou se há compensação (transação lógica); não deixar requisito ambíguo no plano.

### 2.2 Evoluir (B)

- Expor constantes de processamento de forma centralizada, com **valores default** iguais aos atuais (ou aos acordados no plano), permitindo override via **variáveis de ambiente** (documentadas em `.env.example`), por exemplo:
  - largura máxima da versão pública (ex.: 1600);
  - largura da thumbnail (ex.: 400);
  - qualidade WebP público / thumb;
  - percentual da largura da imagem usado para dimensionar a logo (ex.: 12%);
  - padding em pixels entre marca e borda (ex.: 24);
  - `gravity` da marca (default `southeast`);
  - flag **booleana** para aplicar ou não a marca na thumbnail (default: **não**, preservando comportamento atual até opt-in explícito via env).

### 2.3 Fora de escopo

- Fila assíncrona ou worker dedicado para processamento.
- Painel CMS para editar parâmetros no banco (evitar escopo do item “config no DB” neste incremento).

---

## 3. Arquitetura

- **Orquestração:** permanece em `uploadEventPhotos` (`lib/actions/cms-event-photos.ts`), usando `createAdminClient()` e os buckets `event-photos-original` e `event-photos-public`.
- **Derivados:** duas saídas WebP no bucket público (full com marca; thumb com marca opcional); original intacto no bucket privado, com extensão/tipo de entrada preservados.
- **Config:** módulo interno ou bloco no topo do mesmo arquivo com leitura de `process.env.*` e defaults — sem novo subsistema até que surja necessidade.

---

## 4. Fluxo de processamento (versão pública)

1. Validar MIME e tamanho (mantém limites existentes salvo ajuste explícito no plano).
2. Upload do original para `event-photos-original` (como hoje).
3. Pipeline Sharp na cópia em memória: orientação → resize (largura máx., `withoutEnlargement`) → composite da logo redimensionada → WebP (qualidade configurável).
4. Thumbnail: resize → [composite opcional com logo proporcionalmente menor] → WebP.
5. Upload dos buffers WebP para `event-photos-public` com paths estáveis (`*_public.webp`, `*_thumb.webp`).
6. `INSERT` em `event_photos` com as três URLs.

---

## 5. Erros e UX

- Erros de validação: mensagens em português, específicas por arquivo quando em lote.
- Erro de asset de marca ausente: falhar antes do loop ou no primeiro uso, com mensagem operacional (“adicione `public/watermark-logo.png`”).
- Logs no servidor conforme padrão do projeto (sem vazar segredos).

---

## 6. Testes

- Cobertura mínima acordada na sessão de brainstorming: teste ou script que valide geração WebP e dimensões esperadas a partir de um buffer de fixture; smoke manual no CMS (JPG + PNG).
- Regressão: exclusão de foto e de galeria continua removendo os três objetos no storage.

---

## 7. Arquivos previstos (implementação)

| Ação | Arquivo |
|------|---------|
| Modificar | `lib/actions/cms-event-photos.ts` — pipeline, config, opacidade, thumb opcional |
| Modificar | `.env.example` — novas variáveis opcionais |
| Opcional | `lib/**/event-photo-processing.ts` — extrair helpers se o arquivo ficar denso |
| Opcional | `__tests__/**` ou script em `scripts/` — conforme padrão do repositório |

---

## 8. Compatibilidade com spec 2026-05-14

Este documento **não** exige mudança de schema nem de rotas. Substitui apenas a descrição normativa do passo “processa com sharp” onde a ordem das operações e a opacidade devem coincidir com a §5 do documento base. Qualquer divergência remanescente deve ser tratada no plano de implementação como tarefa explícita.

---

## Self-review (2026-05-18)

- **Placeholders:** nenhum TBD intencional; “conforme padrão do repositório” para local do teste é aceitável e será resolvido no plano.
- **Consistência:** buckets e tabelas alinhados ao spec base; thumb sem marca continua default.
- **Escopo:** único incremento implementável em um plano; sem fila/DB config.
- **Ambiguidade:** falhas parciais em lote — explicitado que o **plano** deve fechar a estratégia (código ou runbook).
