
-- Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text DEFAULT '',
  icone text DEFAULT 'users',
  cor text DEFAULT '#3b82f6',
  criado_por uuid REFERENCES auth.users(id),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'membro',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Message reactions
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Add team_id to corporate_channels
ALTER TABLE public.corporate_channels ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Add thread_count, reaction support tracking
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS thread_count integer DEFAULT 0;

-- Add checklist to channel_tasks
ALTER TABLE public.channel_tasks ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]'::jsonb;

-- Triggers
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS for team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view team members" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage team members" ON public.team_members FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS for message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view reactions" ON public.message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add reactions" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove own reactions" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Seed default teams
INSERT INTO public.teams (nome, slug, descricao, icone, cor) VALUES
  ('Comercial', 'comercial', 'Time de vendas e relacionamento', 'target', '#f59e0b'),
  ('Operações', 'operacoes', 'Técnicos e campo', 'wrench', '#3b82f6'),
  ('Laboratório', 'laboratorio', 'Reparo e bancada', 'flask-conical', '#8b5cf6'),
  ('Financeiro', 'financeiro', 'Contas e fluxo de caixa', 'dollar-sign', '#10b981'),
  ('RH', 'rh', 'Pessoas e cultura', 'heart', '#ec4899'),
  ('Diretoria', 'diretoria', 'Liderança estratégica', 'crown', '#ef4444');

-- Link existing channels to teams by setor
UPDATE public.corporate_channels SET team_id = (SELECT id FROM public.teams WHERE slug = 'comercial') WHERE setor = 'Comercial';
UPDATE public.corporate_channels SET team_id = (SELECT id FROM public.teams WHERE slug = 'laboratorio') WHERE setor = 'Laboratório';
UPDATE public.corporate_channels SET team_id = (SELECT id FROM public.teams WHERE slug = 'financeiro') WHERE setor = 'Financeiro';
