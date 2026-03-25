
-- Add missing columns to work_orders for complete OS detail
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS tipo_manutencao text DEFAULT 'corretiva',
  ADD COLUMN IF NOT EXISTS pecas_utilizadas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fotos_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS localizacao text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contrato_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS equipamento_serial text DEFAULT '',
  ADD COLUMN IF NOT EXISTS data_conclusao timestamptz DEFAULT NULL;

-- Add missing columns to lab_parts for better workflow
ALTER TABLE public.lab_parts
  ADD COLUMN IF NOT EXISTS tipo_peca text DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS serial_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS etapa_atual text DEFAULT 'recebimento',
  ADD COLUMN IF NOT EXISTS tempo_total_min integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pecas_consumidas jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fotos_urls text[] DEFAULT '{}'::text[];

-- Add missing columns to projects for document/photo management
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS documentos_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS fotos_urls text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS etapa_atual text DEFAULT 'planejamento';

-- Create contracts table for CRM integration
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  valor_mensal numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  data_inicio timestamptz DEFAULT now(),
  data_fim timestamptz DEFAULT NULL,
  tipo text DEFAULT 'mensal',
  status text DEFAULT 'ativo',
  equipamentos jsonb DEFAULT '[]'::jsonb,
  notas text DEFAULT '',
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contracts" ON public.contracts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all contracts" ON public.contracts
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert contracts" ON public.contracts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own contracts" ON public.contracts
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
