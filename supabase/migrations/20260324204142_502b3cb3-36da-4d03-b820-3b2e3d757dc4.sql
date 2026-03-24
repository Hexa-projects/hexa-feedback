
-- Projects & Implementation module
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text DEFAULT '',
  cliente text DEFAULT '',
  responsavel_id uuid,
  status text NOT NULL DEFAULT 'Planejamento',
  prioridade text DEFAULT 'Média',
  data_inicio timestamp with time zone DEFAULT now(),
  data_prevista timestamp with time zone,
  data_conclusao timestamp with time zone,
  valor_contrato numeric DEFAULT 0,
  notas text DEFAULT '',
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  responsavel_id uuid,
  concluida boolean DEFAULT false,
  ordem integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'receita',
  categoria text DEFAULT '',
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento timestamp with time zone,
  data_pagamento timestamp with time zone,
  status text NOT NULL DEFAULT 'pendente',
  cliente text DEFAULT '',
  referencia text DEFAULT '',
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all projects" ON public.projects FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT TO authenticated USING (user_id = auth.uid() OR responsavel_id = auth.uid());
CREATE POLICY "Users can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO authenticated USING (user_id = auth.uid() OR responsavel_id = auth.uid());

CREATE POLICY "Admins can manage all tasks" ON public.project_tasks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can manage project tasks" ON public.project_tasks FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR p.responsavel_id = auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR p.responsavel_id = auth.uid())));

CREATE POLICY "Admins can manage all financial" ON public.financial_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own financial" ON public.financial_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert financial" ON public.financial_records FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_financial_updated_at BEFORE UPDATE ON public.financial_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
