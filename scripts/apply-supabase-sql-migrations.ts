import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

function main() {
    const destRef = 'jqpbqrhlslgitifuliqa'
    const uri =
        process.env.MIGRATE_DEST_DATABASE_URI?.trim() ||
        (process.env.DATABASE_URI?.includes(destRef) ? process.env.DATABASE_URI.trim() : '')
    if (!uri) {
        console.error(
            `Defina MIGRATE_DEST_DATABASE_URI em .env.local (Session :5432 do projeto ${destRef}).`,
        )
        process.exit(1)
    }

    const dir = path.join(process.cwd(), 'supabase', 'migrations')
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

    for (const file of files) {
        const full = path.join(dir, file)
        console.log(`\n>>> ${file}`)
        const r = spawnSync('psql', [uri, '-v', 'ON_ERROR_STOP=1', '-f', full], {
            stdio: 'inherit',
        })
        if (r.status !== 0) {
            console.error(`\nFalha ao aplicar ${file}. Corrija o erro ou atualize DATABASE_URI no dashboard do Supabase.`)
            process.exit(r.status ?? 1)
        }
    }

    console.log('\nMigrações SQL aplicadas com sucesso.')
}

main()
