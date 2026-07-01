create table if not exists public.quality_rncs (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  status text not null default 'aberta' check (status in ('aberta', 'em_disposicao', 'em_retrabalho', 'em_reinspecao', 'aguardando_racp', 'encerrada', 'cancelada')),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta', 'critica')),
  origem text not null,
  emitente text,
  data_emissao date not null default current_date,
  cliente_fornecedor text,
  pedido_compra text,
  nota_fiscal text,
  ordem_producao text,
  descricao_item text,
  codigo_item text,
  lote_serial text,
  quantidade_afetada numeric,
  unidade text,
  descricao_nao_conformidade text not null,
  evidencia_inicial text,
  area_detectada text,
  detectado_por text,
  tipo_nao_conformidade text,
  requisito_descumprido text,
  impacto text,
  disposicao text,
  disposicao_observacao text,
  disposicao_responsavel_1 text,
  disposicao_data_1 date,
  disposicao_responsavel_2 text,
  disposicao_data_2 date,
  metodo_retrabalho text,
  total_horas numeric,
  retrabalho_responsavel text,
  retrabalho_data_inicio date,
  retrabalho_data_fim date,
  reinspecao_resultado text check (reinspecao_resultado is null or reinspecao_resultado in ('aprovado', 'reprovado', 'aprovado_com_restricao')),
  reinspecao_observacao text,
  reinspecao_responsavel text,
  reinspecao_data date,
  requer_racp boolean not null default false,
  racp_id uuid references public.quality_cases(id) on delete set null,
  created_by uuid references public.profiles(id),
  owner_id uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
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

create table if not exists public.quality_rnc_events (
  id uuid primary key default gen_random_uuid(),
  rnc_id uuid not null references public.quality_rncs(id) on delete cascade,
  event_type text not null,
  description text,
  actor_id uuid references public.profiles(id),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

alter table public.quality_cases
  add column if not exists rnc_id uuid references public.quality_rncs(id) on delete set null;

alter table public.quality_evidence
  alter column quality_case_id drop not null,
  add column if not exists rnc_id uuid references public.quality_rncs(id) on delete cascade;

create index if not exists idx_quality_rncs_status on public.quality_rncs(status);
create index if not exists idx_quality_rncs_prioridade on public.quality_rncs(prioridade);
create index if not exists idx_quality_rncs_created_at on public.quality_rncs(created_at desc);
create index if not exists idx_quality_rncs_origem on public.quality_rncs(origem);
create index if not exists idx_quality_rncs_racp on public.quality_rncs(racp_id);
create index if not exists idx_quality_rncs_work_order on public.quality_rncs(work_order_id);
create index if not exists idx_quality_rncs_lab_part on public.quality_rncs(lab_part_id);
create index if not exists idx_quality_rncs_stock_product on public.quality_rncs(stock_product_id);
create index if not exists idx_quality_rnc_events_rnc on public.quality_rnc_events(rnc_id);
create index if not exists idx_quality_cases_rnc on public.quality_cases(rnc_id);
create index if not exists idx_quality_evidence_rnc on public.quality_evidence(rnc_id);

drop trigger if exists update_quality_rncs_updated_at on public.quality_rncs;
create trigger update_quality_rncs_updated_at
  before update on public.quality_rncs
  for each row execute function public.update_updated_at();

grant select, insert, update, delete on public.quality_rncs to authenticated;
grant select, insert on public.quality_rnc_events to authenticated;
grant all on public.quality_rncs to service_role;
grant all on public.quality_rnc_events to service_role;

alter table public.quality_rncs enable row level security;
alter table public.quality_rnc_events enable row level security;

create policy "Admins manage quality rncs" on public.quality_rncs
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Gestores manage quality rncs" on public.quality_rncs
  for all to authenticated
  using (has_role(auth.uid(), 'gestor'::app_role))
  with check (has_role(auth.uid(), 'gestor'::app_role));

create policy "Users view related quality rncs" on public.quality_rncs
  for select to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid());

create policy "Users insert quality rncs" on public.quality_rncs
  for insert to authenticated
  with check (created_by = auth.uid() and owner_id = auth.uid());

create policy "Users update own quality rncs" on public.quality_rncs
  for update to authenticated
  using (created_by = auth.uid() or owner_id = auth.uid())
  with check (created_by = auth.uid() or owner_id = auth.uid());

create policy "Users view quality rnc events" on public.quality_rnc_events
  for select to authenticated
  using (
    exists (
      select 1 from public.quality_rncs r
      where r.id = quality_rnc_events.rnc_id
        and (r.created_by = auth.uid() or r.owner_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'gestor'::app_role))
    )
  );

create policy "Users insert quality rnc events" on public.quality_rnc_events
  for insert to authenticated
  with check (actor_id = auth.uid());

drop policy if exists "Users view quality evidence" on public.quality_evidence;
drop policy if exists "Users insert quality evidence" on public.quality_evidence;

create policy "Users view quality evidence" on public.quality_evidence
  for select to authenticated
  using (
    (
      quality_case_id is not null
      and exists (
        select 1 from public.quality_cases qc
        where qc.id = quality_evidence.quality_case_id
          and (
            qc.created_by = auth.uid()
            or qc.owner_id = auth.uid()
            or has_role(auth.uid(), 'admin'::app_role)
            or has_role(auth.uid(), 'gestor'::app_role)
          )
      )
    )
    or
    (
      rnc_id is not null
      and exists (
        select 1 from public.quality_rncs r
        where r.id = quality_evidence.rnc_id
          and (
            r.created_by = auth.uid()
            or r.owner_id = auth.uid()
            or has_role(auth.uid(), 'admin'::app_role)
            or has_role(auth.uid(), 'gestor'::app_role)
          )
      )
    )
  );

create policy "Users insert quality evidence" on public.quality_evidence
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      (
        quality_case_id is not null
        and exists (
          select 1 from public.quality_cases qc
          where qc.id = quality_evidence.quality_case_id
            and (qc.created_by = auth.uid() or qc.owner_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'gestor'::app_role))
        )
      )
      or
      (
        rnc_id is not null
        and exists (
          select 1 from public.quality_rncs r
          where r.id = quality_evidence.rnc_id
            and (r.created_by = auth.uid() or r.owner_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'gestor'::app_role))
        )
      )
    )
  );
