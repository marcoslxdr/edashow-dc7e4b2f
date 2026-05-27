-- Enhance sponsors table with additional fields
-- Add active status, display order, and description

-- Add active column (default true for existing sponsors)
ALTER TABLE public.sponsors 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true NOT NULL;

-- Add display_order column for controlling carousel order
ALTER TABLE public.sponsors 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add description column for sponsor details
ALTER TABLE public.sponsors 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Legacy Payload media reference (opcional)
ALTER TABLE public.sponsors
ADD COLUMN IF NOT EXISTS logo_id UUID;

-- Update existing sponsors to have sequential display_order
DO $$
DECLARE
    sponsor_record RECORD;
    counter INTEGER := 1;
BEGIN
    FOR sponsor_record IN 
        SELECT id FROM public.sponsors ORDER BY created_at
    LOOP
        UPDATE public.sponsors 
        SET display_order = counter 
        WHERE id = sponsor_record.id AND display_order = 0;
        counter := counter + 1;
    END LOOP;
END $$;

-- Create index for better performance on active sponsors query
CREATE INDEX IF NOT EXISTS idx_sponsors_active_order 
ON public.sponsors(active, display_order);

-- Update RLS policies to include active field
-- The existing policies should still work, but we can add a specific one for public reads
DROP POLICY IF EXISTS "Enable read access for all users" ON public.sponsors;

CREATE POLICY "Enable read access for all users" ON public.sponsors
    FOR SELECT TO public USING (true);

-- Keep the service role policy for admin access
-- (already exists from previous migration)
