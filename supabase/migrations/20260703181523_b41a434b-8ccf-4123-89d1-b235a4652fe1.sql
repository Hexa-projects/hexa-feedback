
CREATE POLICY "auth insert rd_organizations" ON public.rd_organizations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update rd_organizations" ON public.rd_organizations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete rd_organizations" ON public.rd_organizations
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth insert rd_contacts" ON public.rd_contacts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update rd_contacts" ON public.rd_contacts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete rd_contacts" ON public.rd_contacts
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth insert rd_deals" ON public.rd_deals
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update rd_deals" ON public.rd_deals
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete rd_deals" ON public.rd_deals
  FOR DELETE TO authenticated USING (true);
