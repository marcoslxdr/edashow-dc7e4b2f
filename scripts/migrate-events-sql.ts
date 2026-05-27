/**
 * Imprime o SQL das migrações de eventos para colar no Supabase SQL Editor.
 * Uso: npm run migrate:events:sql
 */
import { loadEventMigrationsSql } from './migrate-events'

function main() {
    console.log(`
=== Migrações de eventos (EdaShow) ===

1. Abra: https://supabase.com/dashboard/project/jqpbqrhlslgitifuliqa/sql/new
2. Cole o SQL abaixo e clique em "Run"
3. Depois confira no Table Editor: event_photo_galleries, event_photos, event_videos

--- SQL ---
`)
    console.log(loadEventMigrationsSql())
}

main()
