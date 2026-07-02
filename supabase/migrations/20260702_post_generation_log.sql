-- Log de keywords/pipelines usados na geração automática (anti-repetição)
CREATE TABLE IF NOT EXISTS public.post_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  post_id INTEGER REFERENCES public.posts(id) ON DELETE SET NULL,
  pipeline TEXT NOT NULL DEFAULT 'keyword' CHECK (pipeline IN ('keyword', 'news', 'cold', 'manual')),
  image_source TEXT,
  duration_ms INTEGER,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_post_generation_log_keyword_used
  ON public.post_generation_log(keyword, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_generation_log_run_date
  ON public.post_generation_log(run_date DESC);

ALTER TABLE public.post_generation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_generation_log_service ON public.post_generation_log;
CREATE POLICY post_generation_log_service ON public.post_generation_log
  FOR ALL USING (true) WITH CHECK (true);

-- Banco frio: posts pré-gerados aguardando promoção para draft
-- Produção legada usa enum_posts_status; baseline usa CHECK em posts.status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_posts_status') THEN
    ALTER TYPE enum_posts_status ADD VALUE IF NOT EXISTS 'cold';
  ELSE
    ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;
    ALTER TABLE public.posts ADD CONSTRAINT posts_status_check
      CHECK (status IN ('draft', 'published', 'archived', 'cold'));
  END IF;
END $$;
