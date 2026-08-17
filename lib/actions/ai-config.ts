'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from './cms-authz'

export async function getPersonas() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_personas')
    .select('*')
    .order('name')
  
  if (error) throw error
  return data
}

export async function updatePersona(id: string, updates: any) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_personas')
    .update(updates)
    .eq('id', id)
  
  if (error) throw error
  revalidatePath('/admin/ai')
  return { success: true }
}

export async function createPersona(persona: any) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_personas')
    .insert(persona)
  
  if (error) throw error
  revalidatePath('/admin/ai')
  return { success: true }
}

export async function getKnowledgeBlocks() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_knowledge_blocks')
    .select('*')
    .order('name')
  
  if (error) throw error
  return data
}

export async function updateKnowledgeBlock(id: string, content: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from('ai_knowledge_blocks')
    .update({ content })
    .eq('id', id)
  
  if (error) throw error
  revalidatePath('/admin/ai')
  return { success: true }
}
