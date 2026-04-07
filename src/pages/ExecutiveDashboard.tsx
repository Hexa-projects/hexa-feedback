import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  TrendingUp, AlertTriangle, Users, Wrench, DollarSign,
  Clock, Send, RefreshCw, ShieldAlert, Phone
} from "lucide-react";
import { differenceInHours, format } from "date-fns";

interface CrisisItem {
  id: string;
  type: "os_atrasada" | "lead_travado";
  title: string;
  detail: string;
  hours_idle: number;
  urgency: string;
}

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [kpis, setKpis] = useState({
    total_leads: 0,
    leads_month: 0,
    leads_won: 0,
    proposals_value: 0,
    open_os: 0,
    critical_os: 0,
    overdue_os: 0,
    revenue: 0,
    expenses: 0,
  });
  const [crisisItems, setCrisisItems] = useState<CrisisItem[]>([]);
  const [funnel, setFunnel] = useState<Record<string, number>>({});

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const threshold48h = new Date(Date.now() - 48 * 3600000).toISOString();
      const threshold24h = new Date(Date.now() - 24 * 3600000).toISOString();

      const [
        leadsRes, leadsMonthRes, leadsWonRes,
        proposalsRes, osRes, osCritRes,
        revenueRes, expensesRes,
        overdueOsRes, staleLeadsRes,
        leadsByStatus,
      ] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "Ganho"),
        supabase.from("proposals").select("valor").neq("status", "Cancelado"),
        supabase.from("work_orders").select("*", { count: "exact", head: true })
          .not("status", "in", '("Concluído","Cancelado")'),
        supabase.from("work_orders").select("*", { count: "exact", head: true })
          .in("urgencia", ["Alta", "Crítica"]).not("status", "in", '("Concluído","Cancelado")'),
        supabase.from("financial_records").select("valor").eq("tipo", "receita").eq("status", "pago"),
        supabase.from("financial_records").select("valor").eq("tipo", "despesa").eq("status", "pago"),
        // OS com mais de 48h abertas (crise)
        supabase.from("work_orders")
          .select("id, numero_os, cliente, equipamento, urgencia, status, created_at")
          .not("status", "in", '("Concluído","Cancelado")')
          .lt("created_at", threshold48h)
          .order("created_at", { ascending: true })
          .limit(20),
        // Leads sem contato há 24h+
        supabase.from("leads")
          .select("id, nome, empresa, status, ultimo_contato")
          .not("status", "in", '("Ganho","Perdido")')
          .or(`ultimo_contato.is.null,ultimo_contato.lt.${threshold24h}`)
          .limit(20),
        // Funnel
        supabase.from("leads").select("status"),
      ]);

      const pipelineValue = (proposalsRes.data || []).reduce((s, p: any) => s + (p.valor || 0), 0);
      const totalRevenue = (revenueRes.data || []).reduce((s, r: any) => s + (r.valor || 0), 0);
      const totalExpenses = (expensesRes.data || []).reduce((s, r: any) => s + (r.valor || 0), 0);

      setKpis({
        total_leads: leadsRes.count || 0,
        leads_month: leadsMonthRes.count || 0,
        leads_won: leadsWonRes.count || 0,
        proposals_value: pipelineValue,
        open_os: osRes.count || 0,
        critical_os: osCritRes.count || 0,
        overdue_os: (overdueOsRes.data || []).length,
        revenue: totalRevenue,
        expenses: totalExpenses,
      });

      // Build funnel
      const f: Record<string, number> = {};
      (leadsByStatus.data || []).forEach((l: any) => { f[l.status] = (f[l.status] || 0) + 1; });
      setFunnel(f);

      // Build crisis items
      const crisis: CrisisItem[] = [];
      (overdueOsRes.data || []).forEach((os: any) => {
        const hoursElapsed = differenceInHours(new Date(), new Date(os.created_at));
        crisis.push({
          id: os.id,
          type: "os_atrasada",
          title: `OS ${os.numero_os || os.id.slice(0, 8)} — ${os.cliente}`,
          detail: `${os.equipamento} • ${os.urgencia}`,
          hours_idle: hoursElapsed,
          urgency: os.urgencia,
        });
      });
      (staleLeadsRes.data || []).forEach((lead: any) => {
        const hoursIdle = lead.ultimo_contato
          ? differenceInHours(new Date(), new Date(lead.ultimo_contato))
          : 999;
        crisis.push({
          id: lead.id,
          type: "lead_travado",
          title: `${lead.nome} — ${lead.empresa || "Sem empresa"}`,
          detail: `Status: ${lead.status} • ${hoursIdle > 900 ? "Nunca contatado" : `${hoursIdle}h sem contato`}`,
          hours_idle: hoursIdle,
          urgency: hoursIdle > 72 ? "Crítica" : "Alta",
        });
      });
      crisis.sort((a, b) => b.hours_idle - a.hours_idle);
      setCrisisItems(crisis);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
    setLoading(false);
  };

  const sendDailyReport = async () => {
    setSending(true);
    try {
      const reportText = [
        `📊 *Relatório Executivo HexaOS* — ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        "",
        `🎯 *Vendas*`,
        `• Leads total: ${kpis.total_leads} | Mês: ${kpis.leads_month} | Ganhos: ${kpis.leads_won}`,
        `• Pipeline: R$ ${kpis.proposals_value.toLocaleString("pt-BR")}`,
        "",
        `🔧 *Operacional*`,
        `• OS abertas: ${kpis.open_os} | Críticas: ${kpis.critical_os} | Atrasadas >48h: ${kpis.overdue_os}`,
        "",
        `💰 *Financeiro*`,
        `• Receita: R$ ${kpis.revenue.toLocaleString("pt-BR")}`,
        `• Despesas: R$ ${kpis.expenses.toLocaleString("pt-BR")}`,
        `• Resultado: R$ ${(kpis.revenue - kpis.expenses).toLocaleString("pt-BR")}`,
        "",
        `⚠️ *Alertas de Crise*: ${crisisItems.length} itens`,
        ...crisisItems.slice(0, 5).map(c =>
          `  • ${c.type === "os_atrasada" ? "🔧" : "👤"} ${c.title} (${c.hours_idle}h)`
        ),
      ].join("\n");

      // Log automation execution
      await supabase.from("automation_executions").insert({
        automation_type: "daily_report_whatsapp",
        trigger_entity: "executive_dashboard",
        trigger_id: user?.id,
        payload: { report: reportText, kpis },
        status: "pending",
        executed_by: user?.id || "system",
      } as any);

      // Send via WhatsApp service
      const { error } = await supabase.functions.invoke("whatsapp-service", {
        body: {
          action: "send_text",
          to: "ceo",
          message: reportText,
        },
      });

      if (error) throw error;

      await supabase.from("automation_executions").update({
        status: "completed",
      } as any).eq("trigger_entity", "executive_dashboard").eq("automation_type", "daily_report_whatsapp").order("created_at", { ascending: false }).limit(1);

      toast.success("Relatório enviado para o WhatsApp do CEO!");
    } catch (err: any) {
      // Queue for retry
      await supabase.from("openclaw_event_queue").insert({
        event_type: "daily_report_whatsapp",
        data: { kpis, crisis_count: crisisItems.length },
        status: "pending",
        domain: "automation",
        priority: "high",
      } as any);
      toast.error("Falha ao enviar. Relatório enfileirado para reenvio.");
    }
    setSending(false);
  };

  const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <HexaLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </HexaLayout>
    );
  }

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Executive Dashboard</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada em tempo real</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadDashboard} className="gap-1">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
            <Button size="sm" onClick={sendDailyReport} disabled={sending} className="gap-1">
              <Send className="w-4 h-4" /> {sending ? "Enviando..." : "Relatório Diário"}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Leads Total</span>
              </div>
              <p className="text-xl font-bold">{kpis.total_leads}</p>
              <p className="text-xs text-muted-foreground">+{kpis.leads_month} este mês</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-hexa-green" />
                <span className="text-xs text-muted-foreground">Pipeline</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(kpis.proposals_value)}</p>
              <p className="text-xs text-muted-foreground">{kpis.leads_won} ganhos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="w-4 h-4 text-hexa-amber" />
                <span className="text-xs text-muted-foreground">OS Abertas</span>
              </div>
              <p className="text-xl font-bold">{kpis.open_os}</p>
              <p className="text-xs text-destructive font-medium">{kpis.critical_os} críticas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-hexa-green" />
                <span className="text-xs text-muted-foreground">Receita</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(kpis.revenue)}</p>
              <p className="text-xs text-muted-foreground">Despesas: {formatCurrency(kpis.expenses)}</p>
            </CardContent>
          </Card>
          <Card className={kpis.overdue_os > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Alertas</span>
              </div>
              <p className="text-xl font-bold text-destructive">{crisisItems.length}</p>
              <p className="text-xs text-muted-foreground">{kpis.overdue_os} OS atrasadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Funnel Overview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Funil de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(funnel).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium">{status}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Crisis Management */}
        <Tabs defaultValue="crises">
          <TabsList>
            <TabsTrigger value="crises" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> Gestão de Crise ({crisisItems.length})
            </TabsTrigger>
            <TabsTrigger value="os_atrasadas" className="gap-1">
              <Clock className="w-3 h-3" /> OS Atrasadas
            </TabsTrigger>
            <TabsTrigger value="leads_travados" className="gap-1">
              <Phone className="w-3 h-3" /> Leads Travados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crises" className="mt-4">
            {crisisItems.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-hexa-green" />
                  <p className="font-medium">Nenhum alerta de crise ativo</p>
                  <p className="text-sm">Todas as OS e leads estão dentro do SLA.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {crisisItems.map(item => (
                  <Card key={item.id} className={
                    item.urgency === "Crítica" ? "border-destructive/40 bg-destructive/5" :
                    "border-hexa-amber/40 bg-hexa-amber/5"
                  }>
                    <CardContent className="p-3 flex items-center gap-3">
                      {item.type === "os_atrasada" ? (
                        <Wrench className="w-5 h-5 text-destructive shrink-0" />
                      ) : (
                        <Users className="w-5 h-5 text-hexa-amber shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={item.urgency === "Crítica" ? "destructive" : "outline"} className="text-[10px]">
                          {item.hours_idle}h
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.urgency}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="os_atrasadas" className="mt-4">
            <div className="space-y-2">
              {crisisItems.filter(c => c.type === "os_atrasada").map(item => (
                <Card key={item.id} className="border-destructive/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Wrench className="w-5 h-5 text-destructive shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <Badge variant="destructive">{item.hours_idle}h atraso</Badge>
                  </CardContent>
                </Card>
              ))}
              {crisisItems.filter(c => c.type === "os_atrasada").length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma OS atrasada 🎉</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="leads_travados" className="mt-4">
            <div className="space-y-2">
              {crisisItems.filter(c => c.type === "lead_travado").map(item => (
                <Card key={item.id} className="border-hexa-amber/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Users className="w-5 h-5 text-hexa-amber shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <Badge variant="outline">{item.hours_idle > 900 ? "∞" : `${item.hours_idle}h`}</Badge>
                  </CardContent>
                </Card>
              ))}
              {crisisItems.filter(c => c.type === "lead_travado").length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Todos os leads em dia 🎉</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
