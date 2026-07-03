-- =====================================================================
-- RD Station CRM v2 Integration — Fase 1
-- Creates: crm_integrations, crm_external_accounts, rd_sync_jobs,
-- rd_sync_logs, rd_webhook_events, rd_users, rd_custom_fields,
-- rd_pipelines, rd_pipeline_stages, rd_sources, rd_lost_reasons,
-- rd_products, rd_organizations, rd_contacts, rd_deals, rd_tasks.
-- Run manually via Supabase SQL editor.
-- =====================================================================

-- Helper: updated_at trigger
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Helper: admin/gestor role check
create or replace function public.is_rd_admin(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user, 'admin'::app_role)
      or public.has_role(_user, 'gestor'::app_role);
$$;

-- ---------------------------------------------------------------------
-- 1. Integration config (one row per provider)
-- ---------------------------------------------------------------------
create table public.crm_integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  client_id text,
  scopes text,
  pending_state text,
  last_full_sync_at timestamptz,
  last_delta_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.crm_integrations to authenticated;
grant all on public.crm_integrations to service_role;
alter table public.crm_integrations enable row level security;
create policy "rd admins read integrations" on public.crm_integrations
  for select to authenticated using (public.is_rd_admin(auth.uid()));
create policy "service role writes integrations" on public.crm_integrations
  for all to service_role using (true) with check (true);
create trigger crm_integrations_touch before update on public.crm_integrations
  for each row execute function public.tg_touch_updated_at();

insert into public.crm_integrations (provider, status)
values ('rd_station', 'disconnected')
on conflict (provider) do nothing;

-- ---------------------------------------------------------------------
-- 2. External account tokens (encrypted at app layer)
-- ---------------------------------------------------------------------
create table public.crm_external_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  rd_account_id text,
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider)
);
grant select on public.crm_external_accounts to authenticated;
grant all on public.crm_external_accounts to service_role;
alter table public.crm_external_accounts enable row level security;
-- Restrictive: hide tokens even from admins in the UI; only expose status via a view later
create policy "rd admins read account status" on public.crm_external_accounts
  for select to authenticated using (public.is_rd_admin(auth.uid()));
create policy "service role manages account" on public.crm_external_accounts
  for all to service_role using (true) with check (true);
create trigger crm_ext_acc_touch before update on public.crm_external_accounts
  for each row execute function public.tg_touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. Sync jobs & logs
-- ---------------------------------------------------------------------
create table public.rd_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('full','delta','webhook','manual')),
  status text not null default 'queued' check (status in ('queued','running','success','error','partial')),
  triggered_by uuid references auth.users(id) on delete set null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.rd_sync_jobs to authenticated;
grant all on public.rd_sync_jobs to service_role;
alter table public.rd_sync_jobs enable row level security;
create policy "rd admins read jobs" on public.rd_sync_jobs
  for select to authenticated using (public.is_rd_admin(auth.uid()));
create policy "service role writes jobs" on public.rd_sync_jobs
  for all to service_role using (true) with check (true);
create index rd_sync_jobs_started_idx on public.rd_sync_jobs (started_at desc);

create table public.rd_sync_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.rd_sync_jobs(id) on delete cascade,
  entity text,
  level text not null default 'info' check (level in ('info','warn','error')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.rd_sync_logs to authenticated;
grant all on public.rd_sync_logs to service_role;
alter table public.rd_sync_logs enable row level security;
create policy "rd admins read logs" on public.rd_sync_logs
  for select to authenticated using (public.is_rd_admin(auth.uid()));
create policy "service role writes logs" on public.rd_sync_logs
  for all to service_role using (true) with check (true);
create index rd_sync_logs_job_idx on public.rd_sync_logs (job_id, created_at desc);
create index rd_sync_logs_level_idx on public.rd_sync_logs (level, created_at desc);

-- ---------------------------------------------------------------------
-- 4. Webhook events (dedup)
-- ---------------------------------------------------------------------
create table public.rd_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_hash text not null unique,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received','processed','error')),
  error text
);
grant select on public.rd_webhook_events to authenticated;
grant all on public.rd_webhook_events to service_role;
alter table public.rd_webhook_events enable row level security;
create policy "rd admins read webhooks" on public.rd_webhook_events
  for select to authenticated using (public.is_rd_admin(auth.uid()));
create policy "service role writes webhooks" on public.rd_webhook_events
  for all to service_role using (true) with check (true);
create index rd_webhook_received_idx on public.rd_webhook_events (received_at desc);

-- ---------------------------------------------------------------------
-- 5. Mirrored entities — common shape
-- Every rd_* table gets: id, rd_id (unique), raw_payload, timestamps,
--   last_synced_at, sync_status, deleted_at.
-- ---------------------------------------------------------------------

