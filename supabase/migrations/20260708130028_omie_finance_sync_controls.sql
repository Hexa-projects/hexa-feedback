-- Omie finance integration controls.
-- Fixes redundant Omie calls by adding job history, per-call locks, cooldowns,
-- and normalized mirrors for financial read sync.

create table if not exists public.omie_accounts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'HexaMedical',
  app_key_masked text,
  status text not null default 'disconnected',
  enabled_modules jsonb not null default '{}'::jsonb,
  last_test_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.omie_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  module text not null default 'finance',
  endpoint text,
  method text,
  status text not null default 'queued',
  triggered_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  next_retry_at timestamptz,
  attempts integer not null default 0,
  total_pages integer not null default 0,
  processed_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  cursor_data jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  error jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.omie_sync_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.omie_sync_jobs(id) on delete cascade,
  entity_type text,
  entity_id text,
  endpoint text,
  method text,
  payload_hash text,
  status text not null default 'info',
  attempts integer not null default 0,
  next_retry_at timestamptz,
  faultcode text,
  faultstring text,
  sanitized_payload jsonb not null default '{}'::jsonb,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.omie_sync_locks (
  lock_key text primary key,
  job_id uuid references public.omie_sync_jobs(id) on delete set null,
  endpoint text not null,
  method text not null,
  payload_hash text not null,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.omie_receivables (
  id uuid primary key default gen_random_uuid(),
  omie_id text unique,
  codigo_integracao text,
  cliente_nome text,
  cliente_documento text,
  valor numeric,
  data_emissao date,
  data_vencimento date,
  data_pagamento date,
  status text,
  categoria text,
  departamento text,
  origem text,
  raw_payload jsonb not null default '{}'::jsonb,
  sync_status text not null default 'synced',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.omie_payables (
  id uuid primary key default gen_random_uuid(),
  omie_id text unique,
  codigo_integracao text,
  cliente_nome text,
  cliente_documento text,
  valor numeric,
  data_emissao date,
  data_vencimento date,
  data_pagamento date,
  status text,
  categoria text,
  departamento text,
  origem text,
  raw_payload jsonb not null default '{}'::jsonb,
  sync_status text not null default 'synced',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.omie_financial_movements (
  id uuid primary key default gen_random_uuid(),
  omie_id text unique,
  tipo text,
  cliente_nome text,
  valor numeric,
  data_movimento date,
  status text,
  origem text,
  raw_payload jsonb not null default '{}'::jsonb,
  sync_status text not null default 'synced',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists omie_sync_jobs_status_idx on public.omie_sync_jobs(status, started_at desc);
create index if not exists omie_sync_events_job_idx on public.omie_sync_events(job_id, created_at desc);
create index if not exists omie_sync_events_error_idx on public.omie_sync_events(status, created_at desc);
create index if not exists omie_sync_locks_until_idx on public.omie_sync_locks(locked_until);
create index if not exists omie_payables_due_idx on public.omie_payables(data_vencimento, status);
create index if not exists omie_receivables_due_idx on public.omie_receivables(data_vencimento, status);

alter table public.omie_sync_jobs add column if not exists type text;
alter table public.omie_sync_jobs add column if not exists job_type text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'omie_sync_jobs' and column_name = 'job_type'
  ) then
    execute 'update public.omie_sync_jobs set type = coalesce(type, job_type) where type is null';
  end if;
end $$;
update public.omie_sync_jobs set job_type = coalesce(job_type, type, 'manual') where job_type is null;
alter table public.omie_sync_jobs alter column job_type set default 'manual';
alter table public.omie_sync_jobs alter column job_type set not null;
alter table public.omie_sync_jobs add column if not exists triggered_by uuid;
alter table public.omie_sync_jobs add column if not exists stats jsonb not null default '{}'::jsonb;
alter table public.omie_sync_jobs add column if not exists error jsonb;
alter table public.omie_sync_events add column if not exists payload_hash text;
alter table public.omie_sync_locks add column if not exists payload_hash text;

create index if not exists omie_sync_jobs_module_idx on public.omie_sync_jobs(module, type, started_at desc);
create unique index if not exists omie_payables_omie_id_uidx on public.omie_payables(omie_id);
create unique index if not exists omie_receivables_omie_id_uidx on public.omie_receivables(omie_id);
create unique index if not exists omie_financial_movements_omie_id_uidx on public.omie_financial_movements(omie_id);
create unique index if not exists omie_accounts_company_name_uidx on public.omie_accounts(company_name);

alter table public.omie_accounts enable row level security;
alter table public.omie_sync_jobs enable row level security;
alter table public.omie_sync_events enable row level security;
alter table public.omie_sync_locks enable row level security;
alter table public.omie_receivables enable row level security;
alter table public.omie_payables enable row level security;
alter table public.omie_financial_movements enable row level security;

grant select on public.omie_accounts to authenticated;
grant select on public.omie_sync_jobs to authenticated;
grant select on public.omie_sync_events to authenticated;
grant select on public.omie_receivables to authenticated;
grant select on public.omie_payables to authenticated;
grant select on public.omie_financial_movements to authenticated;
grant all on public.omie_accounts, public.omie_sync_jobs, public.omie_sync_events, public.omie_sync_locks,
  public.omie_receivables, public.omie_payables, public.omie_financial_movements to service_role;

drop policy if exists "omie finance read accounts" on public.omie_accounts;
create policy "omie finance read accounts" on public.omie_accounts
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or public.get_user_setor(auth.uid()) in ('Financeiro'::public.setor, 'Diretoria'::public.setor)
);

drop policy if exists "omie finance read jobs" on public.omie_sync_jobs;
create policy "omie finance read jobs" on public.omie_sync_jobs
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or public.get_user_setor(auth.uid()) in ('Financeiro'::public.setor, 'Diretoria'::public.setor)
);

drop policy if exists "omie finance read events" on public.omie_sync_events;
create policy "omie finance read events" on public.omie_sync_events
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or public.get_user_setor(auth.uid()) in ('Financeiro'::public.setor, 'Diretoria'::public.setor)
);

