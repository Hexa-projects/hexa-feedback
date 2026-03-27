CREATE TABLE public.meeting_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name text NOT NULL,
  channel_id uuid REFERENCES public.corporate_channels(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  participants jsonb DEFAULT '[]'::jsonb,
  recording_url text,
  transcription text,
  summary text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.meeting_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view meetings" ON public.meeting_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create meetings" ON public.meeting_logs
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update meetings" ON public.meeting_logs
  FOR UPDATE TO authenticated USING (created_by = auth.uid());