-- ============================================
-- Galeria de Fotos de Eventos
-- ============================================

-- Tabela de galerias vinculadas a eventos
CREATE TABLE IF NOT EXISTS event_photo_galleries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Galeria de Fotos',
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    contact_email TEXT,
    contact_whatsapp TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id)
);

-- Tabela de fotos dentro de uma galeria
CREATE TABLE IF NOT EXISTS event_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gallery_id UUID NOT NULL REFERENCES event_photo_galleries(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    watermarked_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_event_photo_galleries_event_id ON event_photo_galleries(event_id);
CREATE INDEX IF NOT EXISTS idx_event_photos_gallery_id ON event_photos(gallery_id);

-- Enable RLS
ALTER TABLE event_photo_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

-- Policies para event_photo_galleries
CREATE POLICY "Allow public read galleries"
    ON event_photo_galleries FOR SELECT
    TO anon, authenticated
    USING (is_public = true);

CREATE POLICY "Allow admin full access galleries"
    ON event_photo_galleries FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- Policies para event_photos
CREATE POLICY "Allow public read photos"
    ON event_photos FOR SELECT
    TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM event_photo_galleries
        WHERE event_photo_galleries.id = event_photos.gallery_id
        AND event_photo_galleries.is_public = true
    ));

CREATE POLICY "Allow admin full access photos"
    ON event_photos FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_event_photo_galleries_updated_at ON event_photo_galleries;
CREATE TRIGGER update_event_photo_galleries_updated_at
    BEFORE UPDATE ON event_photo_galleries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
