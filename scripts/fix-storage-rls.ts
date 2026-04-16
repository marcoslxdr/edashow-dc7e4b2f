/**
 * Script para corrigir políticas RLS do Supabase Storage
 * Execute com: npx tsx scripts/fix-storage-rls.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const bucketName = process.env.SUPABASE_BUCKET || 'media'

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

async function main() {
    console.log(`\n🔧 Diagnosticando e corrigindo Storage RLS...`)
    console.log(`   URL: ${supabaseUrl}`)
    console.log(`   Bucket: ${bucketName}\n`)

    // 1. Verificar buckets existentes
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    if (bucketsError) {
        console.error('❌ Erro ao listar buckets:', bucketsError.message)
        process.exit(1)
    }
    console.log('📦 Buckets:', buckets?.map(b => `${b.name} (public:${b.public})`).join(', '))

    const bucket = buckets?.find(b => b.name === bucketName)
    if (!bucket) {
        console.error(`❌ Bucket "${bucketName}" não encontrado!`)
        process.exit(1)
    }

    // 2. Testar upload direto com service_role (imagem mínima PNG válida - 1x1 pixel)
    console.log('\n🧪 Testando upload com service_role key...')
    const minimalPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
    )
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload('test/rls-test.png', minimalPng, {
            contentType: 'image/png',
            upsert: true
        })

    if (uploadError) {
        console.error('❌ Upload falhou:', uploadError.message)
        console.log('\n⚙️  Tentando criar políticas RLS via SQL...\n')

        // Tentar executar SQL para criar políticas (requer que rpc esteja disponível)
        const sql = `
            DO $$
            BEGIN
                -- Política INSERT para storage.objects
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'storage'
                    AND tablename = 'objects'
                    AND policyname = '${bucketName}_insert_policy'
                ) THEN
                    EXECUTE 'CREATE POLICY "${bucketName}_insert_policy" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''${bucketName}'')';
                END IF;

                -- Política SELECT para storage.objects
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'storage'
                    AND tablename = 'objects'
                    AND policyname = '${bucketName}_select_policy'
                ) THEN
                    EXECUTE 'CREATE POLICY "${bucketName}_select_policy" ON storage.objects FOR SELECT USING (bucket_id = ''${bucketName}'')';
                END IF;

                -- Política UPDATE para storage.objects
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'storage'
                    AND tablename = 'objects'
                    AND policyname = '${bucketName}_update_policy'
                ) THEN
                    EXECUTE 'CREATE POLICY "${bucketName}_update_policy" ON storage.objects FOR UPDATE USING (bucket_id = ''${bucketName}'')';
                END IF;

                -- Política DELETE para storage.objects
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'storage'
                    AND tablename = 'objects'
                    AND policyname = '${bucketName}_delete_policy'
                ) THEN
                    EXECUTE 'CREATE POLICY "${bucketName}_delete_policy" ON storage.objects FOR DELETE USING (bucket_id = ''${bucketName}'')';
                END IF;
            END $$;
        `

        const { error: sqlError } = await supabase.rpc('exec_sql', { sql })
        if (sqlError) {
            console.log('ℹ️  rpc exec_sql não disponível. Siga as instruções manuais abaixo.')
        } else {
            console.log('✅ Políticas criadas via SQL!')

            // Testar novamente
            const { error: retryError } = await supabase.storage
                .from(bucketName)
                .upload('test/rls-test.png', minimalPng, {
                    contentType: 'image/png',
                    upsert: true
                })

            if (retryError) {
                console.error('❌ Upload ainda falha:', retryError.message)
            } else {
                console.log('✅ Upload funcionando!')
                await supabase.storage.from(bucketName).remove(['test/rls-test.png'])
            }
        }

        // Instruções manuais
        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SOLUÇÃO MANUAL - Execute no Supabase SQL Editor:
   ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/').split('.supabase.co')[0]}/sql/new
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Políticas para o bucket "${bucketName}"
CREATE POLICY "${bucketName}_select_policy"
ON storage.objects FOR SELECT
USING (bucket_id = '${bucketName}');

CREATE POLICY "${bucketName}_insert_policy"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = '${bucketName}');

CREATE POLICY "${bucketName}_update_policy"
ON storage.objects FOR UPDATE
USING (bucket_id = '${bucketName}');

CREATE POLICY "${bucketName}_delete_policy"
ON storage.objects FOR DELETE
USING (bucket_id = '${bucketName}');

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
    } else {
        console.log('✅ Upload funcionando corretamente com service_role!')
        await supabase.storage.from(bucketName).remove(['test/rls-test.png'])
        console.log('\nO problema pode ser em outra parte do código (ex: theme_settings).')
        console.log('Verifique os logs do servidor para mais detalhes.\n')
    }
}

main().catch(err => {
    console.error('❌ Erro fatal:', err.message)
    process.exit(1)
})
