import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { DrilldownDrawer } from "@/components/dashboard/DrilldownDrawer";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { TrendLineChart, StatusBreakdownChart, FunnelChart } from "@/components/dashboard/charts";
import { ExportMenu } from "@/components/dashboard/ExportMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardFilters } from "@/hooks/dashboard/useDashboardFilters";
import { useCommercialKpis } from "@/hooks/dashboard/useCommercialKpis";
import { useFinanceKpis } from "@/hooks/dashboard/useFinanceKpis";
import { useOperationsKpis } from "@/hooks/dashboard/useOperationsKpis";
import { useQualityKpis } from "@/hooks/dashboard/useQualityKpis";
import { useStockKpis } from "@/hooks/dashboard/useStockKpis";
import { useLabKpis } from "@/hooks/dashboard/useLabKpis";
import { useProjectKpis } from "@/hooks/dashboard/useProjectKpis";
import { usePeopleProcessKpis } from "@/hooks/dashboard/usePeopleProcessKpis";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { KpiDefinition } from "@/lib/kpi-definitions";

const TABS: Array<{ v: string; l: string }> = [
  { v: "overview", l: "Visão Geral" },
  { v: "commercial", l: "Comercial" },
  { v: "finance", l: "Financeiro" },
  { v: "operations", l: "Operações" },
  { v: "quality", l: "Qualidade" },
  { v: "stock", l: "Estoque" },
  { v: "lab", l: "Laboratório" },
  { v: "projects", l: "Projetos" },
  { v: "people", l: "Pessoas & Processos" },
];

