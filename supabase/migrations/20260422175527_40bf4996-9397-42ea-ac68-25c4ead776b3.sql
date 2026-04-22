-- =========================================
-- ONBOARDING CONVERSACIONAL IA + ISO 9001
-- =========================================

-- 1. SESSIONS
CREATE TABLE public.onboarding_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_stage TEXT DEFAULT 'introducao',
  completion_percentage INTEGER NOT NULL DEFAULT 0,
  ai_version TEXT DEFAULT 'gpt-5-2025-08-07',
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding sessions"
  ON public.onboarding_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own onboarding sessions"
  ON public.onboarding_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding sessions"
  ON public.onboarding_sessions FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own onboarding sessions"
  ON public.onboarding_sessions FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_onboarding_sessions_user ON public.onboarding_sessions(user_id);
CREATE INDEX idx_onboarding_sessions_status ON public.onboarding_sessions(status);

CREATE TRIGGER trg_onboarding_sessions_updated
  BEFORE UPDATE ON public.onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. MESSAGES
CREATE TABLE public.onboarding_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.onboarding_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT DEFAULT 'text',
  extracted_payload JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding messages"
  ON public.onboarding_messages FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own onboarding messages"
  ON public.onboarding_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own onboarding messages"
  ON public.onboarding_messages FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_onboarding_messages_session ON public.onboarding_messages(session_id);
CREATE INDEX idx_onboarding_messages_created ON public.onboarding_messages(created_at);

-- 3. PROFILES (extracted)
CREATE TABLE public.onboarding_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.onboarding_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  setor TEXT,
  funcao TEXT,
  unidade TEXT,
  tempo_casa TEXT,
  responsabilidades TEXT,
  resumo_geral TEXT,
  whatsapp TEXT,
  consentimento BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

ALTER TABLE public.onboarding_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding profile"
  ON public.onboarding_profiles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own onboarding profile"
  ON public.onboarding_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding profile"
  ON public.onboarding_profiles FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own onboarding profile"
  ON public.onboarding_profiles FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_onboarding_profiles_user ON public.onboarding_profiles(user_id);

CREATE TRIGGER trg_onboarding_profiles_updated
  BEFORE UPDATE ON public.onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. PROCESS MAPS (ISO 9001)
CREATE TABLE public.onboarding_process_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.onboarding_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  process_name TEXT NOT NULL,
  process_category TEXT,
  objective TEXT,
  frequency TEXT,
  description TEXT,
  inputs_json JSONB DEFAULT '[]'::jsonb,
  outputs_json JSONB DEFAULT '[]'::jsonb,
  tools_json JSONB DEFAULT '[]'::jsonb,
  dependencies_json JSONB DEFAULT '[]'::jsonb,
  risks_json JSONB DEFAULT '[]'::jsonb,
  controls_json JSONB DEFAULT '[]'::jsonb,
  improvements_json JSONB DEFAULT '[]'::jsonb,
  indicators_json JSONB DEFAULT '[]'::jsonb,
  owner_name TEXT,
  confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_process_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding process maps"
  ON public.onboarding_process_maps FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own onboarding process maps"
  ON public.onboarding_process_maps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding process maps"
  ON public.onboarding_process_maps FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own onboarding process maps"
  ON public.onboarding_process_maps FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_onboarding_process_session ON public.onboarding_process_maps(session_id);
CREATE INDEX idx_onboarding_process_user ON public.onboarding_process_maps(user_id);

CREATE TRIGGER trg_onboarding_process_maps_updated
  BEFORE UPDATE ON public.onboarding_process_maps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. INSIGHTS (post-onboarding)
CREATE TABLE public.onboarding_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.onboarding_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  summary TEXT,
  key_bottlenecks JSONB DEFAULT '[]'::jsonb,
  key_risks JSONB DEFAULT '[]'::jsonb,
  automation_opportunities JSONB DEFAULT '[]'::jsonb,
  standardization_opportunities JSONB DEFAULT '[]'::jsonb,
  ai_confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding insights"
  ON public.onboarding_insights FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own onboarding insights"
  ON public.onboarding_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own onboarding insights"
  ON public.onboarding_insights FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own onboarding insights"
  ON public.onboarding_insights FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_onboarding_insights_session ON public.onboarding_insights(session_id);
CREATE INDEX idx_onboarding_insights_user ON public.onboarding_insights(user_id);

-- 6. RESPONSE SNAPSHOTS
CREATE TABLE public.onboarding_response_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.onboarding_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  structured_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_response_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own onboarding snapshots"
  ON public.onboarding_response_snapshots FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own onboarding snapshots"
  ON public.onboarding_response_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own onboarding snapshots"
  ON public.onboarding_response_snapshots FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_onboarding_snapshots_session ON public.onboarding_response_snapshots(session_id);