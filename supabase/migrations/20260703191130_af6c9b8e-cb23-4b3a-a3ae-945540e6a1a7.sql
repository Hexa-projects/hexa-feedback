
-- Allow CEO/Admin to read soft-deleted organizations and contacts (for Trash view)
CREATE POLICY "ceo admin read trashed rd_organizations"
  ON public.rd_organizations
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NOT NULL AND public.is_ceo_or_admin(auth.uid()));

CREATE POLICY "ceo admin read trashed rd_contacts"
  ON public.rd_contacts
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NOT NULL AND public.is_ceo_or_admin(auth.uid()));
