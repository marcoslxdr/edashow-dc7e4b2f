-- Image bank for automated post covers (Pexels/Unsplash, categorized)
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

DROP POLICY IF EXISTS image_bank_categories_service ON public.image_bank_categories;
CREATE POLICY image_bank_categories_service ON public.image_bank_categories
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS image_bank_assets_service ON public.image_bank_assets;
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
