-- Add WhatsApp columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_consent boolean DEFAULT false;

-- Create WhatsApp message log table
CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario text NOT NULL,
  destinatario_nome text,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'text',
  evento_origem text,
  status text NOT NULL DEFAULT 'pending',
  erro text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp logs"
  ON public.whatsapp_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));