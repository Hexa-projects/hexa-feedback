-- Feedback Ana e Leticia: commercial and cross-sector traceability.
-- This migration is additive so existing CRM/RD Station data keeps working.

ALTER TABLE public.commercial_requests
  ADD COLUMN IF NOT EXISTS business_line text,
  ADD COLUMN IF NOT EXISTS requester_name text,
  ADD COLUMN IF NOT EXISTS customer_state text,
  ADD COLUMN IF NOT EXISTS piece_source text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_cost numeric(14,2),
  ADD COLUMN IF NOT EXISTS decision_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_detail text DEFAULT 'pendente_gestao',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS proposal_number text,
  ADD COLUMN IF NOT EXISTS equipment text,
  ADD COLUMN IF NOT EXISTS business_line text,
  ADD COLUMN IF NOT EXISTS requester_name text,
  ADD COLUMN IF NOT EXISTS customer_state text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'nao_informado',
  ADD COLUMN IF NOT EXISTS document_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_email_to text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS funnel_id text DEFAULT 'vendas',
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS warranty_months integer,
  ADD COLUMN IF NOT EXISTS warranty_start date,
  ADD COLUMN IF NOT EXISTS warranty_end date,
  ADD COLUMN IF NOT EXISTS contract_required boolean,
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_cpf text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS stage text DEFAULT 'pendente_aprovacao_gestao',
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_cpf text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'nao_informado';

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_uuid uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_number text,
  ADD COLUMN IF NOT EXISTS contract_number text;

ALTER TABLE public.installed_equipment
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_name text;

CREATE UNIQUE INDEX IF NOT EXISTS installed_equipment_proposal_id_key
  ON public.installed_equipment (proposal_id) WHERE proposal_id IS NOT NULL;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric(14,2),
  ADD COLUMN IF NOT EXISTS sale_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

ALTER TABLE public.lab_parts
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS proposals_proposal_number_key
  ON public.proposals (proposal_number) WHERE proposal_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contracts_contract_number_key
  ON public.contracts (contract_number) WHERE contract_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lab_parts_proposal_id_key
  ON public.lab_parts (proposal_id) WHERE proposal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS proposals_reporting_idx
  ON public.proposals (created_at, status, business_line, customer_state);
CREATE INDEX IF NOT EXISTS leads_warranty_end_idx
  ON public.leads (warranty_end) WHERE warranty_end IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commercial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.commercial_settings (key, value, description)
VALUES ('stale_lead_hours', '72'::jsonb, 'Prazo sem contato usado nos indicadores comerciais')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.crm_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_funnel_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES public.crm_funnels(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage_type text NOT NULL DEFAULT 'open' CHECK (stage_type IN ('open','won','lost')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (funnel_id, name)
);

INSERT INTO public.crm_funnels (code, name, sort_order) VALUES
  ('prospeccao', 'Prospeccao', 10), ('vendas', 'Vendas', 20),
  ('servicos', 'Servicos', 30), ('hexa_ai', 'Hexa AI', 40),
  ('pos_vendas', 'Pos-vendas', 50)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

WITH stage_seed(code, name, kind, ord) AS (VALUES
  ('prospeccao','Novo Lead','open',10), ('prospeccao','Tentando Contato','open',20),
  ('prospeccao','Qualificacao','open',30), ('prospeccao','Oportunidade Validada','open',40),
  ('prospeccao','Reuniao Agendada','open',50), ('prospeccao','Apresentar Proposta','open',60),
  ('prospeccao','Follow-up para Negociacao','open',70), ('prospeccao','Em Negociacao','open',80),
  ('vendas','Novo Negocio','open',10), ('vendas','Reuniao Agendada','open',20),
  ('vendas','Qualificacao','open',30), ('vendas','Proposta Enviada','open',40),
  ('vendas','Negociacao','open',50), ('vendas','Negocio Ganho','won',60),
  ('vendas','Perdido','lost',70),
  ('servicos','Atendimento Inicial','open',10), ('servicos','Proposta Enviada','open',20),
  ('servicos','Proposta Aprovada','open',30), ('servicos','Faturamento','open',40),
  ('servicos','Negocio Ganho','won',50), ('servicos','Interesse Futuro','lost',60),
  ('hexa_ai','Novo Lead','open',10), ('hexa_ai','Qualificacao','open',20),
  ('hexa_ai','Orcamento Enviado','open',30), ('hexa_ai','Instalando Demo','open',40),
  ('hexa_ai','Demo em Processo','open',50), ('hexa_ai','Negociacao','open',60),
  ('hexa_ai','Fechamento','won',70),
  ('pos_vendas','Avaliacao de Satisfacao','open',10), ('pos_vendas','Renovacao','open',20),
  ('pos_vendas','Up Sell','open',30), ('pos_vendas','Cliente em Risco','open',40),
  ('pos_vendas','Cliente Perdido','lost',50)
)
INSERT INTO public.crm_funnel_stages (funnel_id, name, stage_type, sort_order)
SELECT f.id, s.name, s.kind, s.ord FROM stage_seed s JOIN public.crm_funnels f ON f.code = s.code
ON CONFLICT (funnel_id, name) DO UPDATE SET stage_type = EXCLUDED.stage_type, sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.proposal_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error_message text,
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  model text NOT NULL,
  modality text,
  dimensions text,
  weight_kg numeric,
  infrastructure jsonb NOT NULL DEFAULT '{}'::jsonb,
  coils text[] NOT NULL DEFAULT '{}',
  electrical_requirements text,
  installation_requirements text,
  accessories text[] NOT NULL DEFAULT '{}',
  image_urls text[] NOT NULL DEFAULT '{}',
  commercial_material_urls text[] NOT NULL DEFAULT '{}',
  technical_notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer, model)
);

