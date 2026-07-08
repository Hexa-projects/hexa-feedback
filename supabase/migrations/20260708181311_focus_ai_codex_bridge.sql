CREATE TABLE IF NOT EXISTS public.focus_ai_codex_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL DEFAULT 'chat'
    CHECK (job_type IN ('chat', 'system_sync', 'analysis', 'action_plan', 'automation')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  scope TEXT NOT NULL DEFAULT 'general',
  user_message TEXT,
  codex_prompt TEXT NOT NULL,
  context_package JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_text TEXT,
  share_token_hash TEXT NOT NULL,
  vps_run_id TEXT,
  error TEXT,
  dispatched_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.focus_ai_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'HexaOS operational context',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  source TEXT NOT NULL DEFAULT 'hexaos',
  summary TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  codex_job_id UUID REFERENCES public.focus_ai_codex_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.focus_ai_codex_jobs TO authenticated;
GRANT SELECT, INSERT ON public.focus_ai_context_snapshots TO authenticated;
GRANT ALL ON public.focus_ai_codex_jobs TO service_role;
GRANT ALL ON public.focus_ai_context_snapshots TO service_role;

ALTER TABLE public.focus_ai_codex_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_ai_context_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "focus_ai_jobs_users_select_own"
  ON public.focus_ai_codex_jobs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "focus_ai_jobs_users_insert_own"
  ON public.focus_ai_codex_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "focus_ai_jobs_users_update_own"
  ON public.focus_ai_codex_jobs
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK ((SELECT auth.uid()) = user_id OR public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "focus_ai_context_admin_read"
  ON public.focus_ai_context_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin') OR public.has_role((SELECT auth.uid()), 'gestor'));

CREATE POLICY "focus_ai_context_admin_insert"
  ON public.focus_ai_context_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE INDEX IF NOT EXISTS focus_ai_codex_jobs_user_created_idx
  ON public.focus_ai_codex_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS focus_ai_codex_jobs_status_idx
  ON public.focus_ai_codex_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS focus_ai_context_snapshots_created_idx
  ON public.focus_ai_context_snapshots(created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_focus_ai_codex_jobs_updated_at ON public.focus_ai_codex_jobs;
    CREATE TRIGGER update_focus_ai_codex_jobs_updated_at
      BEFORE UPDATE ON public.focus_ai_codex_jobs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  ELSIF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_focus_ai_codex_jobs_updated_at ON public.focus_ai_codex_jobs;
    CREATE TRIGGER update_focus_ai_codex_jobs_updated_at
      BEFORE UPDATE ON public.focus_ai_codex_jobs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;
