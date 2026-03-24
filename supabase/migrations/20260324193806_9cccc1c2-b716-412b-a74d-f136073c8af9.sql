-- Webhook sources registry
CREATE TABLE IF NOT EXISTS public.webhook_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  hmac_secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  ip_allowlist TEXT[] DEFAULT '{}',
  rate_limit_per_min INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.webhook_sources ENABLE ROW LEVEL SECURITY;

-- Webhook event log (canonical events)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor JSONB DEFAULT '{}',
  entity JSONB DEFAULT '{}',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  tags TEXT[] DEFAULT '{}',
  data JSONB DEFAULT '{}',
  meta JSONB DEFAULT '{}',
  status TEXT DEFAULT 'received' CHECK (status IN ('received','processing','delivered','failed','dlq')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  signature_valid BOOLEAN DEFAULT false,
  idempotency_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(idempotency_hash)
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON public.webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_priority ON public.webhook_events(priority);

-- Action requests (Focus AI proposed actions)
CREATE TABLE IF NOT EXISTS public.ai_action_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT NOT NULL,
  evidence JSONB DEFAULT '{}',
  estimated_impact TEXT,
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executing','completed','failed','rolled_back')),
  requires_approval BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result JSONB,
  policy_applied TEXT,
  autonomy_level TEXT DEFAULT 'A',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_action_requests ENABLE ROW LEVEL SECURITY;

-- Audit trail
CREATE TABLE IF NOT EXISTS public.ai_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_id TEXT,
  actor_type TEXT DEFAULT 'system',
  entity_type TEXT,
  entity_id TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  policy_applied TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_audit_trail ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON public.ai_audit_trail(created_at DESC);

-- Learning feedback
CREATE TABLE IF NOT EXISTS public.ai_learning_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID,
  action_request_id UUID REFERENCES public.ai_action_requests(id),
  recommendation_type TEXT,
  decision TEXT CHECK (decision IN ('accepted','rejected','modified','ignored')),
  actual_outcome TEXT,
  kpi_before JSONB,
  kpi_after JSONB,
  effectiveness_score NUMERIC(4,2),
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_learning_feedback ENABLE ROW LEVEL SECURITY;

-- RLS: Admin-only access for all new tables
CREATE POLICY "admin_webhook_sources" ON public.webhook_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_webhook_events" ON public.webhook_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_action_requests" ON public.ai_action_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_audit_trail" ON public.ai_audit_trail FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_learning_feedback" ON public.ai_learning_feedback FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));