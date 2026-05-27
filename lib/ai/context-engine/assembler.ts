import { ContextConfig, Persona, KnowledgeBlock } from './types';
import { EdaPro, EdaRaiz } from './personas';
import { BrandVoice, SeoRules } from './knowledge/brand-voice';
import { createAdminClient } from '@/lib/supabase/server';
import { getEditorialYearPromptBlock } from '@/lib/ai/editorial-year';

const LOCAL_PERSONAS: Record<string, Persona> = {
  'eda-pro': EdaPro,
  'eda-raiz': EdaRaiz,
};

const LOCAL_KNOWLEDGE: Record<string, KnowledgeBlock> = {
  'brand-voice': BrandVoice,
  'seo-rules': SeoRules,
};

export class ContextAssembler {
  /**
   * Fetch persona from DB or Fallback
   * Uses admin client to avoid cookies() dependency in server actions
   */
  static async getPersona(slug: string): Promise<Persona> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('ai_personas')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        return {
          id: data.slug,
          name: data.name,
          role: data.role,
          description: data.description,
          basePrompt: data.base_prompt,
          preferredTone: data.preferred_tone as any
        };
      }
    } catch (e) {
      console.warn(`[ContextAssembler] Failed to fetch persona '${slug}' from DB, using fallback.`);
    }

    return LOCAL_PERSONAS[slug] || LOCAL_PERSONAS['eda-pro'];
  }

  /**
   * Fetch knowledge block from DB or Fallback
   * Uses admin client to avoid cookies() dependency in server actions
   */
  static async getKnowledge(slug: string): Promise<KnowledgeBlock | null> {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('ai_knowledge_blocks')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        return {
          id: data.slug,
          content: data.content,
          tags: data.tags
        };
      }
    } catch (e) {
      console.warn(`[ContextAssembler] Failed to fetch knowledge '${slug}' from DB, using fallback.`);
    }

    return LOCAL_KNOWLEDGE[slug] || null;
  }

  /**
   * Build the final system prompt dynamically
   */
  static async buildSystemPrompt(config: ContextConfig): Promise<string> {
    const persona = await this.getPersona(config.personaId);
    
    let prompt = `${persona.basePrompt}\n\n`;

    // Injetar Voz da Marca
    if (config.includeBrandVoice) {
      const brandVoice = await this.getKnowledge('brand-voice');
      if (brandVoice) {
        prompt += `### DIRETRIZES EDITORIAIS\n${brandVoice.content}\n\n`;
      }
    }

    // Injetar Regras de SEO/Formatação
    if (config.includeSeoRules) {
      const seoRules = await this.getKnowledge('seo-rules');
      if (seoRules) {
        prompt += `### REGRAS DE FORMATAÇÃO\n${seoRules.content}\n\n`;
      }
    }

    prompt += `### ATUALIDADE EDITORIAL\n${getEditorialYearPromptBlock()}\n\n`;

    // Instruções Customizadas da Configuração
    if (config.customInstructions) {
      prompt += `### INSTRUÇÕES ESPECÍFICAS DA TAREFA\n${config.customInstructions}\n\n`;
    }

    // Instruções de Segurança/Saída (Hardcoded safety)
    prompt += `
### FORMATO DE SAÍDA
- Responda estritamente no formato JSON solicitado quando aplicável.
- Não inclua blocos de markdown (\`\`\`json) ao redor do JSON na resposta final se for solicitado um objeto puro.
`;

    return prompt;
  }
}
