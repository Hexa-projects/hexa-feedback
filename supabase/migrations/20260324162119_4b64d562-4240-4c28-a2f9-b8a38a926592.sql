
-- Focus AI configuration table (one row per org, using singleton pattern)
CREATE TABLE public.focus_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- OpenClaw
  openclaw_url text DEFAULT '',
  openclaw_api_key text DEFAULT '',
  openclaw_env text DEFAULT 'prod',
  openclaw_ativo boolean DEFAULT false,
  -- LLM
  llm_modelo text DEFAULT 'Claude Sonnet 4.6',
  llm_api_key text DEFAULT '',
  llm_temperatura numeric DEFAULT 0.7,
  llm_max_tokens integer DEFAULT 4096,
  llm_limite_custo_mensal numeric DEFAULT 100,
  -- Prompt base
  prompt_identidade text DEFAULT '',
  prompt_objetivo text DEFAULT '',
  prompt_tom_voz text DEFAULT '',
  prompt_restricoes text DEFAULT '',
  -- Memory + RAG
  memoria_ativa boolean DEFAULT false,
  rag_provedor_embeddings text DEFAULT 'Google Gemini',
  rag_fonte text DEFAULT 'Supabase + Documentos',
  -- Guardrails
  guardrail_custo_mensal numeric DEFAULT 200,
  guardrail_aprovacao_humana boolean DEFAULT true,
  guardrail_max_mensagens_dia integer DEFAULT 500,
  -- Meta
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.focus_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage focus_ai_config" ON public.focus_ai_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Focus AI skills table
CREATE TABLE public.focus_ai_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text DEFAULT '',
  status text DEFAULT 'Disponível',
  versao text DEFAULT '1.0',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.focus_ai_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage skills" ON public.focus_ai_skills
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Focus AI execution logs
CREATE TABLE public.focus_ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'info',
  mensagem text NOT NULL,
  detalhes jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.focus_ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logs" ON public.focus_ai_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs" ON public.focus_ai_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Focus AI scheduled routines
CREATE TABLE public.focus_ai_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text DEFAULT '',
  frequencia text DEFAULT 'Diário',
  ativo boolean DEFAULT true,
  ultima_execucao timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.focus_ai_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage routines" ON public.focus_ai_routines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Focus AI suggested actions / insights
CREATE TABLE public.focus_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text DEFAULT 'insight',
  titulo text NOT NULL,
  descricao text DEFAULT '',
  status text DEFAULT 'pendente',
  prioridade text DEFAULT 'Média',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.focus_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage insights" ON public.focus_ai_insights
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default skills
INSERT INTO public.focus_ai_skills (nome, descricao, status) VALUES
  ('openclaw-ops-guardrails', 'Guardrails de segurança e controle operacional', 'Disponível'),
  ('memory-tiering', 'Memória inteligente com camadas de contexto', 'Disponível'),
  ('rag-system-builder', 'Construtor de sistema RAG para base de conhecimento', 'Disponível'),
  ('rag-ingest', 'Ingestão e indexação de documentos para RAG', 'Disponível'),
  ('openclaw-power-ops', 'Operações avançadas e automações complexas', 'Disponível'),
  ('openclaw-whatsapp', 'Integração com WhatsApp via Evolution API', 'Disponível'),
  ('porteden-email', 'Integração de e-mail com templates inteligentes', 'Disponível');

-- Seed default routines
INSERT INTO public.focus_ai_routines (nome, descricao, frequencia) VALUES
  ('Resumo diário de gargalos', 'Analisa bottlenecks e gera resumo automático', 'Diário'),
  ('Alertas de SLA', 'Monitora OS próximas do vencimento de SLA', 'Diário'),
  ('Oportunidades de renovação', 'Identifica contratos próximos do vencimento', 'Semanal'),
  ('Análise de performance comercial', 'Gera relatório de conversão do funil', 'Semanal');

-- Insert default config row
INSERT INTO public.focus_ai_config (id) VALUES (gen_random_uuid());
