'use server'

import { sql } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'

export async function getPersonas() {
  const data = await sql`SELECT * FROM ai_personas ORDER BY name`
  return data
}

export async function updatePersona(id: string, updates: any) {
  const keys = Object.keys(updates)
  const values = Object.values(updates)
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
  await sql(`UPDATE ai_personas SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id])
  revalidatePath('/admin/ai')
  return { success: true }
}

export async function createPersona(persona: any) {
  const keys = Object.keys(persona)
  const values = Object.values(persona)
  const cols = keys.join(', ')
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
  await sql(`INSERT INTO ai_personas (${cols}) VALUES (${placeholders})`, values)
  revalidatePath('/admin/ai')
  return { success: true }
}

export async function getKnowledgeBlocks() {
  const data = await sql`SELECT * FROM ai_knowledge_blocks ORDER BY name`
  return data
}

export async function updateKnowledgeBlock(id: string, content: string) {
  await sql`UPDATE ai_knowledge_blocks SET content = ${content} WHERE id = ${id}`
  revalidatePath('/admin/ai')
  return { success: true }
}
