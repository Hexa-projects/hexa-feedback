alter table public.quality_cases
  add column if not exists data_ocorrencia date,
  add column if not exists data_deteccao date,
  add column if not exists local_deteccao text,
  add column if not exists detectado_por text,
  add column if not exists evidencia_inicial text,
  add column if not exists impacto_dimensoes text[] not null default '{}',
  add column if not exists impacto_observacoes jsonb not null default '{}',
  add column if not exists contencao_realizada_em timestamptz,
  add column if not exists contencao_responsavel text,
  add column if not exists causa_status text not null default 'provavel' check (causa_status in ('nao_iniciada', 'provavel', 'confirmada', 'descartada')),
  add column if not exists causa_categoria text,
  add column if not exists causa_evidencias text,
  add column if not exists cinco_porques jsonb not null default '[]',
  add column if not exists causas_descartadas text,
  add column if not exists objetivo_corretivo text,
  add column if not exists objetivo_preventivo text,
  add column if not exists abrangencia_preventiva text,
  add column if not exists atualizacoes_preventivas text[] not null default '{}',
  add column if not exists licoes_aprendidas text,
  add column if not exists nova_racp_necessaria boolean not null default false,
  add column if not exists nova_racp_motivo text,
  add column if not exists aprovacao_qualidade_status text not null default 'pendente' check (aprovacao_qualidade_status in ('pendente', 'aprovado', 'reprovado', 'dispensado')),
  add column if not exists aprovacao_qualidade_por text,
  add column if not exists aprovacao_qualidade_em timestamptz,
  add column if not exists aprovacao_area_status text not null default 'pendente' check (aprovacao_area_status in ('pendente', 'aprovado', 'reprovado', 'dispensado')),
  add column if not exists aprovacao_area_por text,
  add column if not exists aprovacao_area_em timestamptz,
  add column if not exists versao integer not null default 1,
  add column if not exists revisao_motivo text,
  add column if not exists documento_relacionado text;

alter table public.quality_actions
  add column if not exists realizada_em timestamptz,
  add column if not exists custo numeric,
  add column if not exists abrangencia text,
  add column if not exists resultado text,
  add column if not exists validado_por text,
  add column if not exists validado_em timestamptz;

create index if not exists idx_quality_cases_data_deteccao on public.quality_cases(data_deteccao);
create index if not exists idx_quality_cases_causa_status on public.quality_cases(causa_status);
create index if not exists idx_quality_cases_impacto_dimensoes on public.quality_cases using gin(impacto_dimensoes);
create index if not exists idx_quality_cases_atualizacoes_preventivas on public.quality_cases using gin(atualizacoes_preventivas);
