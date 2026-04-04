
-- =============================================
-- OPERATIONAL EVENTS
-- =============================================
CREATE TABLE public.operational_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT DEFAULT 'system',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_op_events_type_created ON public.operational_events (type, created_at DESC);
CREATE INDEX idx_op_events_entity ON public.operational_events (entity_type, entity_id);

-- =============================================
-- AGENT RUNS (OpenClaw audit)
-- =============================================
CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.operational_events(id) ON DELETE CASCADE,
  openclaw_request_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued',
  summary TEXT,
  actions JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_runs_event ON public.agent_runs (event_id);
CREATE INDEX idx_agent_runs_status ON public.agent_runs (status, started_at DESC);

-- =============================================
-- KPI SNAPSHOTS
-- =============================================
CREATE TABLE public.kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_key TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value NUMERIC NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (kpi_key, period_start, period_end)
);

CREATE INDEX idx_kpi_key_period ON public.kpi_snapshots (kpi_key, period_start DESC);

-- =============================================
-- ACTION QUEUE (controlled autonomy)
-- =============================================
CREATE TABLE public.action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.operational_events(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  requires_review BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_action_queue_status ON public.action_queue (status, created_at DESC);

-- =============================================
-- RLS POLICIES
-- =============================================
-- operational_events: authenticated can read, service role writes
ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_events" ON public.operational_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_all_events" ON public.operational_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- agent_runs: authenticated can read, service role writes
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_runs" ON public.agent_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_all_runs" ON public.agent_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- kpi_snapshots: authenticated can read, service role writes
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_kpis" ON public.kpi_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_all_kpis" ON public.kpi_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- action_queue: authenticated can read + update (approve/reject), service role full
ALTER TABLE public.action_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_actions" ON public.action_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_update_actions" ON public.action_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_actions" ON public.action_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
