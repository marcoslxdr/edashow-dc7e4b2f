import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export async function GET() {
    try {
        const rows = await sql`SELECT * FROM theme_settings LIMIT 1`
        const theme = rows[0]

        if (!theme) {
            return NextResponse.json({
                themeColors: { primary: '#FF6F00', background: '#ffffff', foreground: '#0f172a' },
                site_name: 'EDA Show',
                site_description: 'Portal editorial do mercado de saúde suplementar'
            })
        }

        return NextResponse.json({
            themeColors: {
                primary: theme.light_primary,
                background: theme.light_background,
                foreground: theme.light_foreground,
                darkModeColors: { darkBackground: theme.dark_background, darkForeground: theme.dark_foreground }
            },
            typography: { borderRadius: '0.5rem', fontHeading: theme.font_heading, fontBody: theme.font_body },
            socialMedia: theme.social_media || {},
            site_name: theme.site_name,
            site_slogan: theme.site_slogan,
            site_description: theme.site_description,
            logo_url: theme.logo_url,
            site_favicon_url: theme.site_favicon_url,
            contact: { email: theme.contact_email, phone: theme.contact_phone, address: theme.contact_address },
            seo: { keywords: theme.seo_keywords, googleAnalyticsId: theme.google_analytics_id, googleTagManagerId: theme.google_tag_manager_id },
            branding: {
                colors: {
                    light: { primary: theme.light_primary, secondary: theme.light_secondary, background: theme.light_background, foreground: theme.light_foreground },
                    dark: { primary: theme.dark_primary, secondary: theme.dark_secondary, background: theme.dark_background, foreground: theme.dark_foreground }
                }
            },
            maintenance: { enabled: theme.maintenance_mode, message: theme.maintenance_message },
            footer: { text: theme.footer_text, copyright: theme.footer_copyright }
        })
    } catch (error) {
        console.error('[API Site Settings] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
