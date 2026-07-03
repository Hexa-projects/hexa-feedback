import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { statusFromThreshold } from "@/lib/kpi-utils";
import type { DashboardFilters } from "./useDashboardFilters";

interface FinanceResult {
  kpis: KpiDefinition[];
  timeline: Array<{ label: string; receita: number; despesa: number; resultado: number }>;
  byCategory: Array<{ label: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const REALIZED_STATUSES = new Set(["pago", "recebido", "realizado", "quitado"]);

export function useFinanceKpis(filters: DashboardFilters): FinanceResult {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [timeline, setTimeline] = useState<FinanceResult["timeline"]>([]);
  const [byCategory, setByCategory] = useState<FinanceResult["byCategory"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { range } = filters;
      const { data, error: err } = await supabase
        .from("financial_records")
        .select("id, tipo, status, valor, data_vencimento, data_pagamento, categoria, cliente, descricao, referencia, created_at")
        .gte("data_vencimento", range.start.slice(0, 10))
        .lte("data_vencimento", range.end.slice(0, 10));
      if (err) throw err;
      let records = data || [];
      if (filters.cliente) records = records.filter(r => (r.cliente || "").toLowerCase().includes(filters.cliente.toLowerCase()));

      const now = new Date();
      const receitas = records.filter(r => r.tipo === "receita");
      const despesas = records.filter(r => r.tipo === "despesa");

      const receitaPrevista = receitas.reduce((s, r) => s + Number(r.valor || 0), 0);
      const receitaRecebida = receitas.filter(r => REALIZED_STATUSES.has((r.status || "").toLowerCase())).reduce((s, r) => s + Number(r.valor || 0), 0);
      const despesaPrevista = despesas.reduce((s, r) => s + Number(r.valor || 0), 0);
      const despesaPaga = despesas.filter(r => REALIZED_STATUSES.has((r.status || "").toLowerCase())).reduce((s, r) => s + Number(r.valor || 0), 0);
      const resultado = receitaRecebida - despesaPaga;

      const vencidas = records.filter(r => !REALIZED_STATUSES.has((r.status || "").toLowerCase()) && r.data_vencimento && new Date(r.data_vencimento) < now);
      const inadimplencia = vencidas.filter(r => r.tipo === "receita").reduce((s, r) => s + Number(r.valor || 0), 0);

      // Timeline: agrupa por dia
      const byDay = new Map<string, { receita: number; despesa: number }>();
      records.forEach(r => {
        const d = r.data_pagamento || r.data_vencimento;
        if (!d) return;
        const key = d.slice(0, 10);
        const cur = byDay.get(key) || { receita: 0, despesa: 0 };
        const v = Number(r.valor || 0);
        if (r.tipo === "receita" && REALIZED_STATUSES.has((r.status || "").toLowerCase())) cur.receita += v;
        if (r.tipo === "despesa" && REALIZED_STATUSES.has((r.status || "").toLowerCase())) cur.despesa += v;
        byDay.set(key, cur);
      });
      setTimeline(Array.from(byDay.entries()).sort().map(([label, v]) => ({ label: label.slice(5), receita: v.receita, despesa: v.despesa, resultado: v.receita - v.despesa })));

      const byCat = new Map<string, number>();
      despesas.forEach(r => { const k = r.categoria || "Sem categoria"; byCat.set(k, (byCat.get(k) || 0) + Number(r.valor || 0)); });
      setByCategory(Array.from(byCat.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8));

      const list: KpiDefinition[] = [
        { key: "receita_prevista", label: "Receita prevista", format: "currency", domain: "finance", sourceTables: ["financial_records"], value: receitaPrevista,
          drilldownRecords: receitas.map(r => ({ descricao: r.descricao, valor: r.valor, status: r.status, vencimento: r.data_vencimento, cliente: r.cliente })) },
        { key: "receita_recebida", label: "Receita recebida", format: "currency", domain: "finance", sourceTables: ["financial_records"], value: receitaRecebida },
        { key: "despesa_prevista", label: "Despesa prevista", format: "currency", domain: "finance", sourceTables: ["financial_records"], value: despesaPrevista },
        { key: "despesa_paga", label: "Despesa paga", format: "currency", domain: "finance", sourceTables: ["financial_records"], value: despesaPaga },
        { key: "resultado_liquido", label: "Resultado líquido", description: "Receita recebida - Despesa paga", format: "currency", domain: "finance", sourceTables: ["financial_records"], value: resultado, status: resultado < 0 ? "critical" : "healthy" },
        { key: "contas_vencidas", label: "Contas vencidas", format: "number", domain: "finance", sourceTables: ["financial_records"], value: vencidas.length,
          status: statusFromThreshold(vencidas.length, { warn: 1, critical: 5 }),
          drilldownRecords: vencidas.map(r => ({ descricao: r.descricao, valor: r.valor, tipo: r.tipo, vencimento: r.data_vencimento, cliente: r.cliente })),
          drilldownRoute: "/finance" },
        { key: "inadimplencia", label: "Inadimplência", description: "Receitas vencidas sem recebimento", format: "currency", domain: "finance", sourceTables: ["financial_records"], value: inadimplencia,
          status: inadimplencia > 0 ? "attention" : "healthy" },
      ];
      setKpis(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar indicadores financeiros");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, timeline, byCategory, loading, error, refetch: fetch };
}
