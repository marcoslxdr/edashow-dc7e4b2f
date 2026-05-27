-- Posts vinculados a eventos (cobertura editorial)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_event_id ON public.posts(event_id);

COMMENT ON COLUMN public.posts.event_id IS 'Evento associado à cobertura editorial (opcional)';
