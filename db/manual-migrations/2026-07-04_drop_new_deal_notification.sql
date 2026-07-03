-- Remove notificação automática para CEO quando um lead entra em "Novo Negócio".
-- A notificação de aprovação agora é enviada apenas para novas SOLICITAÇÕES
-- pendentes (trigger em public.commercial_requests), evitando duplicidade.

DROP TRIGGER IF EXISTS trg_notify_ceos_new_deal_pending_approval ON public.leads;
DROP FUNCTION IF EXISTS public.notify_ceos_new_deal_pending_approval();
DROP INDEX IF EXISTS public.notifications_ceo_new_deal_unique_idx;
