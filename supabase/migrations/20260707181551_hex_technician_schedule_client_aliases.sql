-- Adds client/location aliases expected by the HexaOS technical agenda form.
-- This avoids PostgREST schema-cache errors when the frontend sends fields
-- such as cliente_local directly to public.hex_technician_schedule.

alter table public.hex_technician_schedule
  add column if not exists cliente_local text,
  add column if not exists cliente text,
  add column if not exists nome_cliente text,
  add column if not exists local_cliente text,
  add column if not exists local_atendimento text,
  add column if not exists client_name text,
  add column if not exists location_name text;

create index if not exists idx_hex_technician_schedule_cliente_local
  on public.hex_technician_schedule(cliente_local);

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

  new.customer_name = coalesce(
    nullif(new.customer_name, ''),
    nullif(new.cliente_local, ''),
    nullif(new.cliente, ''),
    nullif(new.nome_cliente, ''),
    nullif(new.local_cliente, ''),
    nullif(new.local_atendimento, ''),
    nullif(new.client_name, ''),
    nullif(new.location_name, '')
  );
  new.company_name = coalesce(nullif(new.company_name, ''), new.customer_name);
  new.cliente_local = coalesce(nullif(new.cliente_local, ''), new.customer_name, new.company_name);
  new.cliente = coalesce(nullif(new.cliente, ''), new.customer_name, new.cliente_local);
  new.nome_cliente = coalesce(nullif(new.nome_cliente, ''), new.customer_name, new.cliente_local);
  new.local_cliente = coalesce(nullif(new.local_cliente, ''), new.cliente_local, new.customer_name);
  new.local_atendimento = coalesce(nullif(new.local_atendimento, ''), new.local_cliente, new.cliente_local, new.customer_name);
  new.client_name = coalesce(nullif(new.client_name, ''), new.customer_name, new.cliente_local);
  new.location_name = coalesce(nullif(new.location_name, ''), new.local_atendimento, new.local_cliente, new.cliente_local);

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

drop trigger if exists trg_hex_technician_schedule_updated_at on public.hex_technician_schedule;
create trigger trg_hex_technician_schedule_updated_at
before insert or update on public.hex_technician_schedule
for each row execute function public.hex_normalize_technician_schedule();

notify pgrst, 'reload schema';
