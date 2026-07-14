-- Object privileges complement RLS. Policies remain the source of truth.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.commercial_settings,
  public.crm_funnels,
  public.crm_funnel_stages,
  public.equipment_library,
  public.financial_visibility_grants
TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.proposal_email_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.commercial_audit_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.proposal_number_seq, public.contract_number_seq TO authenticated;

-- These functions are internal trigger/cron entry points and must not be exposed
-- through PostgREST RPC to application roles.
REVOKE ALL ON FUNCTION public.prepare_proposal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_contract() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_approved_repair_to_lab() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_approved_equipment_to_installed_base() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_warranty_expiration_notifications() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proposals'
      AND policyname = 'Managers view commercial proposals'
  ) THEN
    CREATE POLICY "Managers view commercial proposals"
      ON public.proposals FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'gestor'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contracts'
      AND policyname = 'Managers view commercial contracts'
  ) THEN
    CREATE POLICY "Managers view commercial contracts"
      ON public.contracts FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'gestor'));
  END IF;
END
$$;
