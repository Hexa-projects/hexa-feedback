
-- Tabela de mapeamento: identidade LiveKit → WhatsApp
CREATE TABLE public.meeting_participants_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_identity text NOT NULL,
  whatsapp_e164 text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_identity)
);

ALTER TABLE public.meeting_participants_map ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all mappings
CREATE POLICY "Authenticated can read participant map"
  ON public.meeting_participants_map FOR SELECT
  TO authenticated USING (true);

-- Users can upsert their own mapping
CREATE POLICY "Users can insert own mapping"
  ON public.meeting_participants_map FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mapping"
  ON public.meeting_participants_map FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

-- Service role needs full access for webhook processing
CREATE POLICY "Service role full access"
  ON public.meeting_participants_map FOR ALL
  TO service_role USING (true);