CREATE TABLE IF NOT EXISTS public.financial_visibility_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commercial_audit_log (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.proposal_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq START 1;

CREATE OR REPLACE FUNCTION public.prepare_proposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.proposal_number IS NULL OR btrim(NEW.proposal_number) = '' THEN
    NEW.proposal_number := 'PROP-' || to_char(COALESCE(NEW.created_at, now()), 'YYYY') || '-' ||
      lpad(nextval('public.proposal_number_seq')::text, 6, '0');
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := COALESCE(NEW.sent_at, NEW.created_at, now()) + make_interval(days => COALESCE(NEW.validade_dias, 30));
  END IF;
  IF lower(COALESCE(NEW.status, '')) IN ('enviada','enviado') AND NEW.sent_at IS NULL THEN
    NEW.sent_at := now();
    NEW.expires_at := now() + make_interval(days => COALESCE(NEW.validade_dias, 30));
  END IF;
  IF lower(COALESCE(NEW.status, '')) IN ('aceita','aprovada') AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.track_commercial_request_decision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('aprovada', 'reprovada') THEN
    NEW.decision_by := auth.uid();
    NEW.decision_at := now();
    NEW.status_detail := CASE WHEN NEW.status = 'aprovada' THEN 'aprovada' ELSE 'reprovada' END;
  ELSIF NEW.status = 'pendente' AND COALESCE(NEW.status_detail, '') = '' THEN
    NEW.status_detail := 'pendente_gestao';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_track_commercial_request_decision ON public.commercial_requests;
CREATE TRIGGER trg_track_commercial_request_decision BEFORE UPDATE OF status ON public.commercial_requests
FOR EACH ROW EXECUTE FUNCTION public.track_commercial_request_decision();

DROP TRIGGER IF EXISTS trg_prepare_proposal ON public.proposals;
CREATE TRIGGER trg_prepare_proposal BEFORE INSERT OR UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.prepare_proposal();

CREATE OR REPLACE FUNCTION public.prepare_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.contract_number IS NULL OR btrim(NEW.contract_number) = '' THEN
    NEW.contract_number := 'CONT-' || to_char(COALESCE(NEW.created_at, now()), 'YYYY') || '-' ||
      lpad(nextval('public.contract_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prepare_contract ON public.contracts;
CREATE TRIGGER trg_prepare_contract BEFORE INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.prepare_contract();

CREATE OR REPLACE FUNCTION public.route_approved_repair_to_lab()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(COALESCE(NEW.status,'')) IN ('aceita','aprovada')
     AND lower(COALESCE(NEW.business_line,'')) IN ('reparo','reparos')
     AND (TG_OP = 'INSERT' OR lower(COALESCE(OLD.status,'')) NOT IN ('aceita','aprovada')) THEN
    INSERT INTO public.lab_parts (equipamento_origem, descricao, status, user_id, proposal_id, source_type, notas)
    VALUES (COALESCE(NEW.equipment,''), NEW.titulo, 'Entrada', NEW.user_id, NEW.id, 'proposta_aprovada',
            'Criado automaticamente a partir da proposta ' || COALESCE(NEW.proposal_number, NEW.id::text))
    ON CONFLICT (proposal_id) WHERE proposal_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.route_approved_equipment_to_installed_base()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE company_name text;
BEGIN
  IF lower(COALESCE(NEW.status,'')) IN ('aceita','aprovada')
     AND lower(COALESCE(NEW.business_line,'')) IN ('equipamento_novo','equipamento_usado')
     AND (TG_OP = 'INSERT' OR lower(COALESCE(OLD.status,'')) NOT IN ('aceita','aprovada')) THEN
    SELECT COALESCE(empresa, nome) INTO company_name FROM public.leads WHERE id = NEW.lead_id;
    INSERT INTO public.installed_equipment (nome, cliente, organization_name, status, user_id, proposal_id, notas)
    VALUES (COALESCE(NEW.equipment, NEW.titulo), COALESCE(company_name, 'Cliente a confirmar'), company_name,
            'Aguardando instalacao', NEW.user_id, NEW.id,
            'Criado automaticamente a partir da proposta ' || COALESCE(NEW.proposal_number, NEW.id::text))
    ON CONFLICT (proposal_id) WHERE proposal_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_route_approved_repair_to_lab ON public.proposals;
CREATE TRIGGER trg_route_approved_repair_to_lab AFTER INSERT OR UPDATE OF status ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.route_approved_repair_to_lab();

DROP TRIGGER IF EXISTS trg_route_approved_equipment ON public.proposals;
CREATE TRIGGER trg_route_approved_equipment AFTER INSERT OR UPDATE OF status ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.route_approved_equipment_to_installed_base();

CREATE OR REPLACE VIEW public.company_proposal_history
WITH (security_invoker = true) AS
SELECT p.id, p.proposal_number, p.created_at, p.sent_at, p.status, p.valor,
       p.equipment, p.business_line, p.requester_name, p.customer_state,
       l.empresa AS company_name, l.nome AS contact_name, l.email, l.telefone,
       p.user_id, p.lead_id
FROM public.proposals p
LEFT JOIN public.leads l ON l.id = p.lead_id
WHERE p.deleted_at IS NULL;

ALTER TABLE public.commercial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_visibility_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read commercial settings" ON public.commercial_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage commercial settings" ON public.commercial_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read funnels" ON public.crm_funnels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage funnels" ON public.crm_funnels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read funnel stages" ON public.crm_funnel_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage funnel stages" ON public.crm_funnel_stages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read proposal email events" ON public.proposal_email_events FOR SELECT TO authenticated USING (sent_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users create proposal email events" ON public.proposal_email_events FOR INSERT TO authenticated WITH CHECK (sent_by = auth.uid());
CREATE POLICY "Authenticated read equipment library" ON public.equipment_library FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers manage equipment library" ON public.equipment_library FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users read own financial grant" ON public.financial_visibility_grants FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage financial grants" ON public.financial_visibility_grants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers read commercial audit" ON public.commercial_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users append commercial audit" ON public.commercial_audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Granted commercial users view financial status" ON public.financial_records
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.financial_visibility_grants g WHERE g.user_id = auth.uid() AND g.active)
);

GRANT SELECT ON public.company_proposal_history TO authenticated;
GRANT SELECT ON public.commercial_settings, public.crm_funnels, public.crm_funnel_stages, public.equipment_library TO authenticated;
GRANT SELECT, INSERT ON public.proposal_email_events, public.commercial_audit_log TO authenticated;
GRANT SELECT ON public.financial_visibility_grants TO authenticated;

-- The feedback explicitly authorizes these commercial users to see payment status.
INSERT INTO public.financial_visibility_grants (user_id)
SELECT id FROM public.profiles
WHERE lower(split_part(btrim(nome), ' ', 1)) IN ('ana', 'leticia', 'letícia', 'anderson')
ON CONFLICT (user_id) DO UPDATE SET active = true;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_warranty_alert_unique_idx
  ON public.notifications (user_id, ((metadata->>'event_type')), ((metadata->>'lead_id')), ((metadata->>'warranty_end')))
  WHERE metadata->>'event_type' = 'commercial_warranty_expiring';

CREATE OR REPLACE FUNCTION public.create_warranty_expiration_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer;
BEGIN
  INSERT INTO public.notifications (user_id, titulo, mensagem, tipo, lida, link, metadata)
  SELECT COALESCE(l.responsavel_id, l.user_id), 'Garantia próxima do vencimento',
         COALESCE(l.empresa, l.nome) || ' · vence em ' || to_char(l.warranty_end, 'DD/MM/YYYY'),
         'alerta', false, '/crm/' || l.id::text,
         jsonb_build_object('event_type','commercial_warranty_expiring','lead_id',l.id,'warranty_end',l.warranty_end)
  FROM public.leads l
  WHERE l.warranty_end BETWEEN current_date AND current_date + 30
    AND l.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'hexaos-warranty-alerts';
SELECT cron.schedule('hexaos-warranty-alerts', '15 11 * * *', $$SELECT public.create_warranty_expiration_notifications();$$);
