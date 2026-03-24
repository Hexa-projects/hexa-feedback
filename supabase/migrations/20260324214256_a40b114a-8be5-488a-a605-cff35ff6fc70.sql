-- Channel tasks: transform messages into tasks
CREATE TABLE IF NOT EXISTS public.channel_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.channel_messages(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES public.corporate_channels(id) ON DELETE CASCADE NOT NULL,
  created_by uuid NOT NULL,
  assigned_to uuid,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  prioridade text DEFAULT 'media',
  prazo timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.channel_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view channel tasks"
  ON public.channel_tasks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create tasks"
  ON public.channel_tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update tasks"
  ON public.channel_tasks FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tasks"
  ON public.channel_tasks FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_channel_tasks_updated_at
  BEFORE UPDATE ON public.channel_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();