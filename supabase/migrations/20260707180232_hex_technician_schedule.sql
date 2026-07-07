-- HexaOS technical schedule support.
-- Fixes PostgREST errors like:
-- Could not find the table 'public.hex_technician_schedule' in the schema cache.

create extension if not exists pgcrypto;

create table if not exists public.hex_technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  role text,
  active boolean not null default true,
  color text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hex_technician_schedule (
  id uuid primary key default gen_random_uuid(),

  technician_id uuid references public.hex_technicians(id) on delete set null,
  technician_user_id uuid references auth.users(id) on delete set null,
  technician_name text,

  title text,
  customer_name text,
  company_name text,
  contact text,
  contato text,
  contact_phone text,
  contact_email text,

  cep text,
  address text,
  endereco text,
  city text,
  state text,

  contract text,
  contrato text,
  service_order text,
  ordem_servico text,
  ordem_de_servico text,
  os text,

  equipment text,
  equipamento text,
  description text,
  descricao text,
  notes text,
  observacoes text,

  schedule_date date,
  date date,
  data date,
  start_time time,
  end_time time,
  period text not null default 'Dia inteiro',
  periodo text,
  all_day boolean not null default true,

  visit_type text,
  tipo text,
  tipo_visita text,
  status text not null default 'Agendado',
  priority text,

  source text not null default 'manual',
  related_work_order_id uuid,
  related_contract_id uuid,

  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancel_reason text,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hex_technician_schedule
  add column if not exists contato text,
  add column if not exists ordem_servico text,
  add column if not exists ordem_de_servico text,
  add column if not exists tipo text;

create index if not exists idx_hex_technician_schedule_date
  on public.hex_technician_schedule(schedule_date);

create index if not exists idx_hex_technician_schedule_date_alias
  on public.hex_technician_schedule(date);

create index if not exists idx_hex_technician_schedule_data_alias
  on public.hex_technician_schedule(data);

create index if not exists idx_hex_technician_schedule_status
  on public.hex_technician_schedule(status);

create index if not exists idx_hex_technician_schedule_technician
  on public.hex_technician_schedule(technician_id, schedule_date);

create index if not exists idx_hex_technician_schedule_user
  on public.hex_technician_schedule(technician_user_id, schedule_date);

create index if not exists idx_hex_technician_schedule_os
  on public.hex_technician_schedule(os);

create index if not exists idx_hex_technician_schedule_service_order
  on public.hex_technician_schedule(service_order);

create index if not exists idx_hex_technician_schedule_metadata
  on public.hex_technician_schedule using gin(metadata);

create or replace function public.hex_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.hex_normalize_technician_schedule()
returns trigger
language plpgsql
as $$
begin
  new.schedule_date = coalesce(new.schedule_date, new.date, new.data);
  new.date = coalesce(new.date, new.schedule_date, new.data);
  new.data = coalesce(new.data, new.schedule_date, new.date);

  if new.schedule_date is null then
    raise exception 'schedule_date/date/data is required';
  end if;

  new.period = coalesce(nullif(new.period, ''), nullif(new.periodo, ''), 'Dia inteiro');
  new.periodo = coalesce(nullif(new.periodo, ''), new.period);
  new.visit_type = coalesce(nullif(new.visit_type, ''), nullif(new.tipo_visita, ''), nullif(new.tipo, ''));
  new.tipo_visita = coalesce(nullif(new.tipo_visita, ''), new.visit_type, nullif(new.tipo, ''));
  new.tipo = coalesce(nullif(new.tipo, ''), new.visit_type, new.tipo_visita);

  new.contact = coalesce(nullif(new.contact, ''), nullif(new.contato, ''));
  new.contato = coalesce(nullif(new.contato, ''), new.contact);
  new.address = coalesce(nullif(new.address, ''), nullif(new.endereco, ''));
  new.endereco = coalesce(nullif(new.endereco, ''), new.address);
  new.contract = coalesce(nullif(new.contract, ''), nullif(new.contrato, ''));
  new.contrato = coalesce(nullif(new.contrato, ''), new.contract);
  new.service_order = coalesce(nullif(new.service_order, ''), nullif(new.os, ''), nullif(new.ordem_servico, ''), nullif(new.ordem_de_servico, ''));
  new.os = coalesce(nullif(new.os, ''), new.service_order, nullif(new.ordem_servico, ''), nullif(new.ordem_de_servico, ''));
  new.ordem_servico = coalesce(nullif(new.ordem_servico, ''), new.service_order, new.os, nullif(new.ordem_de_servico, ''));
  new.ordem_de_servico = coalesce(nullif(new.ordem_de_servico, ''), new.service_order, new.os, new.ordem_servico);
  new.equipment = coalesce(nullif(new.equipment, ''), nullif(new.equipamento, ''));
  new.equipamento = coalesce(nullif(new.equipamento, ''), new.equipment);
  new.description = coalesce(nullif(new.description, ''), nullif(new.descricao, ''));
  new.descricao = coalesce(nullif(new.descricao, ''), new.description);
  new.notes = coalesce(nullif(new.notes, ''), nullif(new.observacoes, ''));
  new.observacoes = coalesce(nullif(new.observacoes, ''), new.notes);

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hex_technicians_updated_at on public.hex_technicians;
create trigger trg_hex_technicians_updated_at
before update on public.hex_technicians
for each row execute function public.hex_touch_updated_at();

drop trigger if exists trg_hex_technician_schedule_updated_at on public.hex_technician_schedule;
create trigger trg_hex_technician_schedule_updated_at
before insert or update on public.hex_technician_schedule
for each row execute function public.hex_normalize_technician_schedule();

alter table public.hex_technicians enable row level security;
alter table public.hex_technician_schedule enable row level security;

drop policy if exists "hex_technicians_authenticated_select" on public.hex_technicians;
create policy "hex_technicians_authenticated_select"
on public.hex_technicians
for select
to authenticated
using (true);

drop policy if exists "hex_technicians_authenticated_insert" on public.hex_technicians;
create policy "hex_technicians_authenticated_insert"
on public.hex_technicians
for insert
to authenticated
with check (true);

drop policy if exists "hex_technicians_authenticated_update" on public.hex_technicians;
create policy "hex_technicians_authenticated_update"
on public.hex_technicians
for update
to authenticated
using (true)
with check (true);

drop policy if exists "hex_technicians_authenticated_delete" on public.hex_technicians;
create policy "hex_technicians_authenticated_delete"
on public.hex_technicians
for delete
to authenticated
using (true);

drop policy if exists "hex_technician_schedule_authenticated_select" on public.hex_technician_schedule;
create policy "hex_technician_schedule_authenticated_select"
on public.hex_technician_schedule
for select
to authenticated
using (true);

drop policy if exists "hex_technician_schedule_authenticated_insert" on public.hex_technician_schedule;
create policy "hex_technician_schedule_authenticated_insert"
on public.hex_technician_schedule
for insert
to authenticated
with check (true);

drop policy if exists "hex_technician_schedule_authenticated_update" on public.hex_technician_schedule;
create policy "hex_technician_schedule_authenticated_update"
on public.hex_technician_schedule
for update
to authenticated
using (true)
with check (true);

drop policy if exists "hex_technician_schedule_authenticated_delete" on public.hex_technician_schedule;
create policy "hex_technician_schedule_authenticated_delete"
on public.hex_technician_schedule
for delete
to authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.hex_technicians to authenticated;
grant select, insert, update, delete on public.hex_technician_schedule to authenticated;

comment on table public.hex_technician_schedule is
  'Technical agenda used by HexaOS Area Tecnica > Agenda.';

notify pgrst, 'reload schema';
