import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { statusFromThreshold } from "@/lib/kpi-utils";
import type { DashboardFilters } from "./useDashboardFilters";

const PROJ_DONE = new Set(["concluido", "concluído", "cancelado", "entregue"]);

interface ProjResult {
  kpis: KpiDefinition[];
  byStage: Array<{ label: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProjectKpis(filters: DashboardFilters): ProjResult {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [byStage, setByStage] = useState<ProjResult["byStage"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [projRes, tasksRes] = await Promise.all([
        supabase.from("projects").select("id, titulo, cliente, status, etapa_atual, data_prevista, data_conclusao, valor_contrato, prioridade, created_at"),
        supabase.from("project_tasks").select("id, project_id, status, due_date, completed_at"),
      ]);
      const projects = projRes.data || [];
      const tasks = (tasksRes.data as any[]) || [];
      const now = new Date();

      let filtered = projects;
      if (filters.cliente) filtered = filtered.filter(p => (p.cliente || "").toLowerCase().includes(filters.cliente.toLowerCase()));

      const ativos = filtered.filter(p => !PROJ_DONE.has((p.status || "").toLowerCase()));
      const atrasados = ativos.filter(p => p.data_prevista && new Date(p.data_prevista) < now);
      const valorAtivo = ativos.reduce((s, p) => s + Number(p.valor_contrato || 0), 0);

      const openTasks = tasks.filter(t => t.status !== "concluida" && t.status !== "cancelada");
      const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < now);
      const doneTasks = tasks.filter(t => t.status === "concluida").length;
      const pct = tasks.length ? doneTasks / tasks.length : 0;

      const byEtapa = new Map<string, number>();
      ativos.forEach(p => { const k = p.etapa_atual || "sem etapa"; byEtapa.set(k, (byEtapa.get(k) || 0) + 1); });
      setByStage(Array.from(byEtapa.entries()).map(([label, value]) => ({ label, value })));

      const drill = (arr: typeof projects) => arr.map(p => ({ titulo: p.titulo, cliente: p.cliente, status: p.status, etapa: p.etapa_atual, prevista: p.data_prevista, valor: p.valor_contrato }));

      const list: KpiDefinition[] = [
        { key: "projetos_ativos", label: "Projetos ativos", format: "number", domain: "projects", sourceTables: ["projects"], value: ativos.length,
          drilldownRecords: drill(ativos), drilldownRoute: "/projects" },
        { key: "projetos_atrasados", label: "Projetos atrasados", format: "number", domain: "projects", sourceTables: ["projects"], value: atrasados.length,
          status: statusFromThreshold(atrasados.length, { warn: 1, critical: 3 }),
          drilldownRecords: drill(atrasados), drilldownRoute: "/projects" },
        { key: "projetos_valor_ativo", label: "Valor contratado ativo", format: "currency", domain: "projects", sourceTables: ["projects"], value: valorAtivo },
        { key: "tarefas_abertas", label: "Tarefas abertas", format: "number", domain: "projects", sourceTables: ["project_tasks"], value: openTasks.length },
        { key: "tarefas_atrasadas", label: "Tarefas atrasadas", format: "number", domain: "projects", sourceTables: ["project_tasks"], value: overdueTasks.length,
          status: statusFromThreshold(overdueTasks.length, { warn: 1, critical: 5 }) },
        { key: "projetos_conclusao_pct", label: "Conclusão de tarefas", format: "percent", domain: "projects", sourceTables: ["project_tasks"], value: pct },
      ];
      setKpis(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar indicadores de projetos");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, byStage, loading, error, refetch: fetch };
}
