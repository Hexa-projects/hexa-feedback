import { supabase } from "@/integrations/supabase/client";

export const db = {
  // ===== PROFILES =====
  async updateProfile(userId: string, data: Record<string, any>) {
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) throw error;
  },

  async getProfile(userId: string) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) throw error;
    return data;
  },

  // ===== DAILY FORMS =====
  async saveDailyForm(form: {
    user_id: string; setor: string; funcao: string; atividades_principais: string;
    ferramentas: string[]; tempo_medio_por_atividade: string; maior_consumo_tempo: string; impedimentos: string;
  }) {
    const { error } = await supabase.from("daily_forms").insert(form);
    if (error) throw error;
  },

  async getDailyForms(userId?: string) {
    let q = supabase.from("daily_forms").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // ===== REPETITIVE PROCESSES =====
  async saveProcess(form: {
    user_id: string; processo: string; frequencia: string; tempo_medio: string;
    depende_outros: boolean; setor_dependencia?: string; pode_automatizar: boolean; como_automatizar?: string;
  }) {
    const { data, error } = await supabase.from("repetitive_processes").insert(form).select("id").single();
    if (error) throw error;
    return data.id;
  },

  async getProcesses(userId?: string) {
    let q = supabase.from("repetitive_processes").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // ===== BOTTLENECKS =====
  async saveBottleneck(form: {
    user_id: string; descricao: string; impactos: string[]; exemplo_real: string;
    urgencia: string; ja_resolveu: boolean; como_resolveu?: string;
  }) {
    const { data, error } = await supabase.from("bottlenecks").insert(form).select("id").single();
    if (error) throw error;
    return data.id;
  },

  async getBottlenecks(userId?: string) {
    let q = supabase.from("bottlenecks").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // ===== SUGGESTIONS =====
  async saveSuggestion(form: {
    user_id: string; ideia: string; setor_impactado: string; beneficio: string; esforco: string;
  }) {
    const { data, error } = await supabase.from("suggestions").insert(form).select("id").single();
    if (error) throw error;
    return data.id;
  },

  async getSuggestions(userId?: string) {
    let q = supabase.from("suggestions").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // ===== TOOL MAPPINGS =====
  async saveToolMapping(form: {
    user_id: string; nome_ferramenta: string; categoria: string; finalidade: string;
    descricao_uso: string; frequencia_uso: string; tempo_gasto_semana: string;
    compartilha_com: string; setores_envolvidos: string[]; problemas: string;
    satisfacao: string; gostaria_substituir: boolean; como_seria_ideal?: string;
    criado_por_voce: boolean; quantas_pessoas_usam: string;
  }) {
    const { error } = await supabase.from("tool_mappings").insert(form);
    if (error) throw error;
  },

  async getToolMappings(userId?: string) {
    let q = supabase.from("tool_mappings").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  // ===== IA LAPIDAÇÃO =====
  async updateLapidacao(table: string, id: string, perguntas_ia: string[], respostas_ia: string[]) {
    const { error } = await supabase.from(table).update({ perguntas_ia, respostas_ia }).eq("id", id);
    if (error) throw error;
  },

  // ===== STATS (for dashboard) =====
  async getStats() {
    const [daily, processes, bottlenecks, suggestions, toolMappings] = await Promise.all([
      this.getDailyForms(),
      this.getProcesses(),
      this.getBottlenecks(),
      this.getSuggestions(),
      this.getToolMappings(),
    ]);
    return { daily, processes, bottlenecks, suggestions, toolMappings };
  },

  // ===== STATS BY SECTOR =====
  async getStatsBySector(setor: string) {
    const [daily, processes, bottlenecks, suggestions, toolMappings] = await Promise.all([
      supabase.from("daily_forms").select("*").eq("setor", setor).order("created_at", { ascending: false }).then(r => r.data || []),
      supabase.from("repetitive_processes").select("*").order("created_at", { ascending: false }).then(r => r.data || []),
      supabase.from("bottlenecks").select("*").order("created_at", { ascending: false }).then(r => r.data || []),
      supabase.from("suggestions").select("*").eq("setor_impactado", setor).order("created_at", { ascending: false }).then(r => r.data || []),
      supabase.from("tool_mappings").select("*").order("created_at", { ascending: false }).then(r => r.data || []),
    ]);
    return { daily, processes, bottlenecks, suggestions, toolMappings };
  },

  // ===== PROFILES COUNT =====
  async getProfilesCount() {
    const { count, error } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    if (error) throw error;
    return count || 0;
  },

  // ===== ONBOARDING RESPONSES =====
  async saveOnboardingResponse(data: {
    user_id: string; setor: string; funcao: string; unidade: string;
    tempo_casa?: string; resumo_dia_dia?: string; responsabilidades?: string;
    ferramentas_criticas?: string; tarefas_repetitivas?: string; tempo_tarefas_manuais?: string;
    decisores?: string; principal_gargalo?: string; pontos_melhoria?: string;
    qualidades?: string; mudaria_no_setor?: string; whatsapp?: string;
    respostas_completas?: Record<string, any>;
  }) {
    const { error } = await supabase.from("onboarding_responses" as any).upsert(data as any, { onConflict: "user_id" });
    if (error) throw error;
  },

  async getOnboardingResponses() {
    const { data, error } = await supabase.from("onboarding_responses" as any).select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
};
