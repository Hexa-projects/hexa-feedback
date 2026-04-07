
-- Enable pgvector for knowledge chunks
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. automation_executions
CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type text NOT NULL,
  trigger_entity text,
  trigger_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  executed_by text DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_automation_executions" ON public.automation_executions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_read_automation_executions" ON public.automation_executions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 2. knowledge_chunks
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  source_file text,
  source_url text,
  equipment_model text,
  equipment_brand text,
  doc_type text DEFAULT 'manual',
  tags text[] DEFAULT '{}',
  embedding extensions.vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_knowledge" ON public.knowledge_chunks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_knowledge" ON public.knowledge_chunks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins_manage_knowledge" ON public.knowledge_chunks
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS knowledge_chunks_model_idx ON public.knowledge_chunks (equipment_model);
CREATE INDEX IF NOT EXISTS knowledge_chunks_brand_idx ON public.knowledge_chunks (equipment_brand);

-- 3. inventory
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  category text DEFAULT 'geral',
  current_quantity integer NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 5,
  unit text DEFAULT 'un',
  location text,
  supplier text,
  cost_per_unit numeric DEFAULT 0,
  notes text,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_inventory" ON public.inventory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_inventory" ON public.inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins_manage_inventory" ON public.inventory
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "users_insert_inventory" ON public.inventory
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Add work_order_id to existing stock_movements
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS work_order_id uuid;

-- Triggers
CREATE TRIGGER update_automation_executions_updated_at BEFORE UPDATE ON public.automation_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_knowledge_chunks_updated_at BEFORE UPDATE ON public.knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
