import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Plus, ArrowRight, Target, Clock, TrendingUp,
  Phone, MessageSquare, AlertTriangle, Download, CheckCircle2,
  Zap, BarChart3, DollarSign, Calendar
} from "lucide-react";
import { format, differenceInHours, differenceInDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const STATUS_PIPELINE = ["Qualificação", "Contato Inicial", "Reunião", "Proposta Enviada", "Negociação"];
const STATUS_COLORS_MAP: Record<string, string> = {
  "Qualificação": "hsl(217, 91%, 60%)",
  "Contato Inicial": "hsl(45, 93%, 47%)",
  "Reunião": "hsl(271, 91%, 65%)",
  "Proposta Enviada": "hsl(24, 95%, 53%)",
  "Negociação": "hsl(174, 72%, 56%)",
  "Ganho": "hsl(142, 71%, 45%)",
  "Perdido": "hsl(0, 72%, 51%)",
};

export default function HomePage() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("lead_interactions").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("focus_ai_insights").select("*").eq("status", "pendente").order("created_at", { ascending: false }).limit(5),
    ]).then(([leadsRes, intRes, insRes]) => {
      setLeads(leadsRes.data || []);
      setInteractions(intRes.data || []);
      setInsights(insRes.data || []);
      setLoading(false);
    });
  }, [user]);

  // KPIs
  const kpis = useMemo(() => {
    const activeLeads = leads.filter(l => !["Ganho", "Perdido"].includes(l.status));
    const wonLeads = leads.filter(l => l.status === "Ganho");
    const lostLeads = leads.filter(l => l.status === "Perdido");
    const totalPipeline = activeLeads.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);
    const wonValue = wonLeads.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);
    const conversionRate = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

    // Avg follow-up time (hours between interactions per lead)
    const leadInteractionMap: Record<string, string[]> = {};
    interactions.forEach(i => {
      if (!leadInteractionMap[i.lead_id]) leadInteractionMap[i.lead_id] = [];
      leadInteractionMap[i.lead_id].push(i.created_at);
    });
    let totalFollowHours = 0;
    let followCount = 0;
    Object.values(leadInteractionMap).forEach(dates => {
      if (dates.length < 2) return;
      const sorted = dates.sort();
      for (let i = 1; i < sorted.length; i++) {
        totalFollowHours += differenceInHours(new Date(sorted[i]), new Date(sorted[i - 1]));
        followCount++;
      }
    });
    const avgFollowUp = followCount > 0 ? Math.round(totalFollowHours / followCount) : 0;

    // Leads without interaction in 48h (SLA at risk)
    const now = new Date();
    const slaAtRisk = activeLeads.filter(l => {
      const lastContact = l.ultimo_contato ? new Date(l.ultimo_contato) : new Date(l.created_at);
      return differenceInHours(now, lastContact) > 48;
    });

    // Response rate (leads with at least 1 interaction / total leads)
    const leadsWithInteraction = new Set(interactions.map(i => i.lead_id));
    const responseRate = leads.length > 0 ? Math.round((leadsWithInteraction.size / leads.length) * 100) : 0;

    return {
      activeLeads: activeLeads.length,
      totalPipeline,
      wonValue,
      conversionRate,
      avgFollowUp,
      slaAtRisk: slaAtRisk.length,
      slaAtRiskLeads: slaAtRisk.slice(0, 5),
      responseRate,
    };
  }, [leads, interactions]);

  // Pipeline funnel data
  const funnelData = useMemo(() =>
    STATUS_PIPELINE.map(status => ({
      name: status.length > 12 ? status.slice(0, 12) + "…" : status,
      fullName: status,
      count: leads.filter(l => l.status === status).length,
      value: leads.filter(l => l.status === status).reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0),
    })),
    [leads]
  );

  // Recent leads needing attention
  const recentLeads = useMemo(() =>
    leads.filter(l => !["Ganho", "Perdido"].includes(l.status)).slice(0, 6),
    [leads]
  );

  const handleExport = (format: "csv" | "json") => {
    const data = leads.map(l => ({
      nome: l.nome, empresa: l.empresa, status: l.status,
      valor_estimado: l.valor_estimado, origem: l.origem,
      ultimo_contato: l.ultimo_contato, created_at: l.created_at,
    }));
    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ["Nome", "Empresa", "Status", "Valor Estimado", "Origem", "Último Contato", "Criado em"];
      const rows = data.map(d => [d.nome, d.empresa, d.status, d.valor_estimado, d.origem, d.ultimo_contato, d.created_at].map(v => `"${(v || "").toString().replace(/"/g, '""')}"`).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {greeting()}, {profile?.nome?.split(" ")[0] || "Operador"} 🎯
            </h1>
            <p className="text-muted-foreground text-sm">Painel SDR — {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/crm/new">
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Lead</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-1">
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("json")} className="gap-1">
              <Download className="w-4 h-4" /> JSON
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 flex-wrap">
          <Link to="/crm/new"><Button variant="outline" className="gap-2 h-10"><Plus className="w-4 h-4" /> Novo Lead</Button></Link>
          <Link to="/crm/kanban"><Button variant="outline" className="gap-2 h-10"><Target className="w-4 h-4" /> Funil Kanban</Button></Link>
          <Link to="/canais"><Button variant="outline" className="gap-2 h-10"><MessageSquare className="w-4 h-4" /> Teams</Button></Link>
          <Link to="/daily"><Button variant="outline" className="gap-2 h-10"><Calendar className="w-4 h-4" /> Meu Dia</Button></Link>
          <Link to="/playbook"><Button variant="outline" className="gap-2 h-10 border-primary/30 text-primary"><Zap className="w-4 h-4" /> Playbook SDR</Button></Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Leads Ativos</span>
              </div>
              <p className="text-2xl font-bold">{loading ? "…" : kpis.activeLeads}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Pipeline</span>
              </div>
              <p className="text-xl font-bold">R$ {loading ? "…" : kpis.totalPipeline.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Conversão</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{loading ? "…" : `${kpis.conversionRate}%`}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Taxa Resposta</span>
              </div>
              <p className="text-2xl font-bold">{loading ? "…" : `${kpis.responseRate}%`}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Tempo Follow-up</span>
              </div>
              <p className="text-2xl font-bold">{loading ? "…" : `${kpis.avgFollowUp}h`}</p>
            </CardContent>
          </Card>
          <Card className={kpis.slaAtRisk > 0 ? "border-destructive/50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${kpis.slaAtRisk > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-xs text-muted-foreground">SLA em Risco</span>
              </div>
              <p className={`text-2xl font-bold ${kpis.slaAtRisk > 0 ? "text-destructive" : ""}`}>{loading ? "…" : kpis.slaAtRisk}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pipeline Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base">Pipeline por Etapa</CardTitle>
              <Link to="/crm/kanban">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">Kanban <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card p-2 rounded border shadow text-xs">
                            <p className="font-medium">{d.fullName}</p>
                            <p>{d.count} leads • R$ {d.value.toLocaleString("pt-BR")}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS_MAP[entry.fullName] || "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* SLA at Risk */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Sem Contato +48h
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-4">Carregando...</p>
              ) : kpis.slaAtRiskLeads.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Todos os leads em dia! 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kpis.slaAtRiskLeads.map(lead => {
                    const lastContact = lead.ultimo_contato || lead.created_at;
                    const hoursAgo = differenceInHours(new Date(), new Date(lastContact));
                    return (
                      <Link
                        key={lead.id}
                        to={`/crm/${lead.id}`}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{lead.nome}</p>
                          <p className="text-xs text-muted-foreground">{lead.empresa || "—"}</p>
                        </div>
                        <Badge variant="destructive" className="text-[10px] shrink-0">
                          {hoursAgo > 72 ? `${Math.floor(hoursAgo / 24)}d` : `${hoursAgo}h`}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Leads */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base">Leads Recentes</CardTitle>
              <Link to="/crm">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">Ver todos <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-4">Carregando...</p>
              ) : recentLeads.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum lead ativo</p>
                  <Link to="/crm/new"><Button size="sm" className="mt-2">Criar Lead</Button></Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentLeads.map(lead => (
                    <Link
                      key={lead.id}
                      to={`/crm/${lead.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{lead.nome}</p>
                        <p className="text-xs text-muted-foreground">{lead.empresa || "—"} • {lead.origem || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {lead.valor_estimado > 0 && (
                          <span className="text-xs font-medium text-green-600">R$ {Number(lead.valor_estimado).toLocaleString("pt-BR")}</span>
                        )}
                        <Badge variant="outline" className="text-[10px]">{lead.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Focus AI Insights */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Insights Focus AI
              </CardTitle>
              <Link to="/focus-ai">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">Ver mais <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground py-4">Carregando...</p>
              ) : insights.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum insight pendente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {insights.map(ins => (
                    <div key={ins.id} className="p-3 rounded-lg border bg-primary/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{ins.tipo}</Badge>
                        <Badge className="text-[10px] bg-primary/10 text-primary border-0">{ins.prioridade}</Badge>
                      </div>
                      <p className="text-sm font-medium">{ins.titulo}</p>
                      {ins.acao_recomendada && (
                        <p className="text-xs text-muted-foreground mt-1">→ {ins.acao_recomendada}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </HexaLayout>
  );
}