-- Users
create table public.rd_users (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  name text,
  email text,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Custom fields
create table public.rd_custom_fields (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  label text,
  type text,
  for_entity text,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pipelines
create table public.rd_pipelines (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  name text,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pipeline stages
create table public.rd_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  pipeline_rd_id text references public.rd_pipelines(rd_id) on delete set null,
  name text,
  "order" int,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rd_stages_pipeline_idx on public.rd_pipeline_stages (pipeline_rd_id);

-- Sources
create table public.rd_sources (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  name text,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lost reasons
create table public.rd_lost_reasons (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  name text,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Products
create table public.rd_products (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  name text,
  price numeric,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Organizations
create table public.rd_organizations (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  name text,
  email text,
  phone text,
  cnpj text,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rd_orgs_email_idx on public.rd_organizations (email);
create index rd_orgs_cnpj_idx on public.rd_organizations (cnpj);

-- Contacts
create table public.rd_contacts (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  name text,
  email text,
  phone text,
  organization_rd_id text references public.rd_organizations(rd_id) on delete set null,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rd_contacts_email_idx on public.rd_contacts (email);
create index rd_contacts_org_idx on public.rd_contacts (organization_rd_id);

-- Deals
create table public.rd_deals (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  name text,
  amount_total numeric,
  amount_unique numeric,
  amount_montly numeric,
  status text,
  pipeline_rd_id text references public.rd_pipelines(rd_id) on delete set null,
  stage_rd_id text references public.rd_pipeline_stages(rd_id) on delete set null,
  user_rd_id text references public.rd_users(rd_id) on delete set null,
  organization_rd_id text references public.rd_organizations(rd_id) on delete set null,
  contact_rd_id text references public.rd_contacts(rd_id) on delete set null,
  source_rd_id text references public.rd_sources(rd_id) on delete set null,
  lost_reason_rd_id text references public.rd_lost_reasons(rd_id) on delete set null,
  win boolean,
  hold text,
  closed_at timestamptz,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rd_deals_pipeline_idx on public.rd_deals (pipeline_rd_id);
create index rd_deals_stage_idx on public.rd_deals (stage_rd_id);
create index rd_deals_user_idx on public.rd_deals (user_rd_id);
create index rd_deals_updated_idx on public.rd_deals (rd_updated_at desc);

-- Tasks
create table public.rd_tasks (
  id uuid primary key default gen_random_uuid(),
  rd_id text not null unique,
  title text,
  type text,
  status text,
  done boolean,
  due_at timestamptz,
  deal_rd_id text references public.rd_deals(rd_id) on delete set null,
  user_rd_id text references public.rd_users(rd_id) on delete set null,
  raw_payload jsonb not null,
  rd_created_at timestamptz,
  rd_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rd_tasks_deal_idx on public.rd_tasks (deal_rd_id);

-- Grants + RLS for all mirrored entities
do $$
declare t text;
begin
  for t in select unnest(array[
    'rd_users','rd_custom_fields','rd_pipelines','rd_pipeline_stages',
    'rd_sources','rd_lost_reasons','rd_products','rd_organizations',
    'rd_contacts','rd_deals','rd_tasks'
  ]) loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "auth read %I" on public.%I
      for select to authenticated using (deleted_at is null)$p$, t, t);
    execute format($p$create policy "service role writes %I" on public.%I
      for all to service_role using (true) with check (true)$p$, t, t);
    execute format('create trigger %I_touch before update on public.%I
      for each row execute function public.tg_touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Aggregate view for the integration screen
-- ---------------------------------------------------------------------
create or replace view public.rd_sync_counts as
  select
    (select count(*) from public.rd_pipelines where deleted_at is null) as pipelines,
    (select count(*) from public.rd_pipeline_stages where deleted_at is null) as stages,
    (select count(*) from public.rd_users where deleted_at is null) as users,
    (select count(*) from public.rd_organizations where deleted_at is null) as organizations,
    (select count(*) from public.rd_contacts where deleted_at is null) as contacts,
    (select count(*) from public.rd_deals where deleted_at is null) as deals,
    (select count(*) from public.rd_tasks where deleted_at is null) as tasks,
    (select count(*) from public.rd_products where deleted_at is null) as products,
    (select count(*) from public.rd_sources where deleted_at is null) as sources,
    (select count(*) from public.rd_lost_reasons where deleted_at is null) as lost_reasons,
    (select count(*) from public.rd_custom_fields where deleted_at is null) as custom_fields;

grant select on public.rd_sync_counts to authenticated;
