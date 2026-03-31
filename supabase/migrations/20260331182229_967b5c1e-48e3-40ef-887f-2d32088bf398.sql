
CREATE TABLE public.onboarding_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  setor TEXT NOT NULL,
  funcao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'Hexamedical - SP',
  tempo_casa TEXT,
  resumo_dia_dia TEXT,
  responsabilidades TEXT,
  ferramentas_criticas TEXT,
  tarefas_repetitivas TEXT,
  tempo_tarefas_manuais TEXT,
  decisores TEXT,
  principal_gargalo TEXT,
  pontos_melhoria TEXT,
  qualidades TEXT,
  mudaria_no_setor TEXT,
  whatsapp TEXT,
  respostas_completas JSONB DEFAULT '{}'::jsonb,
  analisado_por_ia BOOLEAN DEFAULT false,
  analise_ia JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own onboarding" ON public.onboarding_responses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own onboarding" ON public.onboarding_responses
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all onboarding" ON public.onboarding_responses
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update onboarding" ON public.onboarding_responses
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_onboarding_responses_updated_at
  BEFORE UPDATE ON public.onboarding_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