export default function Dashboard() {
  const { filters, setPreset, setSetor, setCliente, reset } = useDashboardFilters();
  const [tab, setTab] = useState("overview");
  const [drilldown, setDrilldown] = useState<KpiDefinition | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  const commercial = useCommercialKpis(filters);
  const finance = useFinanceKpis(filters);
  const ops = useOperationsKpis(filters);
  const quality = useQualityKpis(filters);
  const stock = useStockKpis(filters);
  const lab = useLabKpis(filters);
  const projects = useProjectKpis(filters);
  const people = usePeopleProcessKpis(filters);

  const allKpis = useMemo(() => [
    ...commercial.kpis, ...finance.kpis, ...ops.kpis, ...quality.kpis,
    ...stock.kpis, ...lab.kpis, ...projects.kpis, ...people.kpis,
  ], [commercial.kpis, finance.kpis, ops.kpis, quality.kpis, stock.kpis, lab.kpis, projects.kpis, people.kpis]);

  const refetchAll = () => {
    commercial.refetch(); finance.refetch(); ops.refetch(); quality.refetch();
    stock.refetch(); lab.refetch(); projects.refetch(); people.refetch();
  };

  const anyLoading = commercial.loading || finance.loading || ops.loading || quality.loading || stock.loading || lab.loading || projects.loading || people.loading;

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const { error } = await (supabase as any).from("kpi_snapshots").insert({
        tipo: `bi-${tab}`,
        dados: { periodo: filters.range, kpis: allKpis },
      });
      if (error) throw error;
      toast.success("Snapshot salvo em kpi_snapshots");
    } catch (e: any) {
      toast.error("Não foi possível salvar snapshot", { description: e?.message });
    } finally {
      setSnapshotting(false);
    }
  };

  return (
    <DashboardShell
      title="Central de BI"
      subtitle="Relatórios, drill-downs e exportações operacionais"
      icon={<BarChart3 className="w-6 h-6 text-primary" />}
      periodLabel={filters.range.label}
      onRefresh={refetchAll}
      refreshing={anyLoading}
      filters={
        <DashboardFilters
          filters={filters}
          onPresetChange={setPreset}
          onSetorChange={setSetor}
          onClienteChange={setCliente}
          onReset={reset}
        />
      }
      actions={<ExportMenu kpis={allKpis} filename={`bi-${tab}`} onSnapshot={handleSnapshot} snapshotting={snapshotting} />}
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="w-max">
            {TABS.map(t => <TabsTrigger key={t.v} value={t.v}>{t.l}</TabsTrigger>)}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <KpiGrid kpis={allKpis.slice(0, 12)} loading={anyLoading} onKpiClick={setDrilldown} columns={4} />
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Financeiro no período" loading={finance.loading} error={finance.error} onRetry={finance.refetch} empty={!finance.timeline.length}>
              <TrendLineChart data={finance.timeline} lines={[
                { dataKey: "receita", label: "Receita", color: "#10b981" },
                { dataKey: "despesa", label: "Despesa", color: "#ef4444" },
              ]} />
            </ChartCard>
            <ChartCard title="Pipeline por etapa" loading={commercial.loading} error={commercial.error} onRetry={commercial.refetch} empty={!commercial.funnel.length}>
              <FunnelChart stages={commercial.funnel} />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="commercial" className="space-y-4">
          <KpiGrid kpis={commercial.kpis} loading={commercial.loading} onKpiClick={setDrilldown} columns={4} />
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Funil de vendas" loading={commercial.loading} error={commercial.error} onRetry={commercial.refetch} empty={!commercial.funnel.length}>
              <FunnelChart stages={commercial.funnel} />
            </ChartCard>
            <ChartCard title="Origem dos leads" loading={commercial.loading} error={commercial.error} onRetry={commercial.refetch} empty={!commercial.origins.length}>
              <StatusBreakdownChart data={commercial.origins} />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          <KpiGrid kpis={finance.kpis} loading={finance.loading} onKpiClick={setDrilldown} columns={4} />
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Receita x Despesa" loading={finance.loading} error={finance.error} onRetry={finance.refetch} empty={!finance.timeline.length}>
              <TrendLineChart data={finance.timeline} lines={[
                { dataKey: "receita", label: "Receita", color: "#10b981" },
                { dataKey: "despesa", label: "Despesa", color: "#ef4444" },
                { dataKey: "resultado", label: "Resultado", color: "hsl(var(--primary))" },
              ]} />
            </ChartCard>
            <ChartCard title="Despesas por categoria" loading={finance.loading} empty={!finance.byCategory.length}>
              <StatusBreakdownChart data={finance.byCategory} />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <KpiGrid kpis={ops.kpis} loading={ops.loading} onKpiClick={setDrilldown} columns={4} />
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="OS por status" loading={ops.loading} empty={!ops.byStatus.length}>
              <StatusBreakdownChart data={ops.byStatus} />
            </ChartCard>
            <ChartCard title="OS por urgência" loading={ops.loading} empty={!ops.byUrgency.length}>
              <StatusBreakdownChart data={ops.byUrgency} />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <KpiGrid kpis={quality.kpis} loading={quality.loading} onKpiClick={setDrilldown} columns={4} />
          <ChartCard title="RACPs abertas por prioridade" loading={quality.loading} empty={!quality.breakdown.length}>
            <StatusBreakdownChart data={quality.breakdown} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <KpiGrid kpis={stock.kpis} loading={stock.loading} onKpiClick={setDrilldown} columns={4} />
          <ChartCard title="Distribuição de estoque" loading={stock.loading} empty={!stock.distribution.length}>
            <StatusBreakdownChart data={stock.distribution} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="lab" className="space-y-4">
          <KpiGrid kpis={lab.kpis} loading={lab.loading} onKpiClick={setDrilldown} columns={4} />
          <ChartCard title="Peças por etapa" loading={lab.loading} empty={!lab.byStage.length}>
            <StatusBreakdownChart data={lab.byStage} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <KpiGrid kpis={projects.kpis} loading={projects.loading} onKpiClick={setDrilldown} columns={4} />
          <ChartCard title="Projetos por etapa" loading={projects.loading} empty={!projects.byStage.length}>
            <StatusBreakdownChart data={projects.byStage} />
          </ChartCard>
        </TabsContent>

        <TabsContent value="people" className="space-y-4">
          <KpiGrid kpis={people.kpis} loading={people.loading} onKpiClick={setDrilldown} columns={4} />
          <ChartCard title="Colaboradores por setor" loading={people.loading} empty={!people.bySector.length}>
            <StatusBreakdownChart data={people.bySector} />
          </ChartCard>
        </TabsContent>
      </Tabs>

      <DrilldownDrawer kpi={drilldown} onClose={() => setDrilldown(null)} />
    </DashboardShell>
  );
}
