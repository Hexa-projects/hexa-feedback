import { useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { AlertPriorityList, type AlertItem } from "@/components/dashboard/AlertPriorityList";
import { DrilldownDrawer } from "@/components/dashboard/DrilldownDrawer";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { TrendLineChart, StatusBreakdownChart } from "@/components/dashboard/charts";
import { SectionSummaryTable, type SectionSummary } from "@/components/dashboard/SectionSummaryTable";
import { ExportMenu } from "@/components/dashboard/ExportMenu";
import { useDashboardFilters } from "@/hooks/dashboard/useDashboardFilters";
import { useCommercialKpis } from "@/hooks/dashboard/useCommercialKpis";
import { useFinanceKpis } from "@/hooks/dashboard/useFinanceKpis";
import { useOperationsKpis } from "@/hooks/dashboard/useOperationsKpis";
import { useQualityKpis } from "@/hooks/dashboard/useQualityKpis";
import { useStockKpis } from "@/hooks/dashboard/useStockKpis";
import { useLabKpis } from "@/hooks/dashboard/useLabKpis";
import { useProjectKpis } from "@/hooks/dashboard/useProjectKpis";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { KpiDefinition } from "@/lib/kpi-definitions";

export default function ExecutiveDashboard() {
  const { filters, setPreset, setSetor, setCliente, reset } = useDashboardFilters();
  const commercial = useCommercialKpis(filters);
  const finance = useFinanceKpis(filters);
  const ops = useOperationsKpis(filters);
  const quality = useQualityKpis(filters);
  const stock = useStockKpis(filters);
  const lab = useLabKpis(filters);
  const projects = useProjectKpis(filters);

  const [drilldown, setDrilldown] = useState<KpiDefinition | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  const loading = commercial.loading || finance.loading || ops.loading || quality.loading || stock.loading;
  const anyError = commercial.error || finance.error || ops.error || quality.error || stock.error;

  const refetchAll = () => {
    commercial.refetch(); finance.refetch(); ops.refetch();
    quality.refetch(); stock.refetch(); lab.refetch(); projects.refetch();
  };

  const kpisByKey = useMemo(() => {
    const map: Record<string, KpiDefinition> = {};
    [...commercial.kpis, ...finance.kpis, ...ops.kpis, ...quality.kpis, ...stock.kpis, ...lab.kpis, ...projects.kpis]
      .forEach(k => { map[k.key] = k; });
    return map;
  }, [commercial.kpis, finance.kpis, ops.kpis, quality.kpis, stock.kpis, lab.kpis, projects.kpis]);

  const headlineKpis: KpiDefinition[] = useMemo(() => {
    const pick = (k: string) => kpisByKey[k];
    const list = [
      pick("receita_recebida"),
      pick("despesa_paga"),
      pick("resultado_liquido"),
      pick("pipeline_total"),
      pick("solicitacoes_pendentes"),
      pick("os_criticas"),
      pick("os_atrasadas"),
      pick("estoque_zerado"),
      pick("racp_abertas"),
      pick("acoes_atrasadas"),
      pick("projetos_atrasados"),
      pick("contas_vencidas"),
    ].filter(Boolean) as KpiDefinition[];
    return list;
  }, [kpisByKey]);

  const alerts: AlertItem[] = useMemo(() => {
    const items: AlertItem[] = [];
    const push = (kpiKey: string, severity: AlertItem["severity"], titleFn: (v: number) => string, category: string, link?: string) => {
      const k = kpisByKey[kpiKey];
      if (k && k.value > 0) items.push({ id: kpiKey, severity, title: titleFn(k.value), category, link, description: k.description });
    };
    push("solicitacoes_pendentes", "attention", n => `${n} solicitação(ões) aguardando aprovação`, "Comercial", "/crm/requests");
    push("os_criticas", "critical", n => `${n} OS críticas em aberto`, "Operações", "/os");
    push("os_atrasadas", "critical", n => `${n} OS atrasadas (SLA estourado)`, "Operações", "/os");
    push("leads_sem_contato_48h", "attention", n => `${n} leads parados há mais de 48h`, "Comercial", "/crm");
    push("propostas_vencidas", "attention", n => `${n} propostas com validade vencida`, "Comercial", "/crm/proposals");
    push("contas_vencidas", "critical", n => `${n} contas vencidas no financeiro`, "Financeiro", "/finance");
    push("acoes_atrasadas", "critical", n => `${n} ações de qualidade atrasadas`, "Qualidade", "/quality");
    push("racp_atrasadas", "critical", n => `${n} RACPs atrasadas`, "Qualidade", "/quality");
    push("estoque_zerado", "critical", n => `${n} itens zerados no estoque`, "Estoque", "/stock/products");
    push("estoque_abaixo", "attention", n => `${n} itens abaixo do mínimo`, "Estoque", "/stock/products");
    push("lab_atrasadas", "attention", n => `${n} peças de laboratório atrasadas`, "Laboratório", "/lab");
    push("projetos_atrasados", "attention", n => `${n} projetos com prazo estourado`, "Projetos", "/projects");
    return items.sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1));
  }, [kpisByKey]);

  const sections: SectionSummary[] = useMemo(() => {
    const g = (k: string) => kpisByKey[k];
    return [
      {
        domain: "commercial", label: "Comercial", route: "/reports",
        metrics: [
          { label: "Leads", value: g("leads_novos")?.value ?? 0 },
          { label: "Pipeline", value: g("pipeline_total")?.value ?? 0, format: "currency" },
          { label: "Ganho", value: g("valor_ganho")?.value ?? 0, format: "currency" },
          { label: "Pendentes", value: g("solicitacoes_pendentes")?.value ?? 0, status: (g("solicitacoes_pendentes")?.value ?? 0) > 0 ? "attention" : "healthy" },
        ],
      },
      {
        domain: "finance", label: "Financeiro", route: "/finance",
        metrics: [
          { label: "Receita", value: g("receita_recebida")?.value ?? 0, format: "currency" },
          { label: "Despesa", value: g("despesa_paga")?.value ?? 0, format: "currency" },
          { label: "Resultado", value: g("resultado_liquido")?.value ?? 0, format: "currency", status: (g("resultado_liquido")?.value ?? 0) < 0 ? "critical" : "healthy" },
          { label: "Vencidas", value: g("contas_vencidas")?.value ?? 0, status: (g("contas_vencidas")?.value ?? 0) > 0 ? "critical" : "healthy" },
        ],
      },
      {
        domain: "operations", label: "Operações", route: "/os",
        metrics: [
          { label: "Abertas", value: g("os_abertas")?.value ?? 0 },
          { label: "Atrasadas", value: g("os_atrasadas")?.value ?? 0, status: (g("os_atrasadas")?.value ?? 0) > 0 ? "critical" : "healthy" },
          { label: "SLA", value: g("sla_cumprido")?.value ?? 0, format: "percent" },
        ],
      },
      {
        domain: "quality", label: "Qualidade", route: "/quality",
        metrics: [
          { label: "RACP", value: g("racp_abertas")?.value ?? 0 },
          { label: "RNC", value: g("rnc_abertas")?.value ?? 0 },
          { label: "Ações atrasadas", value: g("acoes_atrasadas")?.value ?? 0, status: (g("acoes_atrasadas")?.value ?? 0) > 0 ? "critical" : "healthy" },
        ],
      },
      {
        domain: "stock", label: "Estoque", route: "/stock",
        metrics: [
          { label: "Zerados", value: g("estoque_zerado")?.value ?? 0, status: (g("estoque_zerado")?.value ?? 0) > 0 ? "critical" : "healthy" },
          { label: "Baixos", value: g("estoque_abaixo")?.value ?? 0, status: (g("estoque_abaixo")?.value ?? 0) > 0 ? "attention" : "healthy" },
          { label: "SKUs", value: g("total_skus")?.value ?? 0 },
        ],
      },
      {
        domain: "lab", label: "Laboratório", route: "/lab",
        metrics: [
          { label: "Abertas", value: g("lab_abertas")?.value ?? 0 },
          { label: "Atrasadas", value: g("lab_atrasadas")?.value ?? 0, status: (g("lab_atrasadas")?.value ?? 0) > 0 ? "attention" : "healthy" },
        ],
      },
      {
        domain: "projects", label: "Projetos", route: "/projects",
        metrics: [
          { label: "Ativos", value: g("projetos_ativos")?.value ?? 0 },
          { label: "Atrasados", value: g("projetos_atrasados")?.value ?? 0, status: (g("projetos_atrasados")?.value ?? 0) > 0 ? "critical" : "healthy" },
          { label: "Conclusão", value: g("projetos_conclusao_pct")?.value ?? 0, format: "percent" },
        ],
      },
    ];
  }, [kpisByKey]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const payload = {
        criado_em: new Date().toISOString(),
        periodo: filters.range,
        kpis: Object.values(kpisByKey).map(k => ({ key: k.key, label: k.label, value: k.value, format: k.format, domain: k.domain })),
      };
      const { error } = await (supabase as any).from("kpi_snapshots").insert({ tipo: "executivo", dados: payload });
      if (error) throw error;
      toast.success("Snapshot executivo salvo com sucesso");
    } catch (e: any) {
      toast.error("Não foi possível salvar snapshot", { description: e?.message });
    } finally {
      setSnapshotting(false);
    }
  };

  return (
    <DashboardShell
      title="Cockpit Executivo"
      subtitle="Visão consolidada para tomada de decisão da diretoria"
      icon={<LayoutDashboard className="w-6 h-6 text-primary" />}
      periodLabel={filters.range.label}
      lastUpdated={new Date()}
      onRefresh={refetchAll}
      refreshing={loading}
      filters={
        <DashboardFilters
          filters={filters}
          onPresetChange={setPreset}
          onSetorChange={setSetor}
          onClienteChange={setCliente}
          onReset={reset}
        />
      }
      actions={
        <ExportMenu kpis={Object.values(kpisByKey)} filename="cockpit-executivo" onSnapshot={handleSnapshot} snapshotting={snapshotting} />
      }
    >
      {anyError && !loading && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700">
          Alguns indicadores falharam: {anyError}
        </div>
      )}

      <KpiGrid kpis={headlineKpis} loading={loading} onKpiClick={setDrilldown} columns={4} />

      <div className="grid gap-3 lg:grid-cols-3">
        <AlertPriorityList items={alerts} className="lg:col-span-1" loading={loading} />
        <ChartCard
          title="Evolução financeira"
          description="Receita, despesa e resultado no período"
          className="lg:col-span-2"
          loading={finance.loading}
          error={finance.error}
          onRetry={finance.refetch}
          empty={!finance.timeline.length}
        >
          <TrendLineChart
            data={finance.timeline}
            lines={[
              { dataKey: "receita", label: "Receita", color: "#10b981" },
              { dataKey: "despesa", label: "Despesa", color: "#ef4444" },
              { dataKey: "resultado", label: "Resultado", color: "hsl(var(--primary))" },
            ]}
          />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Pipeline por etapa" loading={commercial.loading} error={commercial.error} onRetry={commercial.refetch} empty={!commercial.funnel.length}>
          <StatusBreakdownChart data={commercial.funnel.map(f => ({ label: f.label, value: f.count }))} />
        </ChartCard>
        <ChartCard title="OS por urgência" loading={ops.loading} error={ops.error} onRetry={ops.refetch} empty={!ops.byUrgency.length}>
          <StatusBreakdownChart data={ops.byUrgency} />
        </ChartCard>
      </div>

      <SectionSummaryTable sections={sections} />

      <DrilldownDrawer kpi={drilldown} onClose={() => setDrilldown(null)} />
    </DashboardShell>
  );
}
