-- =====================================================================
-- Push Notifications: subscriptions storage + link com id na notificação
-- =====================================================================

-- 1) Tabela de subscriptions -----------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  platform    text,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own push subs select" ON public.push_subscriptions;
CREATE POLICY "own push subs select"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own push subs insert" ON public.push_subscriptions;
CREATE POLICY "own push subs insert"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own push subs update" ON public.push_subscriptions;
CREATE POLICY "own push subs update"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own push subs delete" ON public.push_subscriptions;
CREATE POLICY "own push subs delete"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_push_subs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_push_subs_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subs_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_push_subs_updated_at();

-- 2) Link direto com id na notificação de solicitação pendente -------
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
    '/crm/requests/' || NEW.id::text,
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
