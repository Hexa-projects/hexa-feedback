
-- Stock Products (catálogo de peças)
CREATE TABLE public.stock_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Geral',
  descricao TEXT DEFAULT '',
  serial_number TEXT,
  part_number TEXT,
  hexa_id TEXT,
  foto_url TEXT,
  quantidade INTEGER NOT NULL DEFAULT 0,
  quantidade_minima INTEGER DEFAULT 0,
  localizacao TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Disponível',
  validade TIMESTAMPTZ,
  fornecedor TEXT DEFAULT '',
  custo_unitario NUMERIC DEFAULT 0,
  notas TEXT DEFAULT '',
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access stock_products" ON public.stock_products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view stock_products" ON public.stock_products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert stock_products" ON public.stock_products FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own stock_products" ON public.stock_products FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_stock_products_updated_at BEFORE UPDATE ON public.stock_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Stock Movements (movimentações)
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'entrada',
  quantidade INTEGER NOT NULL DEFAULT 1,
  motivo TEXT DEFAULT '',
  operador_id UUID NOT NULL,
  referencia TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (operador_id = auth.uid());

CREATE POLICY "Admins full access movements" ON public.stock_movements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Stock Journeys (jornada da peça / kanban)
CREATE TABLE public.stock_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL DEFAULT 'Entrada Almoxarifado',
  etapa_anterior TEXT,
  responsavel_id UUID,
  work_order_id UUID REFERENCES public.work_orders(id),
  lab_part_id UUID REFERENCES public.lab_parts(id),
  notas TEXT DEFAULT '',
  iniciado_em TIMESTAMPTZ DEFAULT now(),
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stock_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view journeys" ON public.stock_journeys FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert journeys" ON public.stock_journeys FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update journeys" ON public.stock_journeys FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admins full access journeys" ON public.stock_journeys FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Installed Equipment (equipamentos instalados em clientes)
CREATE TABLE public.installed_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  modelo TEXT DEFAULT '',
  serial_number TEXT,
  cliente TEXT NOT NULL,
  localizacao TEXT DEFAULT '',
  data_instalacao TIMESTAMPTZ,
  ultima_manutencao TIMESTAMPTZ,
  proxima_manutencao TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Ativo',
  contrato_id TEXT,
  notas TEXT DEFAULT '',
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.installed_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view equipment" ON public.installed_equipment FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert equipment" ON public.installed_equipment FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update equipment" ON public.installed_equipment FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access equipment" ON public.installed_equipment FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_installed_equipment_updated_at BEFORE UPDATE ON public.installed_equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
