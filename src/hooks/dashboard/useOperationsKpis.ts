import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { statusFromThreshold } from "@/lib/kpi-utils";
import type { DashboardFilters } from "./useDashboardFilters";

const CLOSED = new Set(["concluida", "concluído", "concluida_ok", "cancelada", "cancelado"]);

interface OpsResult {
  kpis: KpiDefinition[];
  byStatus: Array<{ label: string; value: number }>;
  byUrgency: Array<{ label: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOperationsKpis(filters: DashboardFilters): OpsResult {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [byStatus, setByStatus] = useState<OpsResult["byStatus"]>([]);
  const [byUrgency, setByUrgency] = useState<OpsResult["byUrgency"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { range } = filters;
      const { data, error: err } = await supabase
        .from("work_orders")
        .select("id, numero_os, status, urgencia, sla_horas, tempo_gasto_min, tecnico_id, cliente, equipamento, created_at, data_conclusao, descricao")
        .gte("created_at", range.start)
        .lte("created_at", range.end);
      if (err) throw err;
      let orders = data || [];
      if (filters.cliente) orders = orders.filter(o => (o.cliente || "").toLowerCase().includes(filters.cliente.toLowerCase()));

      const now = new Date();
      const abertas = orders.filter(o => !CLOSED.has((o.status || "").toLowerCase()));
      const concluidas = orders.filter(o => (o.status || "").toLowerCase().startsWith("conclu"));
      const atrasadas = abertas.filter(o => {
        if (!o.sla_horas || !o.created_at) return false;
        const deadline = new Date(o.created_at); deadline.setHours(deadline.getHours() + o.sla_horas);
        return deadline < now;
      });
      const criticas = orders.filter(o => (o.urgencia || "").toLowerCase() === "critica" && !CLOSED.has((o.status || "").toLowerCase()));

      // Averages (in minutes)
      const closedWithTime = concluidas.filter(o => o.tempo_gasto_min);
      const tempoMedioMin = closedWithTime.length ? closedWithTime.reduce((s, o) => s + (o.tempo_gasto_min || 0), 0) / closedWithTime.length : 0;

      const closedWithDates = concluidas.filter(o => o.data_conclusao && o.created_at);
      const tempoResolucaoMin = closedWithDates.length ? closedWithDates.reduce((s, o) => s + (new Date(o.data_conclusao!).getTime() - new Date(o.created_at!).getTime()) / 60000, 0) / closedWithDates.length : 0;

      // SLA % cumprido
      const slaOk = closedWithDates.filter(o => {
        if (!o.sla_horas) return true;
        const deadline = new Date(o.created_at!); deadline.setHours(deadline.getHours() + o.sla_horas);
        return new Date(o.data_conclusao!) <= deadline;
      });
      const slaPct = closedWithDates.length ? slaOk.length / closedWithDates.length : 1;

      // By status
      const statusCount = new Map<string, number>();
      orders.forEach(o => { const k = o.status || "sem_status"; statusCount.set(k, (statusCount.get(k) || 0) + 1); });
      setByStatus(Array.from(statusCount.entries()).map(([label, value]) => ({ label, value })));

      const urgencyCount = new Map<string, number>();
      abertas.forEach(o => { const k = o.urgencia || "não definida"; urgencyCount.set(k, (urgencyCount.get(k) || 0) + 1); });
      setByUrgency(Array.from(urgencyCount.entries()).map(([label, value]) => ({ label, value })));

      const drillOrders = (arr: typeof orders) => arr.map(o => ({ numero: o.numero_os, cliente: o.cliente, equipamento: o.equipamento, status: o.status, urgencia: o.urgencia }));

      const list: KpiDefinition[] = [
        { key: "os_abertas", label: "OS abertas", format: "number", domain: "operations", sourceTables: ["work_orders"], value: abertas.length,
          drilldownRecords: drillOrders(abertas), drilldownRoute: "/os" },
        { key: "os_concluidas", label: "OS concluídas", format: "number", domain: "operations", sourceTables: ["work_orders"], value: concluidas.length,
          drilldownRecords: drillOrders(concluidas), drilldownRoute: "/os" },
        { key: "os_atrasadas", label: "OS atrasadas (SLA)", format: "number", domain: "operations", sourceTables: ["work_orders"], value: atrasadas.length,
          status: statusFromThreshold(atrasadas.length, { warn: 1, critical: 5 }),
          drilldownRecords: drillOrders(atrasadas), drilldownRoute: "/os" },
        { key: "os_criticas", label: "OS críticas", format: "number", domain: "operations", sourceTables: ["work_orders"], value: criticas.length,
          status: statusFromThreshold(criticas.length, { warn: 1, critical: 3 }),
          drilldownRecords: drillOrders(criticas), drilldownRoute: "/os" },
        { key: "sla_cumprido", label: "SLA cumprido", description: "% de OS concluídas dentro do SLA", format: "percent", domain: "operations", sourceTables: ["work_orders"], value: slaPct,
          status: slaPct >= 0.9 ? "healthy" : slaPct >= 0.75 ? "attention" : "critical", target: 0.95 },
        { key: "tempo_medio_atendimento", label: "Tempo médio (mão-obra)", format: "duration", domain: "operations", sourceTables: ["work_orders"], value: Math.round(tempoMedioMin) },
        { key: "tempo_medio_resolucao", label: "Tempo médio até conclusão", format: "duration", domain: "operations", sourceTables: ["work_orders"], value: Math.round(tempoResolucaoMin) },
      ];
      setKpis(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar indicadores operacionais");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, byStatus, byUrgency, loading, error, refetch: fetch };
}
