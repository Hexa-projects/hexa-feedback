-- =====================================================================
-- Fluxo de aprovação de solicitações comerciais
-- - Solicitação nasce como 'pendente'
-- - CEOs são notificados em realtime
-- - Aprovação via RPC cria lead em "Novo Negócio" (funil vendas)
-- - Reprovação com motivo, sem criar lead
-- =====================================================================

-- 1) Colunas de aprovação --------------------------------------------
ALTER TABLE public.commercial_requests
  ADD COLUMN IF NOT EXISTS approved_by       uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at       timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by       uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at       timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason  text,
  ADD COLUMN IF NOT EXISTS converted_lead_id uuid REFERENCES public.leads(id),
  ADD COLUMN IF NOT EXISTS submitted_at      timestamptz DEFAULT now();

-- Backfill submitted_at para linhas antigas
UPDATE public.commercial_requests
  SET submitted_at = created_at
  WHERE submitted_at IS NULL;

-- Check constraint de valores válidos (mantém 'lixeira' p/ soft-delete)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='commercial_requests_status_chk') THEN
    ALTER TABLE public.commercial_requests DROP CONSTRAINT commercial_requests_status_chk;
  END IF;
  ALTER TABLE public.commercial_requests
    ADD CONSTRAINT commercial_requests_status_chk
    CHECK (status IN ('pendente','aprovada','reprovada','lixeira'));
END $$;

-- 2) Idempotência de notificação por (CEO, request) ------------------
CREATE UNIQUE INDEX IF NOT EXISTS notifications_ceo_commercial_request_unique_idx
  ON public.notifications (
    user_id,
    ((metadata->>'event_type')),
    ((metadata->>'request_id'))
  )
  WHERE metadata->>'event_type' = 'commercial_request_pending_approval';

-- 3) Trigger fn: notifica CEOs em INSERT ------------------------------
CREATE OR REPLACE FUNCTION public.notify_ceos_commercial_request_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg   text;
  v_extra text := '';
BEGIN
  IF NEW.status IS DISTINCT FROM 'pendente' THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa IS NOT NULL AND length(trim(NEW.empresa)) > 0 THEN
    v_extra := v_extra || ' · ' || NEW.empresa;
  END IF;
  IF NEW.preco IS NOT NULL AND NEW.preco > 0 THEN
    v_extra := v_extra || ' · Valor: R$ ' || to_char(NEW.preco, 'FM999G999G990D00');
  END IF;

  v_msg := 'Nova solicitação comercial' || v_extra || ' — aguardando análise do CEO.';

  INSERT INTO public.notifications (user_id, titulo, mensagem, tipo, lida, link, metadata)
  SELECT
    r.user_id,
    'Nova solicitação pendente de aprovação',
    v_msg,
    'alerta',
    false,
    '/crm/requests',
    jsonb_build_object(
      'event_type',      'commercial_request_pending_approval',
      'request_id',      NEW.id::text,
      'customer_name',   NEW.contato,
      'company',         NEW.empresa,
      'estimated_value', NEW.preco,
      'created_by',      NEW.user_id,
      'submitted_at',    coalesce(NEW.submitted_at, NEW.created_at)
    )
  FROM public.get_ceo_notification_recipients() r
  WHERE r.user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_ceos_commercial_request_pending failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ceos_commercial_request_pending ON public.commercial_requests;
CREATE TRIGGER trg_notify_ceos_commercial_request_pending
AFTER INSERT ON public.commercial_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_ceos_commercial_request_pending();

