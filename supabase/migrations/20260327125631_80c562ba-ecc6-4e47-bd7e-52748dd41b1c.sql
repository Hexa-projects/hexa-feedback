
-- Fix RLS on meeting_participants_map: restrict read to own records
DROP POLICY IF EXISTS "Authenticated can read participant map" ON public.meeting_participants_map;

CREATE POLICY "Users can read own participant map"
ON public.meeting_participants_map
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
