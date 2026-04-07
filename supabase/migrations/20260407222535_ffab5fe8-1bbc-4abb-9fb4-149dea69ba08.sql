
-- View de compatibilidade: openclaw_sync_queue
CREATE OR REPLACE VIEW public.openclaw_sync_queue AS
SELECT id, event_type, data AS payload, status,
       attempts AS retry_count, last_error,
       next_retry_at AS scheduled_for, created_at
FROM public.openclaw_event_queue;

-- Policy para service_role na tabela openclaw_event_queue
CREATE POLICY "service_role_all_queue"
ON public.openclaw_event_queue FOR ALL TO service_role
USING (true) WITH CHECK (true);
