/**
 * Script de migração de senhas: Supabase Auth → profile_auth (Neon)
 *
 * Este script cria a tabela profile_auth e configura senhas iniciais
 * para todos os usuários admin/editor existentes.
 *
 * Uso:
 *   npx tsx scripts/migrate-auth-passwords.ts
 *
 * Variáveis de ambiente necessárias:
 *   DATABASE_URL - Connection string do Neon
 *
 * Após executar este script, avise os usuários para trocarem suas senhas
 * ou use a opção interativa para definir senhas personalizadas.
 */

import { neon } from '@neondatabase/serverless'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import * as readline from 'readline'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required')
    process.exit(1)
}

const sql = neon(DATABASE_URL)

async function createProfileAuthTable() {
    await sql`
        CREATE TABLE IF NOT EXISTS profile_auth (
            user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `
    console.log('✅ Table profile_auth created (or already exists)')
}

async function getAdminUsers() {
    const users = await sql`
        SELECT p.id, p.email, p.name, ur.role
        FROM profiles p
        JOIN user_roles ur ON ur.user_id = p.id
        WHERE ur.role IN ('admin', 'editor')
        ORDER BY ur.role ASC, p.email ASC
    `
    return users
}

async function setPassword(userId: string, password: string) {
    const hash = await bcrypt.hash(password, 12)
    await sql`
        INSERT INTO profile_auth (user_id, password_hash)
        VALUES (${userId}, ${hash})
        ON CONFLICT (user_id) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            updated_at = NOW()
    `
}

function generateTemporaryPassword(): string {
    return crypto.randomBytes(12).toString('base64url').slice(0, 16)
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
    return new Promise(resolve => rl.question(question, resolve))
}

async function main() {
    console.log('\n🔐 Migração de Senhas: Supabase Auth → Neon (profile_auth)\n')

    await createProfileAuthTable()

    const users = await getAdminUsers()

    if (users.length === 0) {
        console.log('⚠️  Nenhum usuário admin/editor encontrado na tabela profiles.')
        console.log('   Certifique-se de que os dados foram migrados do Supabase para o Neon antes de executar este script.')
        process.exit(0)
    }

    console.log(`\n📋 Usuários encontrados (${users.length}):\n`)
    users.forEach((u, i) => {
        console.log(`  ${i + 1}. [${u.role.toUpperCase()}] ${u.email} (${u.name || 'sem nome'})`)
    })

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    const mode = await prompt(rl, '\nEscolha o modo:\n  1. Gerar senhas temporárias aleatórias\n  2. Definir senha manualmente para cada usuário\n\nOpção (1 ou 2): ')

    const temporaryPasswords: Array<{ email: string; role: string; password: string }> = []

    if (mode.trim() === '1') {
        console.log('\n🎲 Gerando senhas temporárias...\n')
        for (const user of users) {
            const password = generateTemporaryPassword()
            await setPassword(user.id as string, password)
            temporaryPasswords.push({ email: user.email as string, role: user.role as string, password })
            console.log(`  ✅ ${user.email}: senha definida`)
        }

        console.log('\n📄 SENHAS TEMPORÁRIAS (guarde estas informações com segurança!):\n')
        console.log('  Email                           | Role   | Senha Temporária')
        console.log('  ' + '-'.repeat(70))
        temporaryPasswords.forEach(({ email, role, password }) => {
            console.log(`  ${email.padEnd(31)} | ${role.padEnd(6)} | ${password}`)
        })
        console.log('\n⚠️  IMPORTANTE: Peça para os usuários trocarem suas senhas após o primeiro login.')

    } else if (mode.trim() === '2') {
        for (const user of users) {
            console.log(`\n👤 ${user.email} (${user.role})`)
            const password = await prompt(rl, `   Nova senha (deixe em branco para gerar aleatória): `)

            const finalPassword = password.trim() || generateTemporaryPassword()
            await setPassword(user.id as string, finalPassword)

            if (!password.trim()) {
                console.log(`   ✅ Senha temporária gerada: ${finalPassword}`)
                temporaryPasswords.push({ email: user.email as string, role: user.role as string, password: finalPassword })
            } else {
                console.log(`   ✅ Senha definida com sucesso`)
            }
        }

        if (temporaryPasswords.length > 0) {
            console.log('\n📄 SENHAS TEMPORÁRIAS GERADAS:\n')
            temporaryPasswords.forEach(({ email, password }) => {
                console.log(`  ${email}: ${password}`)
            })
        }

    } else {
        console.log('\n❌ Opção inválida. Execute o script novamente.')
        rl.close()
        process.exit(1)
    }

    rl.close()

    console.log('\n✅ Migração de senhas concluída!')
    console.log('   Os usuários podem fazer login em /cms/login com as credenciais acima.\n')
}

main().catch(err => {
    console.error('❌ Erro durante a migração:', err)
    process.exit(1)
})
