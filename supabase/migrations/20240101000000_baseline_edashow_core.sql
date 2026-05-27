-- Baseline schema (core CMS tables) — projeto EdaShow
-- Aplicar antes das demais migrações em supabase/migrations/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Columnists
CREATE TABLE IF NOT EXISTS public.columnists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    bio TEXT,
    photo_url TEXT,
    linkedin_url TEXT,
    instagram_url TEXT,
    twitter_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Media library
CREATE TABLE IF NOT EXISTS public.media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    alt TEXT,
    caption TEXT,
    mime_type TEXT,
    filesize BIGINT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    slug TEXT NOT NULL UNIQUE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    columnist_id UUID REFERENCES public.columnists(id) ON DELETE SET NULL,
    cover_image_url TEXT,
    content TEXT,
    tags TEXT[] DEFAULT '{}'::text[],
    featured_home BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    excerpt TEXT,
    source_url TEXT,
    featured_image_id UUID REFERENCES public.media(id) ON DELETE SET NULL,
    author_id UUID,
    last_editor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT posts_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published_at ON public.posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts(slug);

-- Events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    event_date DATE,
    location TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'upcoming',
    registration_url TEXT,
    cover_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date DESC);

-- Theme settings (single-row style config)
CREATE TABLE IF NOT EXISTS public.theme_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logo_main_url TEXT,
    logo_alt_url TEXT,
    light_primary TEXT,
    light_background TEXT,
    light_foreground TEXT,
    dark_primary TEXT,
    dark_background TEXT,
    dark_foreground TEXT,
    typography_preset TEXT DEFAULT 'default',
    social_media JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- CMS roles (links to auth.users)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'editor')),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_columnists_updated_at ON public.columnists;
CREATE TRIGGER set_columnists_updated_at
    BEFORE UPDATE ON public.columnists
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_media_updated_at ON public.media;
CREATE TRIGGER set_media_updated_at
    BEFORE UPDATE ON public.media
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_events_updated_at ON public.events;
CREATE TRIGGER set_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_theme_settings_updated_at ON public.theme_settings;
CREATE TRIGGER set_theme_settings_updated_at
    BEFORE UPDATE ON public.theme_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columnists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Public read policies
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read columnists" ON public.columnists;
CREATE POLICY "Public read columnists" ON public.columnists FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read media" ON public.media;
CREATE POLICY "Public read media" ON public.media FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read published posts" ON public.posts;
CREATE POLICY "Public read published posts" ON public.posts FOR SELECT TO anon, authenticated
    USING (status = 'published');

DROP POLICY IF EXISTS "Public read events" ON public.events;
CREATE POLICY "Public read events" ON public.events FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read theme_settings" ON public.theme_settings;
CREATE POLICY "Public read theme_settings" ON public.theme_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users read own role" ON public.user_roles;
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- CMS admin/editor policies
DROP POLICY IF EXISTS "CMS manage categories" ON public.categories;
CREATE POLICY "CMS manage categories" ON public.categories FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')));

DROP POLICY IF EXISTS "CMS manage columnists" ON public.columnists;
CREATE POLICY "CMS manage columnists" ON public.columnists FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')));

DROP POLICY IF EXISTS "CMS manage media" ON public.media;
CREATE POLICY "CMS manage media" ON public.media FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')));

DROP POLICY IF EXISTS "CMS manage posts" ON public.posts;
CREATE POLICY "CMS manage posts" ON public.posts FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')));

DROP POLICY IF EXISTS "CMS manage events" ON public.events;
CREATE POLICY "CMS manage events" ON public.events FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')));

DROP POLICY IF EXISTS "CMS manage theme_settings" ON public.theme_settings;
CREATE POLICY "CMS manage theme_settings" ON public.theme_settings FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'editor')));

-- Service role bypass (admin scripts)
DROP POLICY IF EXISTS "Service role all categories" ON public.categories;
CREATE POLICY "Service role all categories" ON public.categories FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role all columnists" ON public.columnists;
CREATE POLICY "Service role all columnists" ON public.columnists FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role all media" ON public.media;
CREATE POLICY "Service role all media" ON public.media FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role all posts" ON public.posts;
CREATE POLICY "Service role all posts" ON public.posts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role all events" ON public.events;
CREATE POLICY "Service role all events" ON public.events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role all theme_settings" ON public.theme_settings;
CREATE POLICY "Service role all theme_settings" ON public.theme_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role all user_roles" ON public.user_roles;
CREATE POLICY "Service role all user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
