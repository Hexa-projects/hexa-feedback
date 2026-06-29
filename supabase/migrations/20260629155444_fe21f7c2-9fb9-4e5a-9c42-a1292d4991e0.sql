
CREATE TABLE public.commercial_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  empresa TEXT NOT NULL,
  cnpj TEXT,
  telefone TEXT,
  endereco TEXT,
  contato TEXT,
  responsavel_comercial TEXT,
  email_1 TEXT,
  email_2 TEXT,
  equipamento TEXT,
  itens_inclusos TEXT,
  itens_nao_inclusos TEXT,
  preco NUMERIC(14,2),
  condicoes_pagamento TEXT,
  tempo_garantia TEXT,
  frete TEXT,
  comissao NUMERIC(6,2),
  origem TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_requests TO authenticated;
GRANT ALL ON public.commercial_requests TO service_role;

ALTER TABLE public.commercial_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own commercial_requests"
  ON public.commercial_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view commercial_requests"
  ON public.commercial_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update commercial_requests"
  ON public.commercial_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete commercial_requests"
  ON public.commercial_requests FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_commercial_requests_updated_at
  BEFORE UPDATE ON public.commercial_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_commercial_requests_user ON public.commercial_requests(user_id);
CREATE INDEX idx_commercial_requests_status ON public.commercial_requests(status);
CREATE INDEX idx_commercial_requests_tipo ON public.commercial_requests(tipo);
