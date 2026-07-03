import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { statusFromThreshold } from "@/lib/kpi-utils";
import type { DashboardFilters } from "./useDashboardFilters";

interface StockResult {
  kpis: KpiDefinition[];
  distribution: Array<{ label: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStockKpis(filters: DashboardFilters): StockResult {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [distribution, setDistribution] = useState<StockResult["distribution"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { range } = filters;
      const [productsRes, movementsRes] = await Promise.all([
        supabase.from("stock_products").select("id, nome, quantidade, quantidade_minima, status, categoria, part_number, localizacao"),
        supabase.from("stock_movements").select("id, tipo, quantidade, created_at").gte("created_at", range.start).lte("created_at", range.end),
      ]);
      const products = productsRes.data || [];
      const movements = movementsRes.data || [];

      const zerados = products.filter(p => (p.quantidade || 0) === 0);
      const abaixo = products.filter(p => (p.quantidade || 0) > 0 && p.quantidade_minima !== null && (p.quantidade || 0) <= (p.quantidade_minima || 0));
      const criticos = zerados;
      const normais = products.length - zerados.length - abaixo.length;

      const entradas = movements.filter(m => ["entrada", "in", "recebimento"].includes((m.tipo || "").toLowerCase())).reduce((s, m) => s + Number(m.quantidade || 0), 0);
      const saidas = movements.filter(m => ["saida", "out", "consumo"].includes((m.tipo || "").toLowerCase())).reduce((s, m) => s + Number(m.quantidade || 0), 0);

      setDistribution([
        { label: "Normal", value: Math.max(0, normais) },
        { label: "Abaixo do mínimo", value: abaixo.length },
        { label: "Zerado", value: zerados.length },
      ]);

      const drill = (arr: typeof products) => arr.map(p => ({ nome: p.nome, part_number: p.part_number, quantidade: p.quantidade, minimo: p.quantidade_minima, localizacao: p.localizacao }));

      const list: KpiDefinition[] = [
        { key: "estoque_zerado", label: "Itens zerados", format: "number", domain: "stock", sourceTables: ["stock_products"], value: zerados.length,
          status: statusFromThreshold(zerados.length, { warn: 1, critical: 5 }),
          drilldownRecords: drill(zerados), drilldownRoute: "/stock/products" },
        { key: "estoque_abaixo", label: "Abaixo do mínimo", format: "number", domain: "stock", sourceTables: ["stock_products"], value: abaixo.length,
          status: statusFromThreshold(abaixo.length, { warn: 3, critical: 10 }),
          drilldownRecords: drill(abaixo), drilldownRoute: "/stock/products" },
        { key: "estoque_criticos", label: "Itens críticos", format: "number", domain: "stock", sourceTables: ["stock_products"], value: criticos.length },
        { key: "movimentos_entrada", label: "Entradas no período", format: "number", domain: "stock", sourceTables: ["stock_movements"], value: entradas },
        { key: "movimentos_saida", label: "Saídas no período", format: "number", domain: "stock", sourceTables: ["stock_movements"], value: saidas },
        { key: "total_skus", label: "SKUs cadastrados", format: "number", domain: "stock", sourceTables: ["stock_products"], value: products.length },
      ];
      setKpis(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar indicadores de estoque");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, distribution, loading, error, refetch: fetch };
}
