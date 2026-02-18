/**
 * Fix missing logo_url column in theme_settings table
 *
 * Run with: npm run fix:logo-url-column
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const columns = [
    { name: 'logo_url', sql: 'ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS logo_url TEXT' },
    { name: 'site_name', sql: "ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS site_name TEXT DEFAULT 'EDA Show'" },
    { name: 'site_slogan', sql: "ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS site_slogan TEXT DEFAULT ''" },
    { name: 'site_description', sql: "ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS site_description TEXT DEFAULT ''" },
    { name: 'site_favicon_url', sql: 'ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS site_favicon_url TEXT' },
    { name: 'contact_email', sql: 'ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS contact_email TEXT' },
    { name: 'contact_phone', sql: 'ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS contact_phone TEXT' },
    { name: 'font_heading', sql: "ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS font_heading TEXT DEFAULT 'Inter'" },
    { name: 'font_body', sql: "ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS font_body TEXT DEFAULT 'Inter'" },
    { name: 'light_secondary', sql: "ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS light_secondary TEXT DEFAULT '#F97316'" },
    { name: 'dark_primary', sql: "ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS dark_primary TEXT DEFAULT '#FF6F00'" },
    { name: 'dark_secondary', sql: "ALTER TABLE theme_settings ADD COLUMN IF NOT EXISTS dark_secondary TEXT DEFAULT '#FB923C'" },
]

async function fixLogoUrlColumn() {
    console.log('Applying missing theme_settings columns...\n')

    for (const col of columns) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: col.sql })
        if (error) {
            console.error(`  Error adding ${col.name}:`, error.message)
        } else {
            console.log(`  Added column: ${col.name}`)
        }
    }

    console.log('\nDone. The logo_url column should now be available in theme_settings.')
}

fixLogoUrlColumn().catch(console.error)
