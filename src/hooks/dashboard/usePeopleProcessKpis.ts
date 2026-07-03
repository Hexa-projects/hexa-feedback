import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import type { DashboardFilters } from "./useDashboardFilters";

interface PeopleResult {
  kpis: KpiDefinition[];
  bySector: Array<{ label: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePeopleProcessKpis(filters: DashboardFilters): PeopleResult {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [bySector, setBySector] = useState<PeopleResult["bySector"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { range } = filters;
      const [profilesRes, dailyRes, bottlenecksRes, repRes, suggestionsRes] = await Promise.all([
        supabase.from("profiles").select("id, setor"),
        supabase.from("daily_forms").select("id, setor, created_at").gte("created_at", range.start).lte("created_at", range.end),
        supabase.from("bottlenecks").select("id, urgencia, created_at").gte("created_at", range.start).lte("created_at", range.end),
        supabase.from("repetitive_processes").select("id, frequencia, tempo_medio, pode_automatizar").limit(500),
        supabase.from("suggestions").select("id, esforco, beneficio, created_at").gte("created_at", range.start).lte("created_at", range.end),
      ]);

      const profiles = profilesRes.data || [];
      const daily = dailyRes.data || [];
      const bottlenecks = bottlenecksRes.data || [];
      const reps = repRes.data || [];
      const suggestions = suggestionsRes.data || [];

      const sectors = new Map<string, number>();
      profiles.forEach(p => { const k = p.setor || "sem setor"; sectors.set(k, (sectors.get(k) || 0) + 1); });
      setBySector(Array.from(sectors.entries()).map(([label, value]) => ({ label, value })));

      const criticos = bottlenecks.filter(b => (b.urgencia || "").toLowerCase().includes("crit") || (b.urgencia || "").toLowerCase() === "alta").length;
      const podeAutomatizar = reps.filter(r => r.pode_automatizar).length;

      const list: KpiDefinition[] = [
        { key: "colaboradores_ativos", label: "Colaboradores ativos", format: "number", domain: "people", sourceTables: ["profiles"], value: profiles.length },
        { key: "registros_diarios", label: "Registros diários", format: "number", domain: "people", sourceTables: ["daily_forms"], value: daily.length },
        { key: "gargalos_periodo", label: "Gargalos reportados", format: "number", domain: "people", sourceTables: ["bottlenecks"], value: bottlenecks.length },
        { key: "gargalos_criticos", label: "Gargalos críticos", format: "number", domain: "people", sourceTables: ["bottlenecks"], value: criticos,
          status: criticos > 0 ? "attention" : "healthy" },
        { key: "processos_repetitivos", label: "Processos repetitivos", format: "number", domain: "people", sourceTables: ["repetitive_processes"], value: reps.length },
        { key: "processos_automatizaveis", label: "Automatizáveis", format: "number", domain: "people", sourceTables: ["repetitive_processes"], value: podeAutomatizar },
        { key: "sugestoes_periodo", label: "Sugestões no período", format: "number", domain: "people", sourceTables: ["suggestions"], value: suggestions.length },
      ];
      setKpis(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar indicadores de pessoas/processos");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, bySector, loading, error, refetch: fetch };
}
