# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database & Scripts
```bash
npm run check:env    # Verify environment variables
npm run test:db      # Test database connection
npm run seed:posts   # Seed example posts to database

# Migration scripts (use with caution)
npm run export:mongodb         # Export data from MongoDB
npm run import:postgres        # Import to PostgreSQL/Supabase
npm run migrate:images         # Migrate images to Supabase Storage
npm run migrate:fallback-posts # Migrate fallback posts
npm run reset:admin           # Reset admin user
npm run diagnose:admin        # Diagnose admin access issues
```

### Deploy
```bash
./deploy.sh           # Automated deploy script (recommended)
vercel --prod         # Deploy to production
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: Supabase PostgreSQL (primary) - formerly MongoDB
- **CMS**: Custom admin interface at `/cms` with Supabase backend
- **Storage**: Supabase Storage (S3-compatible)
- **UI**: React 19, Tailwind CSS 4, Radix UI components
- **Deploy**: Vercel

### Data Layer Architecture

The project uses a **Supabase-first architecture** with multiple client patterns:

1. **Public Client** (`lib/supabase/public-client.ts`)
   - Read-only operations for frontend
   - Uses anonymous key
   - Fetches published content

2. **Server Client** (`lib/supabase/server.ts`)
   - Server-side operations with service role
   - Bypasses RLS for admin operations
   - Used in API routes and server components

3. **Browser Client** (`lib/supabase/client.ts`)
   - Client-side auth operations
   - User session management

4. **Data API Layer** (`lib/supabase/api.ts`)
   - Normalized data fetching functions
   - Type-safe queries with relationships
   - Error handling and fallbacks
   - Key functions: `getPosts()`, `getPostBySlug()`, `getCategories()`, `getSponsors()`, `getEvents()`

### Database Schema (Supabase)

**Main Tables**:
- `posts` - Content with relationships to categories/columnists
- `categories` - Content categorization
- `columnists` - Authors with social media links
- `sponsors` - Sponsor information with logos
- `events` - Event management
- `theme_settings` - Site configuration
- `user_roles` - User role management (admin/editor)

**Relationships**:
- Posts → Categories (many-to-one via `category_id`)
- Posts → Columnists (many-to-one via `author_id`)
- Posts cover images stored in Supabase Storage

### Authentication & Authorization

**Auth Flow** (middleware.ts):
- Supabase Auth for user management
- Row Level Security (RLS) in Supabase
- Role-based access control via `user_roles` table
- CMS routes (`/cms/*`) protected by middleware
- Remember-me functionality with session cookies

**Protected Routes**:
- `/cms` - Requires admin/editor role
- `/cms/dashboard` - Authenticated admin area
- `/cms/posts` - Post management
- Automatic redirect to `/cms/login` if unauthorized

### Next.js App Router Structure

```
app/
├── (frontend)/              # Public pages
│   ├── page.tsx            # Homepage with dynamic content
│   ├── posts/              # Post listing and detail pages
│   ├── [category-slug]/    # Dynamic category pages
│   └── institutional/      # Static pages (sobre, privacidade)
├── (cms)/                  # Admin interface
│   ├── login/              # Login page
│   ├── dashboard/          # Admin dashboard
│   └── posts/              # Post management
├── api/                    # API routes
│   └── search/             # Search functionality
├── layout.tsx              # Root layout with metadata
└── globals.css             # Global styles
```

**Key Patterns**:
- Server Components for SEO and performance
- Client Components for interactivity (marked with `'use client'`)
- Dynamic metadata generation in `layout.tsx` from database
- API routes for complex operations (search)

### CMS Admin Interface

**Custom CMS** (not Payload CMS anymore):
- `/cms/login` - Authentication page
- `/cms/dashboard` - Main admin dashboard
- `/cms/posts` - Post management with rich text editor
- TipTap editor for rich text content
- Direct Supabase integration for CRUD operations
- Real-time preview of published posts

**Note**: Project was previously using Payload CMS (see INTEGRACAO_PAYLOAD.md), but migrated to custom Supabase-based CMS. Payload config may still exist but is not actively used.

### Image Handling

**Storage Strategy**:
- Supabase Storage (S3-compatible) for all images
- Bucket name: `media` (configurable via `SUPABASE_BUCKET`)
- Multiple sizes: thumbnail, card, tablet
- Fallback mechanism for missing images
- Image URLs stored as strings in database

**Environment Variables for Storage**:
```
SUPABASE_BUCKET=media
SUPABASE_REGION=us-east-1
SUPABASE_ENDPOINT=https://xxxx.supabase.co/storage/v1/s3
SUPABASE_ACCESS_KEY_ID=xxxx
SUPABASE_SECRET_ACCESS_KEY=xxxx
```

### Environment Configuration

**Required Variables**:
```env
# Database (Supabase PostgreSQL)
DATABASE_URI=postgresql://user:password@hostname:5432/dbname?sslmode=require

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Storage
SUPABASE_BUCKET=media
SUPABASE_REGION=us-east-1
SUPABASE_ENDPOINT=https://xxxx.supabase.co/storage/v1/s3
SUPABASE_ACCESS_KEY_ID=xxxx
SUPABASE_SECRET_ACCESS_KEY=xxxx

# Site URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # or production URL
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

**Validation**: Use `npm run check:env` to verify configuration

### Automated Post Generation (cron)

**Canonical pipeline**: Vercel Cron `GET /api/cron/daily-posts` (`vercel.json`, 11:00 UTC). GitHub Actions `generate-posts` and `cowork-news` are manual-only (`workflow_dispatch`).

**Feature flags**:
- `ENABLE_DAILY_POSTS=true` — cron daily-posts (image-bank → Pexels/Unsplash)
- `ENABLE_POST_GENERATION=true` — CMS `/cms/ia` and cowork-news; cron uses `context: 'daily-cron'` and only needs `ENABLE_DAILY_POSTS`

**Tuning**: `DAILY_KEYWORD_COUNT` (default 3), `KEYWORD_COOLDOWN_DAYS` (default 60). Keyword history in `post_generation_log` (`lib/post-generation/`).

**Covers**: `pickImageForKeyword()` → live stock fallback. Weekly refill: `/api/cron/seed-image-bank` (Sunday 06:00 UTC).

**Production DB gotcha**: `posts.id` is `integer` and status uses enum `enum_posts_status` (includes `cold`). Migration `20260702_post_generation_log.sql` handles both legacy enum and baseline CHECK constraint.

### Migration History

The codebase has migrated from **MongoDB → PostgreSQL (Supabase)**:
- Previous: Payload CMS + MongoDB
- Current: Custom CMS + Supabase PostgreSQL
- Migration scripts available in `/scripts/`
- Fallback data systems for reliability
- Evidence of transition in documentation files

### Build Configuration

**Notable Settings** (next.config.mjs):
- Server actions body size limit: 10mb
- Image optimization disabled (using Supabase Storage)
- TypeScript errors ignored during build
- Webpack optimizations for Supabase libraries
- Package imports optimized for `@supabase/supabase-js` and `@supabase/ssr`

### Component Architecture

**Component Organization**:
```
components/
├── ui/                    # Radix UI primitives
├── cms/                   # Admin interface components
│   ├── MediumEditor.tsx   # Rich text editor
│   ├── PostEditor.tsx     # Post creation/editing
│   └── SettingsDrawer.tsx  # Admin settings
├── layout/                # Layout components (header, footer)
├── content/               # Content display (PostCard, PostList)
├── marketing/             # Sponsor and marketing components
└── shared/                # Reusable UI elements
```

**Key Patterns**:
- Server Components for data fetching
- Client Components for interactivity
- Clear separation between UI and business logic
- Type-safe props with TypeScript

### SEO & Metadata

**Dynamic Metadata** (app/layout.tsx):
- Site settings fetched from `theme_settings` table
- Open Graph configuration for social sharing
- Dynamic title, description, and keywords
- Favicon configuration
- Twitter card support

**URL Configuration**:
- `NEXT_PUBLIC_SITE_URL` - Used for OG tags and canonical URLs
- Must be updated for production deployments

### Testing Database Connection

```bash
# Quick test
npm run test:db

# Full environment check
npm run check:env

# Diagnose admin access
npm run diagnose:admin
```

### Troubleshooting

**Common Issues**:
1. **Database connection**: Verify `DATABASE_URI` and Supabase credentials
2. **Images not loading**: Check Supabase Storage credentials and bucket configuration
3. **CMS login failures**: Verify user has role in `user_roles` table
4. **Build failures**: Check TypeScript and environment variables

**Useful Scripts**:
- `reset-admin.ts` - Reset admin user credentials
- `diagnose-admin.ts` - Diagnose admin access issues
- `fix-rls.ts` - Fix Row Level Security policies

## Development Workflow

1. **Start development**: `npm run dev`
2. **Access admin**: http://localhost:3000/cms
3. **Create content**: Use CMS editor at `/cms/posts`
4. **View changes**: Refresh homepage at http://localhost:3000
5. **Test build**: `npm run build`
6. **Deploy**: `./deploy.sh` or `vercel --prod`

## Key Files to Understand

- `lib/supabase/api.ts` - Data fetching layer
- `middleware.ts` - Auth and route protection
- `app/layout.tsx` - Root layout and metadata
- `app/api/search/route.ts` - Search API example
- `components/cms/PostEditor.tsx` - Content editing interface
- `next.config.mjs` - Build configuration
- `.env.example` - Environment variable template
- `app/api/cron/daily-posts/route.ts` - Automated post generation cron
- `lib/post-generation/` - Keyword cooldown and generation log
