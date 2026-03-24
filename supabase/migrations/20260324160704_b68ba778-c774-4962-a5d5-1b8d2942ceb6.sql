
-- =============================================
-- TABELAS DO CRM & VENDAS
-- =============================================

-- Leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  empresa text DEFAULT '',
  email text DEFAULT '',
  telefone text DEFAULT '',
  status text NOT NULL DEFAULT 'Qualificação',
  responsavel_id uuid REFERENCES auth.users(id),
  ultimo_contato timestamptz,
  valor_estimado numeric DEFAULT 0,
  origem text DEFAULT '',
  notas text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads" ON public.leads FOR SELECT TO authenticated USING (user_id = auth.uid() OR responsavel_id = auth.uid());
CREATE POLICY "Admins can view all leads" ON public.leads FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestores can view sector leads" ON public.leads FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Users can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own leads" ON public.leads FOR UPDATE TO authenticated USING (user_id = auth.uid() OR responsavel_id = auth.uid());
CREATE POLICY "Admins can update all leads" ON public.leads FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Lead Interactions
CREATE TABLE public.lead_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'nota',
  conteudo text NOT NULL DEFAULT '',
  audio_url text,
  transcricao_audio text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lead interactions" ON public.lead_interactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all interactions" ON public.lead_interactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert interactions" ON public.lead_interactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Proposals
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  valor numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'Rascunho',
  validade_dias int DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposals" ON public.proposals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all proposals" ON public.proposals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert proposals" ON public.proposals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own proposals" ON public.proposals FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- TABELAS DE OS / MANUTENÇÃO
-- =============================================

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_os text NOT NULL DEFAULT '',
  cliente text NOT NULL DEFAULT '',
  equipamento text NOT NULL DEFAULT '',
  descricao text DEFAULT '',
  status text NOT NULL DEFAULT 'Aberto',
  tecnico_id uuid REFERENCES auth.users(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  urgencia text DEFAULT 'Média',
  sla_horas int DEFAULT 48,
  tempo_gasto_min int DEFAULT 0,
  audio_url text,
  transcricao_audio text,
  assinatura_url text,
  observacoes_ia text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OS" ON public.work_orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR tecnico_id = auth.uid());
CREATE POLICY "Admins can view all OS" ON public.work_orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestores can view all OS" ON public.work_orders FOR SELECT TO authenticated USING (has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Users can insert OS" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own OS" ON public.work_orders FOR UPDATE TO authenticated USING (user_id = auth.uid() OR tecnico_id = auth.uid());
CREATE POLICY "Admins can update all OS" ON public.work_orders FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- OS Activities / Checklist
CREATE TABLE public.work_order_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  concluida boolean DEFAULT false,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.work_order_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view OS activities" ON public.work_order_activities FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all activities" ON public.work_order_activities FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert activities" ON public.work_order_activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update activities" ON public.work_order_activities FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- TABELAS DO LABORATÓRIO
-- =============================================

CREATE TABLE public.lab_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_origem text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Entrada',
  tecnico_id uuid REFERENCES auth.users(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_entrada timestamptz DEFAULT now(),
  previsao_conclusao timestamptz,
  localizacao text DEFAULT '',
  notas text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lab_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parts" ON public.lab_parts FOR SELECT TO authenticated USING (user_id = auth.uid() OR tecnico_id = auth.uid());
CREATE POLICY "Admins can view all parts" ON public.lab_parts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert parts" ON public.lab_parts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own parts" ON public.lab_parts FOR UPDATE TO authenticated USING (user_id = auth.uid() OR tecnico_id = auth.uid());

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "Anyone can view attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');

-- Updated_at triggers
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_lab_parts_updated_at BEFORE UPDATE ON public.lab_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
