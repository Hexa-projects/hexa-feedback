import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  getPipelineStats, getLearningStats, listPendingActions,
  approveAction, rejectAction, submitFeedback,
} from "@/lib/webhook-client";
import {
  RefreshCw, Activity, Shield, Brain, CheckCircle2, XCircle,
  AlertTriangle, Clock, TrendingUp, Inbox, Eye, Zap,
  ThumbsUp, ThumbsDown, BarChart3, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export default function WebhookOpsDashboard() {
  const [pipeline, setPipeline] = useState<any>({});
  const [learning, setLearning] = useState<any>({});
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [recentWebhooks, setRecentWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pStats, lStats, actions, audit, webhooks] = await Promise.all([
      getPipelineStats(),
      getLearningStats(),
      listPendingActions(),
      supabase.from("ai_audit_trail" as any).select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("webhook_events" as any).select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    setPipeline(pStats);
    setLearning(lStats);
    setPendingActions(actions);
    setRecentAudit((audit.data || []) as any);
    setRecentWebhooks((webhooks.data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleApprove = async (id: string) => {
    const res = await approveAction(id);
    if (res?.success) { toast.success("Ação aprovada e executada"); loadAll(); }
    else toast.error("Falha ao aprovar");
  };

  const handleReject = async (id: string) => {
    const res = await rejectAction(id, "Rejeitado pelo admin");
    if (res?.success) { toast.success("Ação rejeitada"); loadAll(); }
    else toast.error("Falha ao rejeitar");
  };

  const wh = pipeline.webhook_events || {};
  const q = pipeline.event_queue || {};
  const acts = pipeline.actions || {};

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-hexa-amber/15 text-hexa-amber-dark",
      received: "bg-hexa-blue/15 text-hexa-blue",
      delivered: "bg-hexa-green/15 text-hexa-green",
      completed: "bg-hexa-green/15 text-hexa-green",
      approved: "bg-hexa-teal/15 text-hexa-teal",
      failed: "bg-destructive/15 text-destructive",
      dlq: "bg-destructive/15 text-destructive",
      rejected: "bg-muted text-muted-foreground",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Centro de Operações — Focus AI
          </h2>
          <p className="text-xs text-muted-foreground">Pipeline de webhooks, ações e aprendizado</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Webhooks", value: wh.total || 0, icon: Inbox, sub: `${wh.delivered || 0} entregues` },
          { label: "Fila", value: q.pending || 0, icon: Clock, sub: `${q.delivered || 0} processados` },
          { label: "Ações IA", value: acts.total || 0, icon: Zap, sub: `${acts.pending || 0} pendentes` },
          { label: "Aprovação", value: `${learning.acceptance_rate || 0}%`, icon: ThumbsUp, sub: `${learning.total_feedback || 0} feedbacks` },
          { label: "Auditoria", value: pipeline.audit_count || 0, icon: Shield, sub: "registros" },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-2xl font-bold">{loading ? "..." : c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="actions" className="gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Ações Pendentes
            {pendingActions.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{pendingActions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5"><Inbox className="w-3.5 h-3.5" /> Webhooks</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><Eye className="w-3.5 h-3.5" /> Auditoria</TabsTrigger>
          <TabsTrigger value="learning" className="gap-1.5"><Brain className="w-3.5 h-3.5" /> Aprendizado</TabsTrigger>
        </TabsList>

        {/* ── Pending Actions ── */}
        <TabsContent value="actions">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ações propostas pelo Focus AI aguardando decisão</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingActions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ação pendente.</p>
              ) : (
                <div className="space-y-3">
                  {pendingActions.map((a: any) => (
                    <div key={a.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold">{a.title}</h4>
                            <Badge className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                            <Badge variant="outline" className="text-[10px]">{a.domain}</Badge>
                            {a.risk_level === "critical" && (
                              <Badge variant="destructive" className="text-[10px]">⚠️ Crítico</Badge>
                            )}
                          </div>
                          {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                          <p className="text-xs mt-1"><strong>Motivo:</strong> {a.reason}</p>
                          {a.estimated_impact && <p className="text-xs"><strong>Impacto:</strong> {a.estimated_impact}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Nível {a.autonomy_level} · Política: {a.policy_applied}
                          </p>
                        </div>
                        {a.status === "pending" && (
                          <div className="flex gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleReject(a.id)}>
                              <XCircle className="w-3 h-3" /> Rejeitar
                            </Button>
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleApprove(a.id)}>
                              <CheckCircle2 className="w-3 h-3" /> Aprovar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Webhooks ── */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Últimos eventos recebidos</CardTitle>
            </CardHeader>
            <CardContent>
              {recentWebhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum webhook registrado.</p>
              ) : (
                <div className="space-y-1">
                  {recentWebhooks.map((w: any) => (
                    <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 text-sm">
                      <Badge className={`text-[10px] ${statusColor(w.status)}`}>{w.status}</Badge>
                      <span className="font-mono text-xs text-muted-foreground w-20 truncate">{w.source}</span>
                      <span className="flex-1 truncate font-medium">{w.event_type}</span>
                      <Badge variant="outline" className="text-[10px]">{w.priority}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(w.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Audit Trail ── */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Trilha de auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAudit.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sem registros de auditoria.</p>
              ) : (
                <div className="space-y-1">
                  {recentAudit.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 text-sm">
                      <Badge variant="outline" className="text-[10px] capitalize">{a.actor_type}</Badge>
                      <span className="flex-1 truncate">{a.action}</span>
                      <span className="text-xs text-muted-foreground">{a.entity_type}</span>
                      <Badge className={`text-[10px] ${statusColor(a.outcome || "")}`}>{a.outcome}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Learning ── */}
        <TabsContent value="learning">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" /> Métricas de Aprendizado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Total de feedbacks", value: learning.total_feedback || 0 },
                  { label: "Taxa de aceitação", value: `${learning.acceptance_rate || 0}%` },
                  { label: "Score médio de eficácia", value: learning.avg_effectiveness || "0.00" },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{m.label}</span>
                    <span className="text-sm font-bold">{m.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Decisões por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(learning.by_decision || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{k === "accepted" ? "Aceitas" : k === "rejected" ? "Rejeitadas" : k === "modified" ? "Modificadas" : "Ignoradas"}</span>
                    <Badge variant="secondary" className="text-xs">{String(v)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
