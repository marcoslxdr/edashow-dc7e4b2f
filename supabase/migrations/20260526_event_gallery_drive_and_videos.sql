-- Link de download das fotos no Google Drive (galeria do evento)
ALTER TABLE event_photo_galleries
    ADD COLUMN IF NOT EXISTS drive_download_url TEXT;

COMMENT ON COLUMN event_photo_galleries.drive_download_url IS
    'URL pública do Google Drive para download das fotos em alta qualidade';

-- Vídeos do evento (YouTube ou Instagram)
CREATE TABLE IF NOT EXISTS event_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram')),
    video_url TEXT NOT NULL,
    title TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_videos_event_id ON event_videos(event_id);

ALTER TABLE event_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read event videos" ON event_videos;
CREATE POLICY "Allow public read event videos"
    ON event_videos FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow cms full access event videos" ON event_videos;
CREATE POLICY "Allow cms full access event videos"
    ON event_videos FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'editor')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'editor')
    ));