-- 4) Helper: usuário é CEO ou admin? ---------------------------------
CREATE OR REPLACE FUNCTION public.is_ceo_or_admin(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT true FROM public.profiles p
    WHERE p.id = _user
      AND (
        p.funcao ILIKE '%CEO%'
        OR p.funcao ILIKE '%Chief Executive%'
        OR p.funcao ILIKE '%Sócio%'
        OR p.funcao ILIKE '%Socio%'
        OR p.funcao ILIKE '%Diretor Executivo%'
        OR p.funcao ILIKE '%Fundador%'
      )
    LIMIT 1
  ), false)
  OR COALESCE((
    SELECT true FROM public.user_roles ur
    WHERE ur.user_id = _user AND ur.role = 'admin'::app_role
    LIMIT 1
  ), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_ceo_or_admin(uuid) TO authenticated, service_role;

-- 5) RLS: CEOs podem ver e atualizar solicitações --------------------
DROP POLICY IF EXISTS "CEOs view commercial_requests" ON public.commercial_requests;
CREATE POLICY "CEOs view commercial_requests"
  ON public.commercial_requests
  FOR SELECT
  TO authenticated
  USING (public.is_ceo_or_admin(auth.uid()));

-- (Updates de aprovação/reprovação ocorrem via RPC SECURITY DEFINER,
--  então nenhuma policy adicional de UPDATE é necessária para CEOs.)

-- 6) RPC: aprovar solicitação ----------------------------------------
CREATE OR REPLACE FUNCTION public.approve_commercial_request(request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_req     public.commercial_requests%ROWTYPE;
  v_lead_id uuid;
  v_notas   text;
  v_nome    text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.is_ceo_or_admin(v_uid) THEN
    RAISE EXCEPTION 'Apenas CEO ou Admin podem aprovar solicitações' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req
    FROM public.commercial_requests
    WHERE id = request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING errcode = 'P0002';
  END IF;

  -- Idempotência: já convertida
  IF v_req.converted_lead_id IS NOT NULL THEN
    RETURN v_req.converted_lead_id;
  END IF;

  IF v_req.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação não está pendente (status atual: %)', v_req.status
      USING errcode = 'P0001';
  END IF;

  v_nome := COALESCE(NULLIF(trim(v_req.empresa), ''), 'Solicitação aprovada');

  v_notas := concat_ws(E'\n',
    '[FUNIL:vendas]',
    'Funil: Funil de Vendas',
    'Etapa: Novo Negócio',
    'Origem: Solicitação Comercial aprovada (Via Solicitação)',
    'ID solicitação: ' || v_req.id::text,
    CASE WHEN v_req.tipo IS NOT NULL         THEN 'Tipo: ' || v_req.tipo END,
    CASE WHEN v_req.equipamento IS NOT NULL  THEN 'Equipamento: ' || v_req.equipamento END,
    CASE WHEN v_req.responsavel_comercial IS NOT NULL
         THEN 'Vendedor(a): ' || v_req.responsavel_comercial END
  );

  INSERT INTO public.leads (
    nome, empresa, email, telefone, status,
    valor_estimado, origem, notas, user_id, ultimo_contato
  ) VALUES (
    v_nome, v_req.empresa, v_req.email_1, v_req.telefone, 'Novo Negócio',
    COALESCE(v_req.preco, 0), 'Via Solicitação',
    v_notas, v_uid, now()
  ) RETURNING id INTO v_lead_id;

  UPDATE public.commercial_requests
    SET status            = 'aprovada',
        approved_by       = v_uid,
        approved_at       = now(),
        converted_lead_id = v_lead_id,
        updated_at        = now()
    WHERE id = request_id;

  RETURN v_lead_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_commercial_request(uuid) TO authenticated;

-- 7) RPC: reprovar solicitação ---------------------------------------
CREATE OR REPLACE FUNCTION public.reject_commercial_request(request_id uuid, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.is_ceo_or_admin(v_uid) THEN
    RAISE EXCEPTION 'Apenas CEO ou Admin podem reprovar solicitações' USING errcode = '42501';
  END IF;

  SELECT status INTO v_status
    FROM public.commercial_requests
    WHERE id = request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING errcode = 'P0002';
  END IF;

  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação não está pendente (status atual: %)', v_status
      USING errcode = 'P0001';
  END IF;

  UPDATE public.commercial_requests
    SET status           = 'reprovada',
        rejected_by      = v_uid,
        rejected_at      = now(),
        rejection_reason = NULLIF(trim(COALESCE(reason, '')), ''),
        updated_at       = now()
    WHERE id = request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_commercial_request(uuid, text) TO authenticated;
