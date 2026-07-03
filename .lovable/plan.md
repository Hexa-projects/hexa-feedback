# Reinvenção Dashboards HexaOS — Central de Inteligência Operacional

Objetivo: transformar `/executive`, `/reports`, `/home` e dashboards setoriais em uma arquitetura unificada, com camada de KPIs consistente, filtros globais, drill-down e exportações. Sem remover funcionalidade existente sem substituto.

## Escopo (o que vai ser feito)

### 1. Fundação: camada de KPIs + design system de dashboard
Criar componentes reutilizáveis e hooks centralizados. Nada de lógica de KPI espalhada dentro das telas.

**Componentes novos em `src/components/dashboard/`:**
- `DashboardShell` — layout com header (título, período, última atualização, botão atualizar), filtros e slots
- `DashboardFilters` + `DateRangeFilter` + `SectorFilter` — filtros globais persistidos em URL/localStorage
- `KpiCard` / `KpiTrendCard` / `KpiGrid` — card denso com valor, formato, delta vs período anterior, status semântico (healthy/attention/critical/neutral), tooltip com fonte do dado
- `ChartCard` — wrapper com título, ações, empty/error/loading
- `TrendLineChart`, `StatusBreakdownChart`, `FunnelChart` — Recharts responsivos
- `AlertPriorityList` — lista priorizada, cada item com ação rápida e link
- `DrilldownDrawer` — sheet que abre com tabela paginada dos registros que compõem o KPI
- `EmptyDashboardState` — estado vazio explicando o que cadastrar
- `ExportMenu` — CSV/JSON
- `SectionSummaryTable` — resumo por setor
- `DataSourceTooltip` — informa origem do dado

**Camada de definição em `src/lib/`:**
- `kpi-definitions.ts` — tipo `KpiDefinition` com `{ key, label, description, value, previousValue, trend, format, domain, sourceTables, status, target?, drilldownRecords? }`
- `kpi-utils.ts` — helpers de formato (currency BRL, percent, duration), comparação de período, status semântico, agregações

**Hooks em `src/hooks/dashboard/`:**
- `useDashboardFilters` — estado global de filtros (período, setor, responsável, unidade, cliente) via Zustand ou contexto
- `useExecutiveKpis`, `useCommercialKpis`, `useFinanceKpis`, `useOperationsKpis`, `useQualityKpis`, `useStockKpis`, `useLabKpis`, `useProjectKpis`, `usePeopleProcessKpis`
- `useKpiDrilldown(kpiKey)` — busca paginada dos registros de um KPI

Regras dos hooks: `Promise.all`, `{ data, loading, error, refetch }`, cálculo de período anterior, respeitam filtros globais, ligam-se ao Supabase client existente.

### 2. Cockpit Executivo — `/executive`
Refatorar `ExecutiveDashboard.tsx`:
- Header com período, "atualizado há X min", botão atualizar
- Filtros globais (sheet no mobile)
- Grid de KPIs principais (12 cards): receita/despesa/resultado do mês, pipeline total, pipeline ponderado, solicitações pendentes, OS críticas, OS atrasadas, estoque crítico, RNC abertas, ações qualidade atrasadas, projetos atrasados
- Painel "Atenção agora" — `AlertPriorityList` com solicitações pendentes, OS críticas/vencidas, leads parados, propostas vencendo, contas vencidas, RNC atrasadas, estoque zerado. Cada item linka pro registro.
- Gráficos: evolução receita/despesa/resultado, pipeline por estágio, OS por status/urgência, qualidade (abertas/atrasadas/eficácia), estoque por faixa
- `SectionSummaryTable` — Comercial, Operações, Financeiro, Qualidade, Estoque, Laboratório, Projetos com KPIs-chave e link "abrir detalhes" que leva à aba correspondente de `/reports`

### 3. Central de BI — `/reports`
Refatorar `Dashboard.tsx` para uma única rota com abas (mais simples e coerente do que subrotas):
- Abas: Visão Geral, Comercial, Financeiro, Operações, Qualidade, Estoque, Laboratório, Projetos, Pessoas & Processos
- Filtros persistentes por aba (localStorage + URL param)
- `ExportMenu` (CSV/JSON) e botão "Gerar snapshot executivo" gravando em `kpi_snapshots`
- Cada aba consome seu hook `useXxxKpis` e renderiza `KpiGrid` + `ChartCard`s + `SectionSummaryTable`
- Drill-down via `DrilldownDrawer` ao clicar em qualquer KPI ou barra de gráfico
- Skeleton loading por card (falha em um não bloqueia os outros)
- Estado vazio útil e erro com "tentar novamente"

