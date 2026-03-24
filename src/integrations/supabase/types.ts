export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bottlenecks: {
        Row: {
          audio_url: string | null
          como_resolveu: string | null
          created_at: string | null
          descricao: string
          exemplo_real: string | null
          id: string
          impactos: string[] | null
          ja_resolveu: boolean | null
          perguntas_ia: string[] | null
          respostas_ia: string[] | null
          tags: string[] | null
          transcricao_audio: string | null
          urgencia: Database["public"]["Enums"]["urgencia"]
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          como_resolveu?: string | null
          created_at?: string | null
          descricao: string
          exemplo_real?: string | null
          id?: string
          impactos?: string[] | null
          ja_resolveu?: boolean | null
          perguntas_ia?: string[] | null
          respostas_ia?: string[] | null
          tags?: string[] | null
          transcricao_audio?: string | null
          urgencia?: Database["public"]["Enums"]["urgencia"]
          user_id: string
        }
        Update: {
          audio_url?: string | null
          como_resolveu?: string | null
          created_at?: string | null
          descricao?: string
          exemplo_real?: string | null
          id?: string
          impactos?: string[] | null
          ja_resolveu?: boolean | null
          perguntas_ia?: string[] | null
          respostas_ia?: string[] | null
          tags?: string[] | null
          transcricao_audio?: string | null
          urgencia?: Database["public"]["Enums"]["urgencia"]
          user_id?: string
        }
        Relationships: []
      }
      daily_forms: {
        Row: {
          atividades_principais: string
          audio_url: string | null
          created_at: string | null
          ferramentas: string[] | null
          funcao: string
          id: string
          impedimentos: string | null
          maior_consumo_tempo: string | null
          setor: Database["public"]["Enums"]["setor"]
          tempo_medio_por_atividade: string | null
          transcricao_audio: string | null
          user_id: string
        }
        Insert: {
          atividades_principais?: string
          audio_url?: string | null
          created_at?: string | null
          ferramentas?: string[] | null
          funcao?: string
          id?: string
          impedimentos?: string | null
          maior_consumo_tempo?: string | null
          setor: Database["public"]["Enums"]["setor"]
          tempo_medio_por_atividade?: string | null
          transcricao_audio?: string | null
          user_id: string
        }
        Update: {
          atividades_principais?: string
          audio_url?: string | null
          created_at?: string | null
          ferramentas?: string[] | null
          funcao?: string
          id?: string
          impedimentos?: string | null
          maior_consumo_tempo?: string | null
          setor?: Database["public"]["Enums"]["setor"]
          tempo_medio_por_atividade?: string | null
          transcricao_audio?: string | null
          user_id?: string
        }
        Relationships: []
      }
      focus_ai_config: {
        Row: {
          guardrail_aprovacao_humana: boolean | null
          guardrail_custo_mensal: number | null
          guardrail_max_mensagens_dia: number | null
          id: string
          llm_api_key: string | null
          llm_limite_custo_mensal: number | null
          llm_max_tokens: number | null
          llm_modelo: string | null
          llm_temperatura: number | null
          memoria_ativa: boolean | null
          openclaw_api_key: string | null
          openclaw_ativo: boolean | null
          openclaw_env: string | null
          openclaw_url: string | null
          prompt_identidade: string | null
          prompt_objetivo: string | null
          prompt_restricoes: string | null
          prompt_tom_voz: string | null
          rag_fonte: string | null
          rag_provedor_embeddings: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          guardrail_aprovacao_humana?: boolean | null
          guardrail_custo_mensal?: number | null
          guardrail_max_mensagens_dia?: number | null
          id?: string
          llm_api_key?: string | null
          llm_limite_custo_mensal?: number | null
          llm_max_tokens?: number | null
          llm_modelo?: string | null
          llm_temperatura?: number | null
          memoria_ativa?: boolean | null
          openclaw_api_key?: string | null
          openclaw_ativo?: boolean | null
          openclaw_env?: string | null
          openclaw_url?: string | null
          prompt_identidade?: string | null
          prompt_objetivo?: string | null
          prompt_restricoes?: string | null
          prompt_tom_voz?: string | null
          rag_fonte?: string | null
          rag_provedor_embeddings?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          guardrail_aprovacao_humana?: boolean | null
          guardrail_custo_mensal?: number | null
          guardrail_max_mensagens_dia?: number | null
          id?: string
          llm_api_key?: string | null
          llm_limite_custo_mensal?: number | null
          llm_max_tokens?: number | null
          llm_modelo?: string | null
          llm_temperatura?: number | null
          memoria_ativa?: boolean | null
          openclaw_api_key?: string | null
          openclaw_ativo?: boolean | null
          openclaw_env?: string | null
          openclaw_url?: string | null
          prompt_identidade?: string | null
          prompt_objetivo?: string | null
          prompt_restricoes?: string | null
          prompt_tom_voz?: string | null
          rag_fonte?: string | null
          rag_provedor_embeddings?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      focus_ai_insights: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          prioridade: string | null
          status: string | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
        }
        Relationships: []
      }
      focus_ai_logs: {
        Row: {
          created_at: string | null
          detalhes: Json | null
          id: string
          mensagem: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          mensagem: string
          tipo?: string
        }
        Update: {
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          mensagem?: string
          tipo?: string
        }
        Relationships: []
      }
      focus_ai_routines: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          frequencia: string | null
          id: string
          nome: string
          ultima_execucao: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          frequencia?: string | null
          id?: string
          nome: string
          ultima_execucao?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          frequencia?: string | null
          id?: string
          nome?: string
          ultima_execucao?: string | null
        }
        Relationships: []
      }
      focus_ai_skills: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          status: string | null
          updated_at: string | null
          versao: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          status?: string | null
          updated_at?: string | null
          versao?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          status?: string | null
          updated_at?: string | null
          versao?: string | null
        }
        Relationships: []
      }
      lab_parts: {
        Row: {
          created_at: string | null
          data_entrada: string | null
          descricao: string
          equipamento_origem: string
          id: string
          localizacao: string | null
          notas: string | null
          previsao_conclusao: string | null
          status: string
          tecnico_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_entrada?: string | null
          descricao?: string
          equipamento_origem?: string
          id?: string
          localizacao?: string | null
          notas?: string | null
          previsao_conclusao?: string | null
          status?: string
          tecnico_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_entrada?: string | null
          descricao?: string
          equipamento_origem?: string
          id?: string
          localizacao?: string | null
          notas?: string | null
          previsao_conclusao?: string | null
          status?: string
          tecnico_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lead_interactions: {
        Row: {
          audio_url: string | null
          conteudo: string
          created_at: string | null
          id: string
          lead_id: string
          tipo: string
          transcricao_audio: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          conteudo?: string
          created_at?: string | null
          id?: string
          lead_id: string
          tipo?: string
          transcricao_audio?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          conteudo?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          tipo?: string
          transcricao_audio?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string | null
          email: string | null
          empresa: string | null
          id: string
          nome: string
          notas: string | null
          origem: string | null
          responsavel_id: string | null
          status: string
          telefone: string | null
          ultimo_contato: string | null
          updated_at: string | null
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          nome: string
          notas?: string | null
          origem?: string | null
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          ultimo_contato?: string | null
          updated_at?: string | null
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          nome?: string
          notas?: string | null
          origem?: string | null
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          ultimo_contato?: string | null
          updated_at?: string | null
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          decisores: string | null
          ferramentas_criticas: string | null
          funcao: string | null
          id: string
          nome: string
          onboarding_completo: boolean | null
          pontos_melhoria: string | null
          principal_gargalo: string | null
          qualidades: string | null
          responsabilidades: string | null
          resumo_dia_dia: string | null
          setor: Database["public"]["Enums"]["setor"]
          tempo_casa: string | null
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decisores?: string | null
          ferramentas_criticas?: string | null
          funcao?: string | null
          id: string
          nome: string
          onboarding_completo?: boolean | null
          pontos_melhoria?: string | null
          principal_gargalo?: string | null
          qualidades?: string | null
          responsabilidades?: string | null
          resumo_dia_dia?: string | null
          setor?: Database["public"]["Enums"]["setor"]
          tempo_casa?: string | null
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decisores?: string | null
          ferramentas_criticas?: string | null
          funcao?: string | null
          id?: string
          nome?: string
          onboarding_completo?: boolean | null
          pontos_melhoria?: string | null
          principal_gargalo?: string | null
          qualidades?: string | null
          responsabilidades?: string | null
          resumo_dia_dia?: string | null
          setor?: Database["public"]["Enums"]["setor"]
          tempo_casa?: string | null
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          lead_id: string | null
          status: string
          titulo: string
          updated_at: string | null
          user_id: string
          validade_dias: number | null
          valor: number | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
          user_id: string
          validade_dias?: number | null
          valor?: number | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
          user_id?: string
          validade_dias?: number | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      repetitive_processes: {
        Row: {
          audio_url: string | null
          como_automatizar: string | null
          created_at: string | null
          depende_outros: boolean | null
          frequencia: Database["public"]["Enums"]["frequencia"]
          id: string
          perguntas_ia: string[] | null
          pode_automatizar: boolean | null
          processo: string
          respostas_ia: string[] | null
          setor_dependencia: string | null
          tags: string[] | null
          tempo_medio: string | null
          transcricao_audio: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          como_automatizar?: string | null
          created_at?: string | null
          depende_outros?: boolean | null
          frequencia?: Database["public"]["Enums"]["frequencia"]
          id?: string
          perguntas_ia?: string[] | null
          pode_automatizar?: boolean | null
          processo: string
          respostas_ia?: string[] | null
          setor_dependencia?: string | null
          tags?: string[] | null
          tempo_medio?: string | null
          transcricao_audio?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          como_automatizar?: string | null
          created_at?: string | null
          depende_outros?: boolean | null
          frequencia?: Database["public"]["Enums"]["frequencia"]
          id?: string
          perguntas_ia?: string[] | null
          pode_automatizar?: boolean | null
          processo?: string
          respostas_ia?: string[] | null
          setor_dependencia?: string | null
          tags?: string[] | null
          tempo_medio?: string | null
          transcricao_audio?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          audio_url: string | null
          beneficio: string | null
          created_at: string | null
          esforco: Database["public"]["Enums"]["esforco"]
          id: string
          ideia: string
          perguntas_ia: string[] | null
          respostas_ia: string[] | null
          setor_impactado: Database["public"]["Enums"]["setor"]
          tags: string[] | null
          transcricao_audio: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          beneficio?: string | null
          created_at?: string | null
          esforco?: Database["public"]["Enums"]["esforco"]
          id?: string
          ideia: string
          perguntas_ia?: string[] | null
          respostas_ia?: string[] | null
          setor_impactado?: Database["public"]["Enums"]["setor"]
          tags?: string[] | null
          transcricao_audio?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          beneficio?: string | null
          created_at?: string | null
          esforco?: Database["public"]["Enums"]["esforco"]
          id?: string
          ideia?: string
          perguntas_ia?: string[] | null
          respostas_ia?: string[] | null
          setor_impactado?: Database["public"]["Enums"]["setor"]
          tags?: string[] | null
          transcricao_audio?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tool_mappings: {
        Row: {
          categoria: string
          como_seria_ideal: string | null
          compartilha_com: string | null
          created_at: string | null
          criado_por_voce: boolean | null
          descricao_uso: string | null
          finalidade: string
          frequencia_uso: string | null
          gostaria_substituir: boolean | null
          id: string
          nome_ferramenta: string
          problemas: string | null
          quantas_pessoas_usam: string | null
          satisfacao: string | null
          setores_envolvidos: string[] | null
          tempo_gasto_semana: string | null
          user_id: string
        }
        Insert: {
          categoria?: string
          como_seria_ideal?: string | null
          compartilha_com?: string | null
          created_at?: string | null
          criado_por_voce?: boolean | null
          descricao_uso?: string | null
          finalidade?: string
          frequencia_uso?: string | null
          gostaria_substituir?: boolean | null
          id?: string
          nome_ferramenta: string
          problemas?: string | null
          quantas_pessoas_usam?: string | null
          satisfacao?: string | null
          setores_envolvidos?: string[] | null
          tempo_gasto_semana?: string | null
          user_id: string
        }
        Update: {
          categoria?: string
          como_seria_ideal?: string | null
          compartilha_com?: string | null
          created_at?: string | null
          criado_por_voce?: boolean | null
          descricao_uso?: string | null
          finalidade?: string
          frequencia_uso?: string | null
          gostaria_substituir?: boolean | null
          id?: string
          nome_ferramenta?: string
          problemas?: string | null
          quantas_pessoas_usam?: string | null
          satisfacao?: string | null
          setores_envolvidos?: string[] | null
          tempo_gasto_semana?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_order_activities: {
        Row: {
          concluida: boolean | null
          created_at: string | null
          descricao: string
          id: string
          user_id: string
          work_order_id: string
        }
        Insert: {
          concluida?: boolean | null
          created_at?: string | null
          descricao: string
          id?: string
          user_id: string
          work_order_id: string
        }
        Update: {
          concluida?: boolean | null
          created_at?: string | null
          descricao?: string
          id?: string
          user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_activities_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assinatura_url: string | null
          audio_url: string | null
          cliente: string
          created_at: string | null
          descricao: string | null
          equipamento: string
          id: string
          numero_os: string
          observacoes_ia: string | null
          sla_horas: number | null
          status: string
          tecnico_id: string | null
          tempo_gasto_min: number | null
          transcricao_audio: string | null
          updated_at: string | null
          urgencia: string | null
          user_id: string
        }
        Insert: {
          assinatura_url?: string | null
          audio_url?: string | null
          cliente?: string
          created_at?: string | null
          descricao?: string | null
          equipamento?: string
          id?: string
          numero_os?: string
          observacoes_ia?: string | null
          sla_horas?: number | null
          status?: string
          tecnico_id?: string | null
          tempo_gasto_min?: number | null
          transcricao_audio?: string | null
          updated_at?: string | null
          urgencia?: string | null
          user_id: string
        }
        Update: {
          assinatura_url?: string | null
          audio_url?: string | null
          cliente?: string
          created_at?: string | null
          descricao?: string | null
          equipamento?: string
          id?: string
          numero_os?: string
          observacoes_ia?: string | null
          sla_horas?: number | null
          status?: string
          tecnico_id?: string | null
          tempo_gasto_min?: number | null
          transcricao_audio?: string | null
          updated_at?: string | null
          urgencia?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_setor: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["setor"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "colaborador"
      esforco: "Baixo" | "Médio" | "Alto"
      frequencia: "Diário" | "Semanal" | "Mensal" | "Eventual"
      setor:
        | "Comercial"
        | "Técnico"
        | "Laboratório"
        | "Administrativo"
        | "Financeiro"
        | "Logística"
        | "Diretoria"
      urgencia: "Baixa" | "Média" | "Alta" | "Crítica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor", "colaborador"],
      esforco: ["Baixo", "Médio", "Alto"],
      frequencia: ["Diário", "Semanal", "Mensal", "Eventual"],
      setor: [
        "Comercial",
        "Técnico",
        "Laboratório",
        "Administrativo",
        "Financeiro",
        "Logística",
        "Diretoria",
      ],
      urgencia: ["Baixa", "Média", "Alta", "Crítica"],
    },
  },
} as const
