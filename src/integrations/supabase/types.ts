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
      action_queue: {
        Row: {
          action_type: string
          created_at: string | null
          event_id: string | null
          id: string
          payload: Json | null
          requires_review: boolean | null
          status: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          payload?: Json | null
          requires_review?: boolean | null
          status?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          payload?: Json | null
          requires_review?: boolean | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "operational_events"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          actions: Json | null
          errors: Json | null
          event_id: string | null
          finished_at: string | null
          id: string
          openclaw_request_id: string | null
          started_at: string | null
          status: string
          summary: string | null
        }
        Insert: {
          actions?: Json | null
          errors?: Json | null
          event_id?: string | null
          finished_at?: string | null
          id?: string
          openclaw_request_id?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          actions?: Json | null
          errors?: Json | null
          event_id?: string | null
          finished_at?: string | null
          id?: string
          openclaw_request_id?: string | null
          started_at?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "operational_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_requests: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          autonomy_level: string | null
          created_at: string | null
          description: string | null
          domain: string
          estimated_impact: string | null
          evidence: Json | null
          executed_at: string | null
          id: string
          policy_applied: string | null
          reason: string
          requires_approval: boolean | null
          result: Json | null
          risk_level: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          autonomy_level?: string | null
          created_at?: string | null
          description?: string | null
          domain: string
          estimated_impact?: string | null
          evidence?: Json | null
          executed_at?: string | null
          id?: string
          policy_applied?: string | null
          reason: string
          requires_approval?: boolean | null
          result?: Json | null
          risk_level?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          autonomy_level?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string
          estimated_impact?: string | null
          evidence?: Json | null
          executed_at?: string | null
          id?: string
          policy_applied?: string | null
          reason?: string
          requires_approval?: boolean | null
          result?: Json | null
          risk_level?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_agents: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          domain: string
          fontes_autorizadas: string[] | null
          id: string
          metricas: Json | null
          modelo: string | null
          nome: string
          system_prompt: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          domain?: string
          fontes_autorizadas?: string[] | null
          id?: string
          metricas?: Json | null
          modelo?: string | null
          nome: string
          system_prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          domain?: string
          fontes_autorizadas?: string[] | null
          id?: string
          metricas?: Json | null
          modelo?: string | null
          nome?: string
          system_prompt?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_audit_trail: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          outcome: string | null
          policy_applied: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          outcome?: string | null
          policy_applied?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          outcome?: string | null
          policy_applied?: string | null
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          comentario: string | null
          created_at: string | null
          id: string
          impacto_real: string | null
          insight_id: string | null
          precisao_score: number | null
          resultado: string
          user_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string | null
          id?: string
          impacto_real?: string | null
          insight_id?: string | null
          precisao_score?: number | null
          resultado?: string
          user_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string | null
          id?: string
          impacto_real?: string | null
          insight_id?: string | null
          precisao_score?: number | null
          resultado?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "focus_ai_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_learning_feedback: {
        Row: {
          action_request_id: string | null
          actual_outcome: string | null
          created_at: string | null
          decision: string | null
          effectiveness_score: number | null
          feedback_notes: string | null
          id: string
          insight_id: string | null
          kpi_after: Json | null
          kpi_before: Json | null
          recommendation_type: string | null
        }
        Insert: {
          action_request_id?: string | null
          actual_outcome?: string | null
          created_at?: string | null
          decision?: string | null
          effectiveness_score?: number | null
          feedback_notes?: string | null
          id?: string
          insight_id?: string | null
          kpi_after?: Json | null
          kpi_before?: Json | null
          recommendation_type?: string | null
        }
        Update: {
          action_request_id?: string | null
          actual_outcome?: string | null
          created_at?: string | null
          decision?: string | null
          effectiveness_score?: number | null
          feedback_notes?: string | null
          id?: string
          insight_id?: string | null
          kpi_after?: Json | null
          kpi_before?: Json | null
          recommendation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_learning_feedback_action_request_id_fkey"
            columns: ["action_request_id"]
            isOneToOne: false
            referencedRelation: "ai_action_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      autonomy_rules: {
        Row: {
          acao: string
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          domain: string
          id: string
          limite_diario: number | null
          nivel: string
          permitido: boolean | null
          requer_aprovacao: boolean | null
          updated_at: string | null
        }
        Insert: {
          acao: string
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          domain?: string
          id?: string
          limite_diario?: number | null
          nivel?: string
          permitido?: boolean | null
          requer_aprovacao?: boolean | null
          updated_at?: string | null
        }
        Update: {
          acao?: string
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          domain?: string
          id?: string
          limite_diario?: number | null
          nivel?: string
          permitido?: boolean | null
          requer_aprovacao?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
      channel_messages: {
        Row: {
          anexo_url: string | null
          channel_id: string
          content: string
          created_at: string | null
          id: string
          is_ai: boolean | null
          metadata: Json | null
          parent_id: string | null
          thread_count: number | null
          tipo: string | null
          user_id: string | null
        }
        Insert: {
          anexo_url?: string | null
          channel_id: string
          content?: string
          created_at?: string | null
          id?: string
          is_ai?: boolean | null
          metadata?: Json | null
          parent_id?: string | null
          thread_count?: number | null
          tipo?: string | null
          user_id?: string | null
        }
        Update: {
          anexo_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_ai?: boolean | null
          metadata?: Json | null
          parent_id?: string | null
          thread_count?: number | null
          tipo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "corporate_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_tasks: {
        Row: {
          assigned_to: string | null
          channel_id: string
          checklist: Json | null
          created_at: string | null
          created_by: string
          descricao: string | null
          id: string
          message_id: string | null
          prazo: string | null
          prioridade: string | null
          status: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          channel_id: string
          checklist?: Json | null
          created_at?: string | null
          created_by: string
          descricao?: string | null
          id?: string
          message_id?: string | null
          prazo?: string | null
          prioridade?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          channel_id?: string
          checklist?: Json | null
          created_at?: string | null
          created_by?: string
          descricao?: string | null
          id?: string
          message_id?: string | null
          prazo?: string | null
          prioridade?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_tasks_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "corporate_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_tasks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          equipamentos: Json | null
          id: string
          lead_id: string | null
          notas: string | null
          proposal_id: string | null
          status: string | null
          tipo: string | null
          titulo: string
          updated_at: string | null
          user_id: string
          valor_mensal: number | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          equipamentos?: Json | null
          id?: string
          lead_id?: string | null
          notas?: string | null
          proposal_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
          user_id: string
          valor_mensal?: number | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          equipamentos?: Json | null
          id?: string
          lead_id?: string | null
          notas?: string | null
          proposal_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
          user_id?: string
          valor_mensal?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_channels: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          setor: string | null
          slug: string
          team_id: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          setor?: string | null
          slug: string
          team_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          setor?: string | null
          slug?: string
          team_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corporate_channels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      data_catalog: {
        Row: {
          business_description: string | null
          column_count: number | null
          columns_info: Json | null
          domain: string | null
          foreign_keys: Json | null
          id: string
          last_updated: string | null
          quality_score: number | null
          row_count: number | null
          schema_name: string | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          business_description?: string | null
          column_count?: number | null
          columns_info?: Json | null
          domain?: string | null
          foreign_keys?: Json | null
          id?: string
          last_updated?: string | null
          quality_score?: number | null
          row_count?: number | null
          schema_name?: string | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          business_description?: string | null
          column_count?: number | null
          columns_info?: Json | null
          domain?: string | null
          foreign_keys?: Json | null
          id?: string
          last_updated?: string | null
          quality_score?: number | null
          row_count?: number | null
          schema_name?: string | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          deal_id: string
          description: string | null
          id: string
          is_completed: boolean | null
          scheduled_at: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          deal_id: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          scheduled_at?: string | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          deal_id?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          scheduled_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company: string | null
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          conversation_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          owner_id: string | null
          owner_name: string | null
          priority: string | null
          qualification_score: number | null
          stage_id: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
          value: number | null
          won_at: string | null
        }
        Insert: {
          company?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_id?: string | null
          owner_name?: string | null
          priority?: string | null
          qualification_score?: number | null
          stage_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
          value?: number | null
          won_at?: string | null
        }
        Update: {
          company?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          conversation_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_id?: string | null
          owner_name?: string | null
          priority?: string | null
          qualification_score?: number | null
          stage_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
          value?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      file_imports: {
        Row: {
          analise_estrutura: Json | null
          analise_modulos_hexaos: string[] | null
          analise_pode_substituir: boolean | null
          analise_proposito: string | null
          analise_recomendacoes: string | null
          created_at: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string
          file_url: string
          id: string
          setor: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analise_estrutura?: Json | null
          analise_modulos_hexaos?: string[] | null
          analise_pode_substituir?: boolean | null
          analise_proposito?: string | null
          analise_recomendacoes?: string | null
          created_at?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          file_url: string
          id?: string
          setor?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analise_estrutura?: Json | null
          analise_modulos_hexaos?: string[] | null
          analise_pode_substituir?: boolean | null
          analise_proposito?: string | null
          analise_recomendacoes?: string | null
          created_at?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          id?: string
          setor?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          categoria: string | null
          cliente: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          id: string
          referencia: string | null
          status: string
          tipo: string
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          cliente?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          id?: string
          referencia?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          cliente?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          id?: string
          referencia?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
          user_id?: string
          valor?: number
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
          acao_recomendada: string | null
          causa_provavel: string | null
          created_at: string | null
          criterio_sucesso: string | null
          descricao: string | null
          domain: string | null
          evidencia_dados: Json | null
          id: string
          impacto_estimado: string | null
          nivel_autonomia: string | null
          prazo_sugerido: string | null
          prioridade: string | null
          responsavel_sugerido: string | null
          status: string | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          acao_recomendada?: string | null
          causa_provavel?: string | null
          created_at?: string | null
          criterio_sucesso?: string | null
          descricao?: string | null
          domain?: string | null
          evidencia_dados?: Json | null
          id?: string
          impacto_estimado?: string | null
          nivel_autonomia?: string | null
          prazo_sugerido?: string | null
          prioridade?: string | null
          responsavel_sugerido?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
        }
        Update: {
          acao_recomendada?: string | null
          causa_provavel?: string | null
          created_at?: string | null
          criterio_sucesso?: string | null
          descricao?: string | null
          domain?: string | null
          evidencia_dados?: Json | null
          id?: string
          impacto_estimado?: string | null
          nivel_autonomia?: string | null
          prazo_sugerido?: string | null
          prioridade?: string | null
          responsavel_sugerido?: string | null
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
      hex_calendar_events: {
        Row: {
          calendar_id: string
          created_at: string | null
          criado_por: string
          data_fim: string
          data_inicio: string
          descricao: string | null
          dia_inteiro: boolean | null
          external_id: string | null
          id: string
          local: string | null
          metadata: Json | null
          prioridade: string | null
          recorrencia: string | null
          status: string | null
          tipo: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          calendar_id: string
          created_at?: string | null
          criado_por: string
          data_fim: string
          data_inicio: string
          descricao?: string | null
          dia_inteiro?: boolean | null
          external_id?: string | null
          id?: string
          local?: string | null
          metadata?: Json | null
          prioridade?: string | null
          recorrencia?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          calendar_id?: string
          created_at?: string | null
          criado_por?: string
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          dia_inteiro?: boolean | null
          external_id?: string | null
          id?: string
          local?: string | null
          metadata?: Json | null
          prioridade?: string | null
          recorrencia?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hex_calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "hex_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      hex_calendar_participants: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          notificado: boolean | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          notificado?: boolean | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          notificado?: boolean | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hex_calendar_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hex_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      hex_calendars: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          owner_id: string
          sync_last_at: string | null
          sync_provider: string | null
          sync_token: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          owner_id: string
          sync_last_at?: string | null
          sync_provider?: string | null
          sync_token?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          owner_id?: string
          sync_last_at?: string | null
          sync_provider?: string | null
          sync_token?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      installed_equipment: {
        Row: {
          cliente: string
          contrato_id: string | null
          created_at: string | null
          data_instalacao: string | null
          id: string
          localizacao: string | null
          modelo: string | null
          nome: string
          notas: string | null
          proxima_manutencao: string | null
          serial_number: string | null
          status: string
          ultima_manutencao: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cliente: string
          contrato_id?: string | null
          created_at?: string | null
          data_instalacao?: string | null
          id?: string
          localizacao?: string | null
          modelo?: string | null
          nome: string
          notas?: string | null
          proxima_manutencao?: string | null
          serial_number?: string | null
          status?: string
          ultima_manutencao?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cliente?: string
          contrato_id?: string | null
          created_at?: string | null
          data_instalacao?: string | null
          id?: string
          localizacao?: string | null
          modelo?: string | null
          nome?: string
          notas?: string | null
          proxima_manutencao?: string | null
          serial_number?: string | null
          status?: string
          ultima_manutencao?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      integration_configs: {
        Row: {
          config: Json
          id: string
          integration_name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config?: Json
          id?: string
          integration_name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: string
          integration_name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      kpi_snapshots: {
        Row: {
          created_at: string | null
          id: string
          kpi_key: string
          meta: Json | null
          period_end: string
          period_start: string
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          kpi_key: string
          meta?: Json | null
          period_end: string
          period_start: string
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          kpi_key?: string
          meta?: Json | null
          period_end?: string
          period_start?: string
          value?: number
        }
        Relationships: []
      }
      lab_parts: {
        Row: {
          created_at: string | null
          data_entrada: string | null
          descricao: string
          equipamento_origem: string
          etapa_atual: string | null
          fotos_urls: string[] | null
          id: string
          localizacao: string | null
          notas: string | null
          pecas_consumidas: Json | null
          previsao_conclusao: string | null
          serial_number: string | null
          status: string
          tecnico_id: string | null
          tempo_total_min: number | null
          tipo_peca: string | null
          updated_at: string | null
          user_id: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_entrada?: string | null
          descricao?: string
          equipamento_origem?: string
          etapa_atual?: string | null
          fotos_urls?: string[] | null
          id?: string
          localizacao?: string | null
          notas?: string | null
          pecas_consumidas?: Json | null
          previsao_conclusao?: string | null
          serial_number?: string | null
          status?: string
          tecnico_id?: string | null
          tempo_total_min?: number | null
          tipo_peca?: string | null
          updated_at?: string | null
          user_id: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_entrada?: string | null
          descricao?: string
          equipamento_origem?: string
          etapa_atual?: string | null
          fotos_urls?: string[] | null
          id?: string
          localizacao?: string | null
          notas?: string | null
          pecas_consumidas?: Json | null
          previsao_conclusao?: string | null
          serial_number?: string | null
          status?: string
          tecnico_id?: string | null
          tempo_total_min?: number | null
          tipo_peca?: string | null
          updated_at?: string | null
          user_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_parts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
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
      meeting_logs: {
        Row: {
          channel_id: string | null
          created_at: string | null
          created_by: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          metadata: Json | null
          participants: Json | null
          recording_url: string | null
          room_name: string
          started_at: string
          summary: string | null
          transcription: string | null
          work_order_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          created_by: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          participants?: Json | null
          recording_url?: string | null
          room_name: string
          started_at?: string
          summary?: string | null
          transcription?: string | null
          work_order_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          created_by?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          participants?: Json | null
          recording_url?: string | null
          room_name?: string
          started_at?: string
          summary?: string | null
          transcription?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "corporate_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_logs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants_map: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          participant_identity: string
          user_id: string
          whatsapp_e164: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          participant_identity: string
          user_id: string
          whatsapp_e164?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          participant_identity?: string
          user_id?: string
          whatsapp_e164?: string | null
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          metadata: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          metadata?: Json | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          metadata?: Json | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_responses: {
        Row: {
          analisado_por_ia: boolean | null
          analise_ia: Json | null
          created_at: string
          decisores: string | null
          ferramentas_criticas: string | null
          funcao: string
          id: string
          mudaria_no_setor: string | null
          pontos_melhoria: string | null
          principal_gargalo: string | null
          qualidades: string | null
          responsabilidades: string | null
          respostas_completas: Json | null
          resumo_dia_dia: string | null
          setor: string
          tarefas_repetitivas: string | null
          tempo_casa: string | null
          tempo_tarefas_manuais: string | null
          unidade: string
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          analisado_por_ia?: boolean | null
          analise_ia?: Json | null
          created_at?: string
          decisores?: string | null
          ferramentas_criticas?: string | null
          funcao: string
          id?: string
          mudaria_no_setor?: string | null
          pontos_melhoria?: string | null
          principal_gargalo?: string | null
          qualidades?: string | null
          responsabilidades?: string | null
          respostas_completas?: Json | null
          resumo_dia_dia?: string | null
          setor: string
          tarefas_repetitivas?: string | null
          tempo_casa?: string | null
          tempo_tarefas_manuais?: string | null
          unidade?: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          analisado_por_ia?: boolean | null
          analise_ia?: Json | null
          created_at?: string
          decisores?: string | null
          ferramentas_criticas?: string | null
          funcao?: string
          id?: string
          mudaria_no_setor?: string | null
          pontos_melhoria?: string | null
          principal_gargalo?: string | null
          qualidades?: string | null
          responsabilidades?: string | null
          respostas_completas?: Json | null
          resumo_dia_dia?: string | null
          setor?: string
          tarefas_repetitivas?: string | null
          tempo_casa?: string | null
          tempo_tarefas_manuais?: string | null
          unidade?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      openclaw_event_queue: {
        Row: {
          attempts: number
          created_at: string
          data: Json
          delivered_at: string | null
          domain: string
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          meta: Json | null
          next_retry_at: string | null
          priority: string
          status: string
          tags: string[] | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          data?: Json
          delivered_at?: string | null
          domain?: string
          event_id?: string
          event_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          meta?: Json | null
          next_retry_at?: string | null
          priority?: string
          status?: string
          tags?: string[] | null
        }
        Update: {
          attempts?: number
          created_at?: string
          data?: Json
          delivered_at?: string | null
          domain?: string
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          meta?: Json | null
          next_retry_at?: string | null
          priority?: string
          status?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      openclaw_sync_status: {
        Row: {
          id: string
          metric_name: string
          metric_value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          metric_name: string
          metric_value?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          metric_name?: string
          metric_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      operational_events: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json
          source: string | null
          status: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          source?: string | null
          status?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          source?: string | null
          status?: string | null
          type?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          ai_trigger_criteria: string | null
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_ai_managed: boolean | null
          is_system: boolean | null
          position: number
          title: string
          updated_at: string | null
        }
        Insert: {
          ai_trigger_criteria?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_managed?: boolean | null
          is_system?: boolean | null
          position?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          ai_trigger_criteria?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_managed?: boolean | null
          is_system?: boolean | null
          position?: number
          title?: string
          updated_at?: string | null
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
          whatsapp: string | null
          whatsapp_consent: boolean | null
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
          whatsapp?: string | null
          whatsapp_consent?: boolean | null
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
          whatsapp?: string | null
          whatsapp_consent?: boolean | null
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          concluida: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          ordem: number | null
          project_id: string
          responsavel_id: string | null
          titulo: string
        }
        Insert: {
          concluida?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number | null
          project_id: string
          responsavel_id?: string | null
          titulo: string
        }
        Update: {
          concluida?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number | null
          project_id?: string
          responsavel_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cliente: string | null
          created_at: string | null
          data_conclusao: string | null
          data_inicio: string | null
          data_prevista: string | null
          descricao: string | null
          documentos_urls: string[] | null
          etapa_atual: string | null
          fotos_urls: string[] | null
          id: string
          notas: string | null
          prioridade: string | null
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string | null
          user_id: string
          valor_contrato: number | null
        }
        Insert: {
          cliente?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_prevista?: string | null
          descricao?: string | null
          documentos_urls?: string[] | null
          etapa_atual?: string | null
          fotos_urls?: string[] | null
          id?: string
          notas?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
          user_id: string
          valor_contrato?: number | null
        }
        Update: {
          cliente?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_prevista?: string | null
          descricao?: string | null
          documentos_urls?: string[] | null
          etapa_atual?: string | null
          fotos_urls?: string[] | null
          id?: string
          notas?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
          user_id?: string
          valor_contrato?: number | null
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
      stock_journeys: {
        Row: {
          concluido_em: string | null
          created_at: string | null
          etapa: string
          etapa_anterior: string | null
          id: string
          iniciado_em: string | null
          lab_part_id: string | null
          notas: string | null
          product_id: string
          responsavel_id: string | null
          work_order_id: string | null
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string | null
          etapa?: string
          etapa_anterior?: string | null
          id?: string
          iniciado_em?: string | null
          lab_part_id?: string | null
          notas?: string | null
          product_id: string
          responsavel_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          concluido_em?: string | null
          created_at?: string | null
          etapa?: string
          etapa_anterior?: string | null
          id?: string
          iniciado_em?: string | null
          lab_part_id?: string | null
          notas?: string | null
          product_id?: string
          responsavel_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_journeys_lab_part_id_fkey"
            columns: ["lab_part_id"]
            isOneToOne: false
            referencedRelation: "lab_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_journeys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_journeys_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          id: string
          motivo: string | null
          notas: string | null
          operador_id: string
          product_id: string
          quantidade: number
          referencia: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          motivo?: string | null
          notas?: string | null
          operador_id: string
          product_id: string
          quantidade?: number
          referencia?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          motivo?: string | null
          notas?: string | null
          operador_id?: string
          product_id?: string
          quantidade?: number
          referencia?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_products: {
        Row: {
          categoria: string
          created_at: string | null
          custo_unitario: number | null
          descricao: string | null
          fornecedor: string | null
          foto_url: string | null
          hexa_id: string | null
          id: string
          localizacao: string | null
          nome: string
          notas: string | null
          part_number: string | null
          quantidade: number
          quantidade_minima: number | null
          serial_number: string | null
          status: string
          updated_at: string | null
          user_id: string
          validade: string | null
        }
        Insert: {
          categoria?: string
          created_at?: string | null
          custo_unitario?: number | null
          descricao?: string | null
          fornecedor?: string | null
          foto_url?: string | null
          hexa_id?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          notas?: string | null
          part_number?: string | null
          quantidade?: number
          quantidade_minima?: number | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          validade?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          custo_unitario?: number | null
          descricao?: string | null
          fornecedor?: string | null
          foto_url?: string | null
          hexa_id?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          notas?: string | null
          part_number?: string | null
          quantidade?: number
          quantidade_minima?: number | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          validade?: string | null
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
      tag_definitions: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          key: string
          label: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          label: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          label?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          slug?: string
          updated_at?: string | null
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
      webhook_events: {
        Row: {
          actor: Json | null
          attempts: number | null
          created_at: string | null
          data: Json | null
          delivered_at: string | null
          entity: Json | null
          event_id: string
          event_type: string
          id: string
          idempotency_hash: string | null
          last_error: string | null
          max_attempts: number | null
          meta: Json | null
          next_retry_at: string | null
          occurred_at: string
          priority: string | null
          received_at: string
          signature_valid: boolean | null
          source: string
          status: string | null
          tags: string[] | null
        }
        Insert: {
          actor?: Json | null
          attempts?: number | null
          created_at?: string | null
          data?: Json | null
          delivered_at?: string | null
          entity?: Json | null
          event_id: string
          event_type: string
          id?: string
          idempotency_hash?: string | null
          last_error?: string | null
          max_attempts?: number | null
          meta?: Json | null
          next_retry_at?: string | null
          occurred_at?: string
          priority?: string | null
          received_at?: string
          signature_valid?: boolean | null
          source: string
          status?: string | null
          tags?: string[] | null
        }
        Update: {
          actor?: Json | null
          attempts?: number | null
          created_at?: string | null
          data?: Json | null
          delivered_at?: string | null
          entity?: Json | null
          event_id?: string
          event_type?: string
          id?: string
          idempotency_hash?: string | null
          last_error?: string | null
          max_attempts?: number | null
          meta?: Json | null
          next_retry_at?: string | null
          occurred_at?: string
          priority?: string | null
          received_at?: string
          signature_valid?: boolean | null
          source?: string
          status?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      webhook_sources: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          hmac_secret: string
          id: string
          ip_allowlist: string[] | null
          name: string
          rate_limit_per_min: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          hmac_secret: string
          id?: string
          ip_allowlist?: string[] | null
          name: string
          rate_limit_per_min?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          hmac_secret?: string
          id?: string
          ip_allowlist?: string[] | null
          name?: string
          rate_limit_per_min?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          blocked_at: string | null
          blocked_reason: string | null
          call_name: string | null
          cargo: string | null
          cidade: string | null
          client_memory: Json | null
          created_at: string | null
          email: string | null
          empresa: string | null
          estado: string | null
          first_contact_date: string | null
          id: string
          is_blocked: boolean | null
          is_business: boolean | null
          last_activity: string | null
          linha_negocio: string | null
          name: string | null
          notes: string | null
          phone_number: string
          profile_picture_url: string | null
          resumo_vivo: string | null
          tags: string[] | null
          updated_at: string | null
          whatsapp_id: string | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_reason?: string | null
          call_name?: string | null
          cargo?: string | null
          cidade?: string | null
          client_memory?: Json | null
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          first_contact_date?: string | null
          id?: string
          is_blocked?: boolean | null
          is_business?: boolean | null
          last_activity?: string | null
          linha_negocio?: string | null
          name?: string | null
          notes?: string | null
          phone_number: string
          profile_picture_url?: string | null
          resumo_vivo?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp_id?: string | null
        }
        Update: {
          blocked_at?: string | null
          blocked_reason?: string | null
          call_name?: string | null
          cargo?: string | null
          cidade?: string | null
          client_memory?: Json | null
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          first_contact_date?: string | null
          id?: string
          is_blocked?: boolean | null
          is_business?: boolean | null
          last_activity?: string | null
          linha_negocio?: string | null
          name?: string | null
          notes?: string | null
          phone_number?: string
          profile_picture_url?: string | null
          resumo_vivo?: string | null
          tags?: string[] | null
          updated_at?: string | null
          whatsapp_id?: string | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_team: string | null
          assigned_user_id: string | null
          contact_id: string
          created_at: string | null
          id: string
          instance_id: string | null
          is_active: boolean | null
          last_message_at: string | null
          metadata: Json | null
          nina_context: Json | null
          started_at: string | null
          status: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          assigned_team?: string | null
          assigned_user_id?: string | null
          contact_id: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          last_message_at?: string | null
          metadata?: Json | null
          nina_context?: Json | null
          started_at?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          assigned_team?: string | null
          assigned_user_id?: string | null
          contact_id?: string
          created_at?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          last_message_at?: string | null
          metadata?: Json | null
          nina_context?: Json | null
          started_at?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_logs: {
        Row: {
          created_at: string | null
          destinatario: string
          destinatario_nome: string | null
          erro: string | null
          evento_origem: string | null
          id: string
          mensagem: string
          metadata: Json | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          destinatario: string
          destinatario_nome?: string | null
          erro?: string | null
          evento_origem?: string | null
          id?: string
          mensagem: string
          metadata?: Json | null
          status?: string
          tipo?: string
        }
        Update: {
          created_at?: string | null
          destinatario?: string
          destinatario_nome?: string | null
          erro?: string | null
          evento_origem?: string | null
          id?: string
          mensagem?: string
          metadata?: Json | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          from_type: string
          id: string
          media_type: string | null
          media_url: string | null
          metadata: Json | null
          nina_response_time: number | null
          processed_by_nina: boolean | null
          read_at: string | null
          reply_to_id: string | null
          sent_at: string | null
          status: string
          type: string
          whatsapp_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          from_type?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          nina_response_time?: number | null
          processed_by_nina?: boolean | null
          read_at?: string | null
          reply_to_id?: string | null
          sent_at?: string | null
          status?: string
          type?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          from_type?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          nina_response_time?: number | null
          processed_by_nina?: boolean | null
          read_at?: string | null
          reply_to_id?: string | null
          sent_at?: string | null
          status?: string
          type?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
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
          contrato_id: string | null
          created_at: string | null
          data_conclusao: string | null
          descricao: string | null
          equipamento: string
          equipamento_serial: string | null
          fotos_urls: string[] | null
          id: string
          localizacao: string | null
          numero_os: string
          observacoes_ia: string | null
          pecas_utilizadas: Json | null
          sla_horas: number | null
          status: string
          tecnico_id: string | null
          tempo_gasto_min: number | null
          tipo_manutencao: string | null
          transcricao_audio: string | null
          updated_at: string | null
          urgencia: string | null
          user_id: string
        }
        Insert: {
          assinatura_url?: string | null
          audio_url?: string | null
          cliente?: string
          contrato_id?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          equipamento?: string
          equipamento_serial?: string | null
          fotos_urls?: string[] | null
          id?: string
          localizacao?: string | null
          numero_os?: string
          observacoes_ia?: string | null
          pecas_utilizadas?: Json | null
          sla_horas?: number | null
          status?: string
          tecnico_id?: string | null
          tempo_gasto_min?: number | null
          tipo_manutencao?: string | null
          transcricao_audio?: string | null
          updated_at?: string | null
          urgencia?: string | null
          user_id: string
        }
        Update: {
          assinatura_url?: string | null
          audio_url?: string | null
          cliente?: string
          contrato_id?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          equipamento?: string
          equipamento_serial?: string | null
          fotos_urls?: string[] | null
          id?: string
          localizacao?: string | null
          numero_os?: string
          observacoes_ia?: string | null
          pecas_utilizadas?: Json | null
          sla_horas?: number | null
          status?: string
          tecnico_id?: string | null
          tempo_gasto_min?: number | null
          tipo_manutencao?: string | null
          transcricao_audio?: string | null
          updated_at?: string | null
          urgencia?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      openclaw_sync_queue: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string | null
          last_error: string | null
          payload: Json | null
          retry_count: number | null
          scheduled_for: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string | null
          last_error?: string | null
          payload?: Json | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string | null
          last_error?: string | null
          payload?: Json | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string | null
        }
        Relationships: []
      }
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
