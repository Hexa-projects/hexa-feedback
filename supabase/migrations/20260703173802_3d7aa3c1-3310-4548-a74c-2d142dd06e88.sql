ALTER TABLE public.crm_integrations
  ADD COLUMN IF NOT EXISTS client_secret_enc text,
  ADD COLUMN IF NOT EXISTS redirect_uri text;