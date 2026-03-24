
-- AI Agents configuration
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'general',
  descricao TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  modelo TEXT DEFAULT 'google/gemini-3-flash-preview',
  ativo BOOLEAN DEFAULT true,
  metricas JSONB DEFAULT '{}',
  fontes_autorizadas TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage agents" ON public.ai_agents FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Individual AI chat messages per employee
CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chat" ON public.ai_chat_messages FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Corporate channels (Teams-style)
CREATE TABLE public.corporate_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descricao TEXT DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'publico',
  setor TEXT DEFAULT NULL,
  criado_por UUID REFERENCES auth.users(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.corporate_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view public channels" ON public.corporate_channels FOR SELECT TO authenticated USING (tipo = 'publico' OR criado_por = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage channels" ON public.corporate_channels FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create channels" ON public.corporate_channels FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());

-- Channel messages
CREATE TABLE public.channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.corporate_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  tipo TEXT DEFAULT 'texto',
  anexo_url TEXT DEFAULT NULL,
  is_ai BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view channel messages" ON public.channel_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert messages" ON public.channel_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own messages" ON public.channel_messages FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- AI Feedback loop
CREATE TABLE public.ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID REFERENCES public.focus_ai_insights(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resultado TEXT NOT NULL DEFAULT 'pendente',
  impacto_real TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  precisao_score NUMERIC DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own feedback" ON public.ai_feedback FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all feedback" ON public.ai_feedback FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Insert default agents
INSERT INTO public.ai_agents (nome, domain, descricao, system_prompt) VALUES
('CEO Agent', 'executive', 'Visão estratégica, KPIs, decisões cross-setor', 'Você é o assistente executivo do CEO. Foque em KPIs, riscos estratégicos e oportunidades de crescimento.'),
('Comercial Agent', 'sales', 'Gestão de leads, funil, propostas e metas', 'Você é o especialista em vendas. Ajude com leads, propostas, follow-ups e análise de funil.'),
('Financeiro Agent', 'finance', 'Fluxo de caixa, inadimplência, custos', 'Você é o analista financeiro. Foque em fluxo de caixa, custos, margem e inadimplência.'),
('Operações Agent', 'ops', 'OS, SLA, manutenção, eficiência operacional', 'Você é o gestor de operações. Monitore SLA, ordens de serviço, eficiência e gargalos.'),
('RH/People Agent', 'hr', 'Engajamento, onboarding, cultura', 'Você é o especialista em gestão de pessoas. Ajude com engajamento, produtividade e cultura.'),
('Suporte/CS Agent', 'support', 'Atendimento, satisfação, resolução', 'Você é o especialista em suporte ao cliente. Foque em resolução, satisfação e SLA de atendimento.'),
('Marketing Agent', 'marketing', 'Campanhas, growth, branding', 'Você é o estrategista de marketing. Ajude com campanhas, métricas de growth e posicionamento.'),
('Data/BI Agent', 'data', 'Análise de dados, dashboards, métricas', 'Você é o analista de dados. Ajude com consultas, visualizações e insights baseados em dados.'),
('Laboratório Agent', 'lab', 'Reparos, peças, controle de qualidade', 'Você é o especialista de laboratório. Monitore reparos, estoque de peças e qualidade.'),
('Jurídico Agent', 'legal', 'Contratos, compliance, LGPD', 'Você é o consultor jurídico. Ajude com contratos, compliance e questões regulatórias.');

-- Insert default channels
INSERT INTO public.corporate_channels (nome, slug, descricao, tipo) VALUES
('#geral', 'geral', 'Canal geral da empresa', 'publico'),
('#comercial', 'comercial', 'Discussões do time comercial', 'publico'),
('#financeiro', 'financeiro', 'Assuntos financeiros', 'publico'),
('#operacoes', 'operacoes', 'Manutenção e operações', 'publico'),
('#laboratorio', 'laboratorio', 'Laboratório de peças', 'publico'),
('#rh', 'rh', 'Recursos humanos e cultura', 'publico'),
('#anuncios', 'anuncios', 'Comunicados oficiais', 'publico');