### 4. Home `/home`
Manter como visão pessoal do usuário. Ajustar apenas para usar `KpiCard` e linguagem visual dos novos componentes, sem alterar funcionalidade. Card "Insights" continua removido (já foi).

### 5. Dashboards setoriais existentes
`FinanceDashboard`, `StockDashboard`, `QualityDashboard`, `WorkOrdersList` (header KPIs), `ProjectsList` (header), `LabPartsList` (header): substituir os cards atuais pelos novos `KpiCard`/`KpiGrid` consumindo o hook do domínio. Layout e rotas mantidos. Sem tocar em formulários, listas, criação, edição.

### 6. Regras de negócio (implementadas em `kpi-utils` / hooks)
- Ganho/Fechado = fechamento comercial; Perdido/Cancelado sai do pipeline ativo
- OS atrasada = não concluída/cancelada com prazo passado
- RNC/RACP encerrada/cancelada não conta como aberta
- Ações qualidade concluídas/canceladas não são pendentes
- Financeiro: previsto vs realizado pelo status; vencidas = pending com `data_vencimento < today`
- Estoque: crítico = 0; baixo = >0 e ≤ mínimo
- Projeto atrasado = não concluído com `data_prevista < today`

### 7. Performance
- Agregações via `count: 'exact', head: true` sempre que possível
- `Promise.all` por hook
- Drill-downs paginados (page size 25)
- Se um domínio ficar pesado, migração SQL criando view ou RPC (só se necessário — deixar para fase 2)
- Snapshots vão pra `kpi_snapshots` existente

### 8. RLS / Perfis
Não altero políticas nesta entrega. Os hooks respeitam o que o RLS retorna: admin/gestor vê tudo, colaborador vê o setor dele. Diretoria vê consolidado via `is_privileged`.

### 9. i18n e encoding
Toda interface em pt-BR. Corrijo textos com encoding quebrado nos arquivos tocados.

## Fora do escopo (não vou fazer nesta entrega)
- Novas RLS policies (usa as atuais)
- Novas migrations SQL a menos que uma view seja obrigatória para performance
- Redesign de formulários/listas dos módulos
- Alterações no CRM Kanban, OS, Solicitações, Onboarding, Núcleo removido
- Novos KPIs que exijam novas colunas de banco

## Ordem de execução
1. Fundação (componentes + hooks + kpi-definitions + kpi-utils)
2. `/reports` como Central de BI com abas — 9 hooks setoriais
3. `/executive` Cockpit consumindo os mesmos hooks
4. Substituir cards dos dashboards setoriais (Finance, Stock, Quality, etc.) pelos novos componentes
5. `npm run build` + verificação de tipos
6. Ajustes de responsividade (filtros viram sheet no mobile)

## Entregáveis técnicos
```
src/lib/kpi-definitions.ts
src/lib/kpi-utils.ts
src/hooks/dashboard/useDashboardFilters.ts
src/hooks/dashboard/useExecutiveKpis.ts
src/hooks/dashboard/useCommercialKpis.ts
src/hooks/dashboard/useFinanceKpis.ts
src/hooks/dashboard/useOperationsKpis.ts
src/hooks/dashboard/useQualityKpis.ts
src/hooks/dashboard/useStockKpis.ts
src/hooks/dashboard/useLabKpis.ts
src/hooks/dashboard/useProjectKpis.ts
src/hooks/dashboard/usePeopleProcessKpis.ts
src/hooks/dashboard/useKpiDrilldown.ts
src/components/dashboard/*.tsx (14 componentes listados)
src/pages/ExecutiveDashboard.tsx (refatorado)
src/pages/Dashboard.tsx (vira Central de BI com abas)
src/pages/finance/FinanceDashboard.tsx (adota componentes)
src/pages/stock/StockDashboard.tsx (adota componentes)
src/pages/quality/QualityDashboard.tsx (adota componentes)
```

## Aviso de tamanho
Este é um refactor grande (~25 arquivos novos + ~6 refatorados). Vou entregar em uma sequência de mensagens dentro desta task, começando pela fundação, depois `/reports`, depois `/executive`, depois setoriais. Cada fase compila antes de partir pra próxima.

Confirma que posso seguir com essa arquitetura (abas dentro de `/reports` em vez de subrotas, sem novas migrations agora, dashboards setoriais reaproveitam os novos componentes sem mudar sua rota)?
