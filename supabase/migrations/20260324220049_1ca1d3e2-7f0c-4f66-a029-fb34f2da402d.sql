CREATE TABLE public.file_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  setor TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  analise_proposito TEXT,
  analise_estrutura JSONB,
  analise_recomendacoes TEXT,
  analise_pode_substituir BOOLEAN DEFAULT false,
  analise_modulos_hexaos TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.file_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own imports" ON public.file_imports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own imports" ON public.file_imports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own imports" ON public.file_imports
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own imports" ON public.file_imports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all imports" ON public.file_imports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_file_imports_updated_at
  BEFORE UPDATE ON public.file_imports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();