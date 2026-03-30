-- ================================================
-- NINA SDR UNIFICATION - Core Tables for HexaOS
-- ================================================

-- 1. WhatsApp Contacts (from Nina's 'contacts' table)
CREATE TABLE public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  whatsapp_id text,
  name text,
  call_name text,
  email text,
  profile_picture_url text,
  tags text[] DEFAULT '{}',
  notes text,
  is_business boolean DEFAULT false,
  is_blocked boolean DEFAULT false,
  blocked_at timestamptz,
  blocked_reason text,
  client_memory jsonb DEFAULT '{
    "last_updated": null,
    "lead_profile": {"interests":[],"lead_stage":"new","objections":[],"products_discussed":[],"communication_style":"unknown","qualification_score":0},
    "sales_intelligence": {"pain_points":[],"next_best_action":"qualify","budget_indication":"unknown","decision_timeline":"unknown"},
    "interaction_summary": {"response_pattern":"unknown","last_contact_reason":"","total_conversations":0,"preferred_contact_time":"unknown"},
    "conversation_history": []
  }'::jsonb,
  resumo_vivo text,
  empresa text,
  cargo text,
  cidade text,
  estado text,
  linha_negocio text,
  first_contact_date timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(phone_number)
);

-- 2. WhatsApp Conversations
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'nina' CHECK (status IN ('nina', 'human', 'paused')),
  is_active boolean DEFAULT true,
  assigned_user_id uuid,
  assigned_team text,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  nina_context jsonb DEFAULT '{}',
  instance_id text,
  started_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. WhatsApp Messages
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  whatsapp_message_id text,
  content text,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'audio', 'image', 'document', 'video')),
  from_type text NOT NULL DEFAULT 'user' CHECK (from_type IN ('user', 'nina', 'human')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'processing')),
  media_url text,
  media_type text,
  reply_to_id uuid,
  processed_by_nina boolean DEFAULT false,
  nina_response_time integer,
  metadata jsonb DEFAULT '{}',
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 4. Pipeline Stages (configurable Kanban columns)
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  color text DEFAULT 'border-t-primary',
  position integer NOT NULL DEFAULT 0,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  is_ai_managed boolean DEFAULT false,
  ai_trigger_criteria text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Deals (sales opportunities)
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  company text DEFAULT '',
  value numeric DEFAULT 0,
  stage_id uuid REFERENCES public.pipeline_stages(id),
  owner_id uuid,
  owner_name text,
  tags text[] DEFAULT '{}',
  due_date timestamptz,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  contact_id uuid REFERENCES public.whatsapp_contacts(id),
  contact_name text,
  contact_phone text,
  contact_email text,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id),
  qualification_score integer DEFAULT 0,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Deal Activities (notes, calls, tasks)
CREATE TABLE public.deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'call', 'email', 'meeting', 'task')),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  is_completed boolean DEFAULT false,
  created_by uuid,
  created_by_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Tag Definitions (for contacts)
CREATE TABLE public.tag_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text DEFAULT '#3b82f6',
  category text DEFAULT 'geral',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS Policies
CREATE POLICY "Admins full access whatsapp_contacts" ON public.whatsapp_contacts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view whatsapp_contacts" ON public.whatsapp_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins full access conversations" ON public.whatsapp_conversations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view conversations" ON public.whatsapp_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Assigned users can update conversations" ON public.whatsapp_conversations FOR UPDATE TO authenticated USING (assigned_user_id = auth.uid());

CREATE POLICY "Admins full access messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert messages" ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can view stages" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage stages" ON public.pipeline_stages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins full access deals" ON public.deals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own deals" ON public.deals FOR SELECT TO authenticated USING (user_id = auth.uid() OR owner_id = auth.uid());
CREATE POLICY "Users can insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own deals" ON public.deals FOR UPDATE TO authenticated USING (user_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "Authenticated can view activities" ON public.deal_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage activities" ON public.deal_activities FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated can view tags" ON public.tag_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage tags" ON public.tag_definitions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default pipeline stages
INSERT INTO public.pipeline_stages (title, position, is_system, color, is_ai_managed) VALUES
  ('Novo Lead', 0, false, 'border-t-blue-500', true),
  ('Qualificação', 1, false, 'border-t-cyan-500', true),
  ('Proposta Enviada', 2, false, 'border-t-amber-500', false),
  ('Negociação', 3, false, 'border-t-purple-500', false),
  ('Ganho', 4, true, 'border-t-emerald-500', false),
  ('Perdido', 5, true, 'border-t-red-500', false);

-- Seed default tags
INSERT INTO public.tag_definitions (key, label, color, category) VALUES
  ('humano', 'Humano', '#22c55e', 'produto'),
  ('veterinario', 'Veterinário', '#3b82f6', 'produto'),
  ('servicos', 'Serviços', '#f59e0b', 'produto'),
  ('hexai', 'HexAI', '#8b5cf6', 'produto'),
  ('quente', 'Lead Quente', '#ef4444', 'temperatura'),
  ('morno', 'Lead Morno', '#f97316', 'temperatura'),
  ('frio', 'Lead Frio', '#6b7280', 'temperatura');

-- Create indexes for performance
CREATE INDEX idx_whatsapp_contacts_phone ON public.whatsapp_contacts(phone_number);
CREATE INDEX idx_whatsapp_conversations_contact ON public.whatsapp_conversations(contact_id);
CREATE INDEX idx_whatsapp_conversations_last_msg ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);
CREATE INDEX idx_deals_stage ON public.deals(stage_id);
CREATE INDEX idx_deals_contact ON public.deals(contact_id);
CREATE INDEX idx_deal_activities_deal ON public.deal_activities(deal_id);

-- Update triggers
CREATE TRIGGER update_whatsapp_contacts_updated_at BEFORE UPDATE ON public.whatsapp_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_whatsapp_conversations_updated_at BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_deal_activities_updated_at BEFORE UPDATE ON public.deal_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON public.pipeline_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tag_definitions_updated_at BEFORE UPDATE ON public.tag_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();