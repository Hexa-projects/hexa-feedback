
-- Event queue for OpenClaw sync
CREATE TABLE public.openclaw_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  tags text[] DEFAULT '{}',
  data jsonb NOT NULL DEFAULT '{}',
  meta jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed','dlq')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE(event_id)
);

ALTER TABLE public.openclaw_event_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage event queue" ON public.openclaw_event_queue
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_openclaw_queue_status ON public.openclaw_event_queue(status, priority, created_at);
CREATE INDEX idx_openclaw_queue_retry ON public.openclaw_event_queue(status, next_retry_at) WHERE status IN ('pending','failed');

-- Sync status / observability
CREATE TABLE public.openclaw_sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metric_name)
);

ALTER TABLE public.openclaw_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sync status" ON public.openclaw_sync_status
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default metrics
INSERT INTO public.openclaw_sync_status (metric_name, metric_value) VALUES
  ('last_heartbeat', '{"sent_at": null, "success": false}'),
  ('queue_stats', '{"pending": 0, "delivered": 0, "failed": 0, "dlq": 0}'),
  ('connection', '{"status": "disconnected", "last_check": null}'),
  ('error_rate', '{"last_hour": 0, "last_day": 0}');
