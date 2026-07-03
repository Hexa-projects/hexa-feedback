import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { statusFromThreshold } from "@/lib/kpi-utils";
import type { DashboardFilters } from "./useDashboardFilters";

const LAB_CLOSED = new Set(["concluida", "concluído", "enviada", "entregue", "cancelada"]);

interface LabResult {
  kpis: KpiDefinition[];
  byStage: Array<{ label: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLabKpis(_filters: DashboardFilters): LabResult {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [byStage, setByStage] = useState<LabResult["byStage"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: err } = await supabase
        .from("lab_parts")
        .select("id, descricao, etapa_atual, status, tempo_total_min, tecnico_id, data_entrada, previsao_conclusao, equipamento_origem, serial_number");
      if (err) throw err;
      const parts = data || [];
      const now = new Date();

      const abertas = parts.filter(p => !LAB_CLOSED.has((p.status || "").toLowerCase()));
      const atrasadas = abertas.filter(p => p.previsao_conclusao && new Date(p.previsao_conclusao) < now);
      const emReparo = parts.filter(p => (p.etapa_atual || "").toLowerCase().includes("reparo"));
      const emTeste = parts.filter(p => (p.etapa_atual || "").toLowerCase().includes("teste") || (p.etapa_atual || "").toLowerCase().includes("qa"));
      const aguardandoPeca = parts.filter(p => (p.etapa_atual || "").toLowerCase().includes("aguarda"));
      const closed = parts.filter(p => LAB_CLOSED.has((p.status || "").toLowerCase()) && p.tempo_total_min);
      const tempoMedio = closed.length ? closed.reduce((s, p) => s + (p.tempo_total_min || 0), 0) / closed.length : 0;

      const byEtapa = new Map<string, number>();
      abertas.forEach(p => { const k = p.etapa_atual || "sem etapa"; byEtapa.set(k, (byEtapa.get(k) || 0) + 1); });
      setByStage(Array.from(byEtapa.entries()).map(([label, value]) => ({ label, value })));

      const drill = (arr: typeof parts) => arr.map(p => ({ descricao: p.descricao, etapa: p.etapa_atual, status: p.status, serial: p.serial_number, entrada: p.data_entrada, previsao: p.previsao_conclusao }));

      const list: KpiDefinition[] = [
        { key: "lab_abertas", label: "Peças no laboratório", format: "number", domain: "lab", sourceTables: ["lab_parts"], value: abertas.length,
          drilldownRecords: drill(abertas), drilldownRoute: "/lab" },
        { key: "lab_atrasadas", label: "Peças atrasadas", format: "number", domain: "lab", sourceTables: ["lab_parts"], value: atrasadas.length,
          status: statusFromThreshold(atrasadas.length, { warn: 1, critical: 3 }),
          drilldownRecords: drill(atrasadas), drilldownRoute: "/lab" },
        { key: "lab_em_reparo", label: "Em reparo", format: "number", domain: "lab", sourceTables: ["lab_parts"], value: emReparo.length },
        { key: "lab_em_teste", label: "Em teste/QA", format: "number", domain: "lab", sourceTables: ["lab_parts"], value: emTeste.length },
        { key: "lab_aguardando_peca", label: "Aguardando peça", format: "number", domain: "lab", sourceTables: ["lab_parts"], value: aguardandoPeca.length },
        { key: "lab_tempo_medio", label: "Tempo médio por reparo", format: "duration", domain: "lab", sourceTables: ["lab_parts"], value: Math.round(tempoMedio) },
      ];
      setKpis(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar indicadores de laboratório");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, byStage, loading, error, refetch: fetch };
}
