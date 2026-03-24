
-- Add domain classification to event queue
ALTER TABLE public.openclaw_event_queue ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'general';

-- Expand focus_ai_insights with playbook fields
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS domain text DEFAULT 'general';
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS causa_provavel text DEFAULT '';
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS impacto_estimado text DEFAULT '';
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS acao_recomendada text DEFAULT '';
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS responsavel_sugerido text DEFAULT '';
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS prazo_sugerido text DEFAULT '';
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS criterio_sucesso text DEFAULT '';
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS evidencia_dados jsonb DEFAULT '{}';
ALTER TABLE public.focus_ai_insights ADD COLUMN IF NOT EXISTS nivel_autonomia text DEFAULT 'A';

-- Autonomy matrix config table
CREATE TABLE IF NOT EXISTS public.autonomy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL,
  domain text NOT NULL DEFAULT 'general',
  nivel text NOT NULL DEFAULT 'A',
  descricao text DEFAULT '',
  permitido boolean DEFAULT true,
  requer_aprovacao boolean DEFAULT true,
  limite_diario integer DEFAULT 10,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.autonomy_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage autonomy rules" ON public.autonomy_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Data catalog cache table
CREATE TABLE IF NOT EXISTS public.data_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  schema_name text DEFAULT 'public',
  column_count integer DEFAULT 0,
  row_count integer DEFAULT 0,
  last_updated timestamptz,
  columns_info jsonb DEFAULT '[]',
  foreign_keys jsonb DEFAULT '[]',
  quality_score numeric DEFAULT 0,
  domain text DEFAULT 'general',
  business_description text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.data_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage data catalog" ON public.data_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default autonomy rules
INSERT INTO public.autonomy_rules (acao, domain, nivel, descricao, permitido, requer_aprovacao) VALUES
  ('analise_dados', 'general', 'A', 'Análise read-only de dados operacionais', true, false),
  ('gerar_insight', 'general', 'A', 'Gerar insights e recomendações', true, false),
  ('enviar_alerta', 'ops', 'B', 'Enviar alertas de risco operacional', true, true),
  ('enviar_resumo', 'general', 'B', 'Enviar resumo executivo diário/semanal', true, false),
  ('criar_tarefa', 'ops', 'C', 'Criar tarefas automaticamente', false, true),
  ('enviar_whatsapp', 'sales', 'C', 'Enviar mensagens WhatsApp automáticas', false, true),
  ('enviar_email', 'sales', 'C', 'Enviar emails automáticos', false, true),
  ('modificar_dados', 'general', 'D', 'Qualquer alteração de dados', false, true),
  ('aprovar_proposta', 'finance', 'D', 'Aprovar propostas automaticamente', false, true),
  ('cancelar_os', 'ops', 'D', 'Cancelar ordens de serviço', false, true)
ON CONFLICT DO NOTHING;
