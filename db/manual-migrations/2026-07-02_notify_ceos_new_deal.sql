-- =====================================================================
-- Notificação automática para CEOs quando surge um novo negócio
-- pendente de aprovação no funil "Vendas" (status = 'Novo Negócio').
--
-- Idempotente: cada CEO recebe apenas UMA notificação por lead para o
-- evento "new_deal_pending_approval", garantido por índice único parcial.
--
-- COMO APLICAR:
--   Copie este SQL e execute em Supabase Studio → SQL Editor.
-- =====================================================================

-- 1) Índice único parcial para idempotência ---------------------------
CREATE UNIQUE INDEX IF NOT EXISTS notifications_ceo_new_deal_unique_idx
  ON public.notifications (
    user_id,
    ((metadata->>'event_type')),
    ((metadata->>'lead_id'))
  )
  WHERE metadata->>'event_type' = 'new_deal_pending_approval';

-- 2) Função para identificar destinatários CEO ------------------------
CREATE OR REPLACE FUNCTION public.get_ceo_notification_recipients()
RETURNS TABLE (user_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id
  FROM public.profiles p
  WHERE p.id IS NOT NULL
    AND (
      p.funcao ILIKE '%CEO%'
      OR p.funcao ILIKE '%Chief Executive%'
      OR p.funcao ILIKE '%Sócio%'
      OR p.funcao ILIKE '%Socio%'
      OR p.funcao ILIKE '%Diretor Executivo%'
      OR p.funcao ILIKE '%Fundador%'
    );

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE p.id IS NOT NULL AND p.setor::text = 'Diretoria';
  END IF;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id IS NOT NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ceo_notification_recipients()
  TO authenticated, service_role;

-- 3) Trigger function ------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_ceos_new_deal_pending_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should_notify boolean := false;
  v_titulo text := 'Novo negócio pendente de aprovação';
  v_mensagem text;
  v_extra text := '';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_notify := (NEW.status = 'Novo Negócio');
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_notify := (
      NEW.status = 'Novo Negócio'
      AND (OLD.status IS DISTINCT FROM NEW.status)
    );
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  -- "Novo Negócio" só existe na coluna do funil Vendas.
  -- Se houver marcador [FUNIL:xxx] nas notas e não for 'vendas', ignora.
  IF NEW.notas ~* '\[FUNIL:([a-z_]+)\]'
     AND NOT (NEW.notas ~* '\[FUNIL:vendas\]') THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa IS NOT NULL AND length(trim(NEW.empresa)) > 0 THEN
    v_extra := v_extra || ' · ' || NEW.empresa;
  END IF;
  IF NEW.valor_estimado IS NOT NULL AND NEW.valor_estimado > 0 THEN
    v_extra := v_extra || ' · Valor estimado: R$ '
      || to_char(NEW.valor_estimado, 'FM999G999G990D00');
  END IF;

  v_mensagem := coalesce(NEW.nome, 'Novo lead') || v_extra
    || ' — aguardando aprovação no Kanban de Vendas.';

  INSERT INTO public.notifications (
    user_id, titulo, mensagem, tipo, lida, link, metadata
  )
  SELECT
    r.user_id,
    v_titulo,
    v_mensagem,
    'alerta',
    false,
    '/crm/kanban',
    jsonb_build_object(
      'event_type', 'new_deal_pending_approval',
      'lead_id', NEW.id::text,
      'lead_name', NEW.nome,
      'company', NEW.empresa,
      'estimated_value', NEW.valor_estimado,
      'status', NEW.status,
      'funil', 'vendas',
      'created_by', NEW.user_id,
      'triggered_at', now()
    )
  FROM public.get_ceo_notification_recipients() r
  WHERE r.user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_ceos_new_deal_pending_approval falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 4) Trigger em public.leads -----------------------------------------
DROP TRIGGER IF EXISTS trg_notify_ceos_new_deal_pending_approval ON public.leads;

CREATE TRIGGER trg_notify_ceos_new_deal_pending_approval
AFTER INSERT OR UPDATE OF status, notas ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.notify_ceos_new_deal_pending_approval();
