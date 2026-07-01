create table if not exists public.quality_cases (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  metodo text not null default 'racp' check (metodo in ('racp', '8d')),
  titulo text not null,
  tipo text not null check (tipo in ('corretiva', 'preventiva', 'ambas')),
  origem text not null,
  classificacao text[] not null default '{}',
  status text not null default 'aberta' check (status in ('aberta', 'em_analise', 'em_acao', 'aguardando_eficacia', 'eficaz', 'ineficaz', 'encerrada', 'cancelada')),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta', 'critica')),
  risco_nivel text not null default 'medio' check (risco_nivel in ('baixo', 'medio', 'alto', 'critico')),
  cliente text,
  equipamento text,
  serial_lote text,
  referencia text,
  descricao text not null,
  impacto text,
  contencao_imediata text,
  causa text,
  criterio_eficacia text,
  resultado_eficacia text,
  corretiva_eficaz boolean,
  preventiva_eficaz boolean,
  resumo_final text,
  risco_residual_aceito boolean default false,
  data_limite date,
  data_verificacao date,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  owner_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  work_order_id uuid references public.work_orders(id) on delete set null,
  installed_equipment_id uuid references public.installed_equipment(id) on delete set null,
  lab_part_id uuid references public.lab_parts(id) on delete set null,
  stock_product_id uuid references public.stock_products(id) on delete set null,
  stock_movement_id uuid references public.stock_movements(id) on delete set null,
  commercial_request_id uuid references public.commercial_requests(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_actions (
  id uuid primary key default gen_random_uuid(),
  quality_case_id uuid not null references public.quality_cases(id) on delete cascade,
  tipo text not null check (tipo in ('contencao', 'corretiva', 'preventiva', 'verificacao')),
  descricao text not null,
  responsavel_id uuid references public.profiles(id),
  responsavel_nome text,
  due_date date,
  completed_at timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida', 'atrasada', 'cancelada')),
  evidencia text,
  evidence_urls text[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_evidence (
  id uuid primary key default gen_random_uuid(),
  quality_case_id uuid not null references public.quality_cases(id) on delete cascade,
  action_id uuid references public.quality_actions(id) on delete set null,
  file_name text not null,
  file_url text,
  file_type text,
  storage_path text,
  description text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.quality_case_events (
  id uuid primary key default gen_random_uuid(),
  quality_case_id uuid not null references public.quality_cases(id) on delete cascade,
  event_type text not null,
  description text,
  actor_id uuid references public.profiles(id),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quality_cases_status on public.quality_cases(status);
create index if not exists idx_quality_cases_prioridade on public.quality_cases(prioridade);
create index if not exists idx_quality_cases_created_at on public.quality_cases(created_at desc);
create index if not exists idx_quality_cases_data_limite on public.quality_cases(data_limite);
create index if not exists idx_quality_cases_data_verificacao on public.quality_cases(data_verificacao);
create index if not exists idx_quality_cases_owner on public.quality_cases(owner_id);
create index if not exists idx_quality_cases_created_by on public.quality_cases(created_by);
create index if not exists idx_quality_cases_work_order on public.quality_cases(work_order_id);
create index if not exists idx_quality_cases_lab_part on public.quality_cases(lab_part_id);
create index if not exists idx_quality_cases_stock_product on public.quality_cases(stock_product_id);
create index if not exists idx_quality_actions_case on public.quality_actions(quality_case_id);
create index if not exists idx_quality_actions_status on public.quality_actions(status);
create index if not exists idx_quality_actions_due_date on public.quality_actions(due_date);
create index if not exists idx_quality_evidence_case on public.quality_evidence(quality_case_id);
create index if not exists idx_quality_events_case on public.quality_case_events(quality_case_id);

drop trigger if exists update_quality_cases_updated_at on public.quality_cases;
create trigger update_quality_cases_updated_at
  before update on public.quality_cases
  for each row execute function public.update_updated_at();

drop trigger if exists update_quality_actions_updated_at on public.quality_actions;
create trigger update_quality_actions_updated_at
  before update on public.quality_actions
  for each row execute function public.update_updated_at();

grant select, insert, update, delete on public.quality_cases to authenticated;
grant select, insert, update, delete on public.quality_actions to authenticated;
grant select, insert, update, delete on public.quality_evidence to authenticated;
grant select, insert on public.quality_case_events to authenticated;
grant all on public.quality_cases to service_role;
grant all on public.quality_actions to service_role;
grant all on public.quality_evidence to service_role;
grant all on public.quality_case_events to service_role;

alter table public.quality_cases enable row level security;
alter table public.quality_actions enable row level security;
alter table public.quality_evidence enable row level security;
alter table public.quality_case_events enable row level security;

create policy "Admins manage quality cases" on public.quality_cases
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Gestores manage quality cases" on public.quality_cases
  for all to authenticated
  using (has_role(auth.uid(), 'gestor'::app_role))
  with check (has_role(auth.uid(), 'gestor'::app_role));

create policy "Users view related quality cases" on public.quality_cases
  for select to authenticated
  using (
    created_by = auth.uid()
    or owner_id = auth.uid()
    or exists (
      select 1 from public.quality_actions qa
      where qa.quality_case_id = quality_cases.id
        and qa.responsavel_id = auth.uid()
    )
  );

create policy "Users insert quality cases" on public.quality_cases
  for insert to authenticated
  with check (created_by = auth.uid() and owner_id = auth.uid());

create policy "Users update own quality cases" on public.quality_cases
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid())
  with check (created_by = auth.uid() or owner_id = auth.uid());

create policy "Admins manage quality actions" on public.quality_actions
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Gestores manage quality actions" on public.quality_actions
  for all to authenticated
  using (has_role(auth.uid(), 'gestor'::app_role))
  with check (has_role(auth.uid(), 'gestor'::app_role));

create policy "Users view related quality actions" on public.quality_actions
  for select to authenticated
  using (
    created_by = auth.uid()
    or responsavel_id = auth.uid()
  );

create policy "Users insert quality actions" on public.quality_actions
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "Users update assigned quality actions" on public.quality_actions
  for update to authenticated
  using (created_by = auth.uid() or responsavel_id = auth.uid())
  with check (created_by = auth.uid() or responsavel_id = auth.uid());

create policy "Users view quality evidence" on public.quality_evidence
  for select to authenticated
  using (
    exists (
      select 1 from public.quality_cases qc
      where qc.id = quality_evidence.quality_case_id
        and (
          qc.created_by = auth.uid()
          or qc.owner_id = auth.uid()
          or has_role(auth.uid(), 'admin'::app_role)
          or has_role(auth.uid(), 'gestor'::app_role)
          or exists (
            select 1 from public.quality_actions qa
            where qa.quality_case_id = qc.id and qa.responsavel_id = auth.uid()
          )
        )
    )
  );

create policy "Users insert quality evidence" on public.quality_evidence
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.quality_cases qc
      where qc.id = quality_evidence.quality_case_id
        and (qc.created_by = auth.uid() or qc.owner_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'gestor'::app_role))
    )
  );

create policy "Users view quality events" on public.quality_case_events
  for select to authenticated
  using (
    exists (
      select 1 from public.quality_cases qc
      where qc.id = quality_case_events.quality_case_id
        and (qc.created_by = auth.uid() or qc.owner_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'gestor'::app_role))
    )
  );

create policy "Users insert quality events" on public.quality_case_events
  for insert to authenticated
  with check (actor_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('quality-evidence', 'quality-evidence', false)
on conflict (id) do nothing;

create policy "Authenticated uploads quality evidence" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'quality-evidence' and owner = auth.uid());

create policy "Authenticated reads quality evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'quality-evidence');

create policy "Owners update quality evidence files" on storage.objects
  for update to authenticated
  using (bucket_id = 'quality-evidence' and owner = auth.uid())
  with check (bucket_id = 'quality-evidence' and owner = auth.uid());

create policy "Owners delete quality evidence files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'quality-evidence' and owner = auth.uid());
