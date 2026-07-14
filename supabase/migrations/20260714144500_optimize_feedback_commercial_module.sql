-- Remove the redundant index reported by the Supabase performance advisor.
-- contracts_number_unique already enforces the same key.
DROP INDEX IF EXISTS public.contracts_contract_number_key;

-- Cover the audit actor foreign key used by traceability filters and joins.
CREATE INDEX IF NOT EXISTS commercial_audit_log_actor_id_idx
  ON public.commercial_audit_log (actor_id);
