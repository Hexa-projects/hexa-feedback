import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { statusFromThreshold } from "@/lib/kpi-utils";
import type { DashboardFilters } from "./useDashboardFilters";

const CASE_CLOSED = new Set(["encerrada", "cancelada"]);
const CASE_OPEN = new Set(["aberta", "em_analise", "em_acao", "aguardando_eficacia"]);
const RNC_OPEN_EXCLUDE = new Set(["encerrada", "cancelada"]);
const ACT_DONE = new Set(["concluida", "cancelada"]);

interface QualityResult {
  kpis: KpiDefinition[];
  breakdown: Array<{ label: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQualityKpis(filters: DashboardFilters): QualityResult {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [breakdown, setBreakdown] = useState<QualityResult["breakdown"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { range } = filters;
      const [casesRes, rncRes, actionsRes] = await Promise.all([
        (supabase as any).from("quality_cases").select("id, codigo, titulo, status, prioridade, data_limite, closed_at, created_at, origem, cliente"),
        (supabase as any).from("quality_rncs").select("id, codigo, status, prioridade, created_at, closed_at, origem"),
        (supabase as any).from("quality_actions").select("id, quality_case_id, tipo, status, due_date, completed_at, descricao, created_at"),
      ]);
      const cases = casesRes.data || [];
      const rncs = rncRes.data || [];
      const actions = actionsRes.data || [];
      const now = new Date();

      const openCases = cases.filter((c: any) => CASE_OPEN.has(c.status));
      const openRnc = rncs.filter((r: any) => !RNC_OPEN_EXCLUDE.has(r.status));
      const pendingActions = actions.filter((a: any) => !ACT_DONE.has(a.status));
      const overdueActions = pendingActions.filter((a: any) => a.due_date && new Date(a.due_date) < now);
      const overdueCases = openCases.filter((c: any) => c.data_limite && new Date(c.data_limite) < now);
      const inRange = (d: string | null) => d && d >= range.start && d <= range.end;
      const closedInPeriod = cases.filter((c: any) => inRange(c.closed_at));
      const eficacia = cases.filter((c: any) => c.status === "aguardando_eficacia");
      const ineficazes = cases.filter((c: any) => c.status === "ineficaz");
      const closedWithTime = closedInPeriod.filter((c: any) => c.created_at && c.closed_at);
      const avgClose = closedWithTime.length ? closedWithTime.reduce((s: number, c: any) => s + (new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60000, 0) / closedWithTime.length : 0;
      const eficazes = cases.filter((c: any) => c.status === "eficaz").length;
      const totalEficaciaAvaliada = eficazes + ineficazes.length;
      const taxaEficacia = totalEficaciaAvaliada ? eficazes / totalEficaciaAvaliada : 0;

      const byPrio = new Map<string, number>();
      openCases.forEach((c: any) => { const k = c.prioridade || "não definida"; byPrio.set(k, (byPrio.get(k) || 0) + 1); });
      setBreakdown(Array.from(byPrio.entries()).map(([label, value]) => ({ label, value })));

      const list: KpiDefinition[] = [
        { key: "racp_abertas", label: "RACP abertas", format: "number", domain: "quality", sourceTables: ["quality_cases"], value: openCases.length,
          drilldownRecords: openCases.map((c: any) => ({ codigo: c.codigo, titulo: c.titulo, status: c.status, prioridade: c.prioridade, limite: c.data_limite })),
          drilldownRoute: "/quality/cases" },
        { key: "rnc_abertas", label: "RNC abertas", format: "number", domain: "quality", sourceTables: ["quality_rncs"], value: openRnc.length,
          drilldownRecords: openRnc.map((r: any) => ({ codigo: r.codigo, status: r.status, prioridade: r.prioridade, origem: r.origem })),
          drilldownRoute: "/quality/rnc" },
        { key: "acoes_pendentes", label: "Ações pendentes", format: "number", domain: "quality", sourceTables: ["quality_actions"], value: pendingActions.length },
        { key: "acoes_atrasadas", label: "Ações atrasadas", format: "number", domain: "quality", sourceTables: ["quality_actions"], value: overdueActions.length,
          status: statusFromThreshold(overdueActions.length, { warn: 1, critical: 5 }),
          drilldownRecords: overdueActions.map((a: any) => ({ tipo: a.tipo, descricao: a.descricao, prazo: a.due_date, status: a.status })) },
        { key: "racp_atrasadas", label: "RACP atrasadas", format: "number", domain: "quality", sourceTables: ["quality_cases"], value: overdueCases.length,
          status: statusFromThreshold(overdueCases.length, { warn: 1, critical: 3 }) },
        { key: "eficacia_pendente", label: "Aguardando eficácia", format: "number", domain: "quality", sourceTables: ["quality_cases"], value: eficacia.length },
        { key: "taxa_eficacia", label: "Taxa de eficácia", format: "percent", domain: "quality", sourceTables: ["quality_cases"], value: taxaEficacia,
          status: taxaEficacia >= 0.85 ? "healthy" : taxaEficacia >= 0.6 ? "attention" : "critical", target: 0.9 },
        { key: "tempo_medio_fechamento_q", label: "Tempo médio de fechamento", format: "duration", domain: "quality", sourceTables: ["quality_cases"], value: Math.round(avgClose) },
      ];
      setKpis(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar indicadores de qualidade");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, breakdown, loading, error, refetch: fetch };
}
