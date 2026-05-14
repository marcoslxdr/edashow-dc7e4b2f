-- Criar buckets para fotos de eventos
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES 
    ('event-photos-original', 'event-photos-original', false, false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('event-photos-public', 'event-photos-public', true, false, 10485760, ARRAY['image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- Policy: anon pode ler bucket publico
CREATE POLICY "Allow public read public photos"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'event-photos-public');

-- Policy: authenticated users can manage objects in both buckets
CREATE POLICY "Allow authenticated full access photo buckets"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id IN ('event-photos-original', 'event-photos-public'))
    WITH CHECK (bucket_id IN ('event-photos-original', 'event-photos-public'));
