/**
 * Script para criar a tabela keyword_groups no Supabase
 * Execute: npx tsx scripts/create-keyword-groups-table.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('Faltam variáveis: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
        process.exit(1)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    console.log('Criando tabela keyword_groups...')

    const { error } = await supabase.rpc('exec_sql', {
        sql: `
            CREATE TABLE IF NOT EXISTS keyword_groups (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                topic TEXT NOT NULL,
                keywords TEXT[] NOT NULL DEFAULT '{}',
                category TEXT DEFAULT 'geral',
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );

            ALTER TABLE keyword_groups ENABLE ROW LEVEL SECURITY;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'keyword_groups' AND policyname = 'Allow all for keyword_groups'
                ) THEN
                    CREATE POLICY "Allow all for keyword_groups"
                        ON keyword_groups FOR ALL
                        USING (true) WITH CHECK (true);
                END IF;
            END $$;
        `
    })

    if (error) {
        // Fallback: try creating via direct SQL query
        console.log('rpc exec_sql não disponível, tentando via REST...')

        const pgUrl = process.env.DATABASE_URI
        if (!pgUrl) {
            console.error('DATABASE_URI não encontrada. Execute o SQL manualmente:')
            console.log(`
CREATE TABLE IF NOT EXISTS keyword_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    topic TEXT NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    category TEXT DEFAULT 'geral',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE keyword_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for keyword_groups"
    ON keyword_groups FOR ALL
    USING (true) WITH CHECK (true);
            `)
            process.exit(1)
        }

        const { Client } = await import('pg')
        const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } })
        await client.connect()

        await client.query(`
            CREATE TABLE IF NOT EXISTS keyword_groups (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                topic TEXT NOT NULL,
                keywords TEXT[] NOT NULL DEFAULT '{}',
                category TEXT DEFAULT 'geral',
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            );
        `)

        await client.query(`ALTER TABLE keyword_groups ENABLE ROW LEVEL SECURITY;`)

        try {
            await client.query(`
                CREATE POLICY "Allow all for keyword_groups"
                    ON keyword_groups FOR ALL
                    USING (true) WITH CHECK (true);
            `)
        } catch (e: any) {
            if (!e.message?.includes('already exists')) throw e
            console.log('Policy já existe, continuando...')
        }

        await client.end()
        console.log('Tabela keyword_groups criada com sucesso!')
        return
    }

    console.log('Tabela keyword_groups criada com sucesso!')
}

main().catch(console.error)
