
-- Calendar tables
CREATE TABLE public.hex_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text DEFAULT '',
  cor text DEFAULT '#3b82f6',
  tipo text NOT NULL DEFAULT 'pessoal',
  owner_id uuid NOT NULL,
  ativo boolean DEFAULT true,
  sync_provider text DEFAULT NULL,
  sync_token text DEFAULT NULL,
  sync_last_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.hex_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid REFERENCES public.hex_calendars(id) ON DELETE CASCADE NOT NULL,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  local text DEFAULT '',
  tipo text DEFAULT 'reuniao',
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz NOT NULL,
  dia_inteiro boolean DEFAULT false,
  recorrencia text DEFAULT NULL,
  status text DEFAULT 'confirmado',
  prioridade text DEFAULT 'media',
  criado_por uuid NOT NULL,
  external_id text DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.hex_calendar_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.hex_calendar_events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  status text DEFAULT 'pendente',
  notificado boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- RLS
ALTER TABLE public.hex_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hex_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hex_calendar_participants ENABLE ROW LEVEL SECURITY;

-- Calendar policies
CREATE POLICY "Users can view own calendars" ON public.hex_calendars FOR SELECT TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own calendars" ON public.hex_calendars FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own calendars" ON public.hex_calendars FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own calendars" ON public.hex_calendars FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Event policies
CREATE POLICY "Users can view events" ON public.hex_calendar_events FOR SELECT TO authenticated USING (
  criado_por = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (SELECT 1 FROM public.hex_calendar_participants p WHERE p.event_id = id AND p.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.hex_calendars c WHERE c.id = calendar_id AND c.owner_id = auth.uid())
);
CREATE POLICY "Users can insert events" ON public.hex_calendar_events FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());
CREATE POLICY "Users can update own events" ON public.hex_calendar_events FOR UPDATE TO authenticated USING (criado_por = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own events" ON public.hex_calendar_events FOR DELETE TO authenticated USING (criado_por = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Participant policies
CREATE POLICY "Users can view participants" ON public.hex_calendar_participants FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (SELECT 1 FROM public.hex_calendar_events e WHERE e.id = event_id AND e.criado_por = auth.uid())
);
CREATE POLICY "Event creators can manage participants" ON public.hex_calendar_participants FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.hex_calendar_events e WHERE e.id = event_id AND e.criado_por = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Triggers
CREATE TRIGGER update_hex_calendars_updated_at BEFORE UPDATE ON public.hex_calendars FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_hex_calendar_events_updated_at BEFORE UPDATE ON public.hex_calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
