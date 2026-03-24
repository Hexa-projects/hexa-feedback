
-- Fix permissive RLS policy on focus_ai_logs
DROP POLICY IF EXISTS "System can insert logs" ON public.focus_ai_logs;
CREATE POLICY "Admins can insert logs" ON public.focus_ai_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