drop policy if exists "omie finance read receivables" on public.omie_receivables;
create policy "omie finance read receivables" on public.omie_receivables
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or public.get_user_setor(auth.uid()) in ('Financeiro'::public.setor, 'Diretoria'::public.setor)
);

drop policy if exists "omie finance read payables" on public.omie_payables;
create policy "omie finance read payables" on public.omie_payables
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or public.get_user_setor(auth.uid()) in ('Financeiro'::public.setor, 'Diretoria'::public.setor)
);

drop policy if exists "omie finance read movements" on public.omie_financial_movements;
create policy "omie finance read movements" on public.omie_financial_movements
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or public.get_user_setor(auth.uid()) in ('Financeiro'::public.setor, 'Diretoria'::public.setor)
);

create or replace function public.omie_acquire_sync_lock(
  _lock_key text,
  _job_id uuid,
  _endpoint text,
  _method text,
  _payload_hash text,
  _ttl_seconds integer default 90
)
returns table(acquired boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  _until timestamptz := now() + make_interval(secs => greatest(coalesce(_ttl_seconds, 90), 1));
begin
  insert into public.omie_sync_locks(lock_key, job_id, endpoint, method, payload_hash, locked_until)
  values (_lock_key, _job_id, _endpoint, _method, _payload_hash, _until)
  on conflict (lock_key) do update
    set job_id = excluded.job_id,
        endpoint = excluded.endpoint,
        method = excluded.method,
        payload_hash = excluded.payload_hash,
        locked_until = excluded.locked_until,
        updated_at = now()
    where public.omie_sync_locks.locked_until <= now();

  if found then
    return query select true, _until;
  else
    return query
      select false, l.locked_until
      from public.omie_sync_locks l
      where l.lock_key = _lock_key;
  end if;
end;
$$;

create or replace function public.omie_release_sync_lock(_lock_key text, _job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.omie_sync_locks
  where lock_key = _lock_key
    and (_job_id is null or job_id = _job_id);
  return found;
end;
$$;

revoke all on function public.omie_acquire_sync_lock(text, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.omie_release_sync_lock(text, uuid) from public, anon, authenticated;
grant execute on function public.omie_acquire_sync_lock(text, uuid, text, text, text, integer) to service_role;
grant execute on function public.omie_release_sync_lock(text, uuid) to service_role;
