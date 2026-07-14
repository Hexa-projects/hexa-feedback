import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { getPreviousRange, statusFromThreshold } from "@/lib/kpi-utils";
import type { DashboardFilters } from "./useDashboardFilters";

interface CommercialResult {
  kpis: KpiDefinition[];
  funnel: Array<{ label: string; count: number; value: number }>;
  origins: Array<{ label: string; value: number }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CLOSED_WIN = ["ganho", "won", "fechado", "negocio_ganho"];
const CLOSED_LOST = ["perdido", "lost", "cancelado"];

export function useCommercialKpis(filters: DashboardFilters): CommercialResult {
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [funnel, setFunnel] = useState<CommercialResult["funnel"]>([]);
  const [origins, setOrigins] = useState<CommercialResult["origins"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { range } = filters;
      const prev = getPreviousRange(range);
      const [leadsRes, leadsPrevRes, dealsRes, proposalsRes, requestsRes, settingRes] = await Promise.all([
        supabase.from("leads").select("id, status, valor_estimado, created_at, ultimo_contato, origem, responsavel_id, nome, empresa").gte("created_at", range.start).lte("created_at", range.end),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", prev.start).lte("created_at", prev.end),
        supabase.from("deals").select("id, stage_id, value, won_at, lost_at, title, company, owner_name, priority, created_at"),
        supabase.from("proposals").select("id, status, valor, validade_dias, created_at, titulo"),
        supabase.from("commercial_requests").select("id, status, preco, empresa, created_at"),
        (supabase as any).from("commercial_settings").select("value").eq("key", "stale_lead_hours").maybeSingle(),
      ]);

      const leads = leadsRes.data || [];
      const deals = dealsRes.data || [];
      const proposals = proposalsRes.data || [];
      const requests = requestsRes.data || [];
      const leadsPrev = leadsPrevRes.count || 0;

      // apply cliente filter
      const clienteFilter = (name?: string | null) => !filters.cliente || (name || "").toLowerCase().includes(filters.cliente.toLowerCase());
      const leadsF = leads.filter(l => clienteFilter(l.empresa) || clienteFilter(l.nome));
      const dealsF = deals.filter(d => clienteFilter(d.company) || clienteFilter(d.title));

      const now = new Date();
      const staleHours = Math.max(1, Number(settingRes.data?.value) || 72);

      // Pipeline: deals that are not won/lost
      const activeDeals = dealsF.filter(d => !d.won_at && !d.lost_at);
      const pipelineTotal = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
      const wonDeals = dealsF.filter(d => !!d.won_at);
      const wonValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);
      const ticketMedio = wonDeals.length ? wonValue / wonDeals.length : 0;

      // Proposals
      const openProposals = proposals.filter(p => !["aprovada", "recusada", "cancelada"].includes((p.status || "").toLowerCase()));
      const expiredProposals = proposals.filter(p => {
        if (!p.validade_dias || !p.created_at) return false;
        const exp = new Date(p.created_at); exp.setDate(exp.getDate() + p.validade_dias);
        return exp < now && !["aprovada"].includes((p.status || "").toLowerCase());
      });

      // Requests pending
      const pendingRequests = requests.filter(r => (r.status || "").toLowerCase() === "pendente");

      // Stale leads
      const stale = (h: number) => leadsF.filter(l => {
        const ref = l.ultimo_contato || l.created_at;
        if (!ref) return false;
        return (now.getTime() - new Date(ref).getTime()) / 3600000 >= h && !CLOSED_WIN.includes((l.status || "").toLowerCase()) && !CLOSED_LOST.includes((l.status || "").toLowerCase());
      });

      // Funnel
      const stageCounts = new Map<string, { count: number; value: number }>();
      dealsF.forEach(d => {
        if (d.won_at || d.lost_at) return;
        const key = d.stage_id || "sem_etapa";
        const cur = stageCounts.get(key) || { count: 0, value: 0 };
        cur.count += 1; cur.value += d.value || 0;
        stageCounts.set(key, cur);
      });
      setFunnel(Array.from(stageCounts.entries()).map(([k, v]) => ({ label: k, count: v.count, value: v.value })));

      // Origins
      const originCounts = new Map<string, number>();
      leadsF.forEach(l => { const k = l.origem || "não informado"; originCounts.set(k, (originCounts.get(k) || 0) + 1); });
      setOrigins(Array.from(originCounts.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8));

      const list: KpiDefinition[] = [
        {
          key: "leads_novos", label: "Leads novos", description: "Leads criados no período", format: "number",
          domain: "commercial", sourceTables: ["leads"], value: leadsF.length, previousValue: leadsPrev,
          drilldownRecords: leadsF.map(l => ({ nome: l.nome, empresa: l.empresa, status: l.status, valor: l.valor_estimado, origem: l.origem, criado_em: l.created_at })),
          drilldownRoute: "/crm",
        },
        {
          key: "solicitacoes_pendentes", label: "Solicitações pendentes", description: "Solicitações comerciais aguardando aprovação", format: "number",
          domain: "commercial", sourceTables: ["commercial_requests"], value: pendingRequests.length,
          status: statusFromThreshold(pendingRequests.length, { warn: 3, critical: 8 }),
          drilldownRecords: pendingRequests.map(r => ({ empresa: r.empresa, preco: r.preco, criada_em: r.created_at })),
          drilldownRoute: "/crm/requests",
        },
        {
          key: "pipeline_total", label: "Pipeline total", description: "Valor total em negócios abertos", format: "currency",
          domain: "commercial", sourceTables: ["deals"], value: pipelineTotal,
          drilldownRecords: activeDeals.map(d => ({ titulo: d.title, empresa: d.company, valor: d.value, etapa: d.stage_id, responsavel: d.owner_name })),
          drilldownRoute: "/crm/kanban",
        },
        {
          key: "valor_ganho", label: "Valor ganho", description: "Valor total de negócios fechados", format: "currency",
          domain: "commercial", sourceTables: ["deals"], value: wonValue,
          drilldownRecords: wonDeals.map(d => ({ titulo: d.title, empresa: d.company, valor: d.value, ganho_em: d.won_at })),
          drilldownRoute: "/crm/kanban",
        },
        {
          key: "ticket_medio", label: "Ticket médio", description: "Ticket médio dos negócios ganhos", format: "currency",
          domain: "commercial", sourceTables: ["deals"], value: ticketMedio,
        },
        {
          key: "propostas_abertas", label: "Propostas abertas", format: "number",
          domain: "commercial", sourceTables: ["proposals"], value: openProposals.length,
          drilldownRecords: openProposals.map(p => ({ titulo: p.titulo, valor: p.valor, status: p.status, criada_em: p.created_at })),
          drilldownRoute: "/crm/proposals",
        },
        {
          key: "propostas_vencidas", label: "Propostas vencidas", format: "number",
          domain: "commercial", sourceTables: ["proposals"], value: expiredProposals.length,
          status: statusFromThreshold(expiredProposals.length, { warn: 1, critical: 3 }),
          drilldownRecords: expiredProposals.map(p => ({ titulo: p.titulo, valor: p.valor, criada_em: p.created_at, validade_dias: p.validade_dias })),
          drilldownRoute: "/crm/proposals",
        },
        {
          key: "leads_sem_contato", label: `Leads parados > ${staleHours}h`, description: "Prazo configurável no Dashboard Comercial", format: "number",
          domain: "commercial", sourceTables: ["leads", "commercial_settings"], value: stale(staleHours).length,
          status: statusFromThreshold(stale(staleHours).length, { warn: 5, critical: 12 }),
          drilldownRecords: stale(staleHours).map(l => ({ nome: l.nome, empresa: l.empresa, ultimo_contato: l.ultimo_contato, status: l.status })),
          drilldownRoute: "/crm",
        },
      ];
      setKpis(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar indicadores comerciais");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  return { kpis, funnel, origins, loading, error, refetch: fetch };
}
