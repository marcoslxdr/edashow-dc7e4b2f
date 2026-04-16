/**
 * Script para criar o bucket de storage no Supabase
 * Execute com: npx tsx scripts/setup-storage.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const bucketName = process.env.SUPABASE_BUCKET || 'media'

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function setupStorage() {
    console.log(`\n🔧 Configurando Supabase Storage...`)
    console.log(`   URL: ${supabaseUrl}`)
    console.log(`   Bucket: ${bucketName}\n`)

    // Listar buckets existentes
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
        console.error('❌ Erro ao listar buckets:', listError.message)
        process.exit(1)
    }

    console.log('📦 Buckets existentes:', buckets?.map(b => b.name).join(', ') || 'nenhum')

    const bucketExists = buckets?.some(b => b.name === bucketName)

    if (bucketExists) {
        console.log(`\n✅ Bucket "${bucketName}" já existe!`)
    } else {
        console.log(`\n⚙️  Criando bucket "${bucketName}"...`)

        const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'],
            fileSizeLimit: 10485760 // 10MB
        })

        if (createError) {
            console.error('❌ Erro ao criar bucket:', createError.message)
            process.exit(1)
        }

        console.log(`✅ Bucket "${bucketName}" criado com sucesso!`)
    }

    // Testar upload simples
    console.log('\n🧪 Testando upload...')
    const testContent = Buffer.from('test')
    const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload('test/setup-test.txt', testContent, { upsert: true })

    if (uploadError) {
        console.error('❌ Erro no teste de upload:', uploadError.message)
    } else {
        console.log('✅ Upload de teste funcionando!')
        // Remover arquivo de teste
        await supabase.storage.from(bucketName).remove(['test/setup-test.txt'])
    }

    console.log('\n🎉 Storage configurado com sucesso!\n')
}

setupStorage()
