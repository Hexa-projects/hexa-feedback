import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, RefreshCw, CheckCircle2, XCircle, Clock,
  Video, MessageSquare, Brain, Webhook, Database,
  AlertTriangle, TrendingUp, Shield, FileText
} from "lucide-react";

interface ServiceStatus {
  name: string;
  icon: any;
  status: "ok" | "warning" | "error" | "unknown";
  detail: string;
  lastCheck: string;
}

export default function OpsDashboard() {
  const { role } = useAuth();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [queue, setQueue] = useState<Record<string, number> | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [auditCount, setAuditCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkAll = useCallback(async () => {
    setRefreshing(true);
    const now = new Date().toISOString();
    const statuses: ServiceStatus[] = [];

    // 1) Supabase DB health
    try {
      const start = Date.now();
      const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      const latency = Date.now() - start;
      statuses.push({
        name: "Supabase DB",
        icon: Database,
        status: error ? "error" : latency > 2000 ? "warning" : "ok",
        detail: error ? error.message : `Latência: ${latency}ms`,
        lastCheck: now,
      });
    } catch {
      statuses.push({ name: "Supabase DB", icon: Database, status: "error", detail: "Sem conexão", lastCheck: now });
    }

    // 2) WhatsApp (Evolution API)
    try {
      const { data } = await supabase
        .from("integration_configs")
        .select("config")
        .eq("integration_name", "evolution_api")
        .maybeSingle();
      const cfg = data?.config as any;
      const hasUrl = cfg?.api_url && cfg.api_url.length > 5;
      const hasKey = cfg?.api_key && cfg.api_key.length > 5;
      statuses.push({
        name: "WhatsApp (Evolution)",
        icon: MessageSquare,
        status: hasUrl && hasKey ? "ok" : "warning",
        detail: hasUrl && hasKey ? "Configurado" : "Credenciais incompletas",
        lastCheck: now,
      });
    } catch {
      statuses.push({ name: "WhatsApp (Evolution)", icon: MessageSquare, status: "unknown", detail: "Não verificado", lastCheck: now });
    }

    // 3) LiveKit
    try {
      const { count } = await supabase
        .from("meeting_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      statuses.push({
        name: "LiveKit Cloud",
        icon: Video,
        status: "ok",
        detail: `${count || 0} reuniões na última semana`,
        lastCheck: now,
      });
    } catch {
      statuses.push({ name: "LiveKit Cloud", icon: Video, status: "unknown", detail: "Não verificado", lastCheck: now });
    }

    // 4) OpenClaw
    try {
      const { data: cfg } = await supabase.from("focus_ai_config").select("openclaw_ativo, openclaw_url").limit(1).single();
      const { data: syncData } = await supabase
        .from("openclaw_sync_status")
        .select("metric_value")
        .eq("metric_name", "connection")
        .maybeSingle();
      const connStatus = (syncData?.metric_value as any)?.status;
      statuses.push({
        name: "OpenClaw (IA)",
        icon: Brain,
        status: cfg?.openclaw_ativo ? (connStatus === "connected" ? "ok" : connStatus === "error" ? "error" : "warning") : "warning",
        detail: cfg?.openclaw_ativo
          ? `${connStatus === "connected" ? "Conectado" : connStatus === "error" ? "Erro de conexão" : "Sincronizando"} · ${cfg.openclaw_url || "sem URL"}`
          : "Desativado",
        lastCheck: now,
      });
    } catch {
      statuses.push({ name: "OpenClaw (IA)", icon: Brain, status: "unknown", detail: "Config não encontrada", lastCheck: now });
    }

    // 5) Edge Functions
    try {
      const { count } = await supabase
        .from("focus_ai_logs")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "erro")
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());
      statuses.push({
        name: "Edge Functions",
        icon: Webhook,
        status: (count || 0) > 10 ? "warning" : "ok",
        detail: `${count || 0} erros nas últimas 24h`,
        lastCheck: now,
      });
    } catch {
      statuses.push({ name: "Edge Functions", icon: Webhook, status: "unknown", detail: "Não verificado", lastCheck: now });
    }

    setServices(statuses);

    // Queue metrics (all statuses)
    try {
      const counts: Record<string, number> = {};
      for (const status of ["pending", "processing", "delivered", "failed", "dlq"]) {
        const { count } = await supabase
          .from("openclaw_event_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        counts[status] = count || 0;
      }
      setQueue(counts);
    } catch {
      setQueue(null);
    }

    // Sync status
    try {
      const { data } = await supabase
        .from("openclaw_sync_status")
        .select("metric_name, metric_value, updated_at")
        .order("updated_at", { ascending: false });
      setSyncStatus(data || []);
    } catch {
      setSyncStatus(null);
    }

    // Audit trail count (24h)
    try {
      const { count } = await supabase
        .from("ai_audit_trail")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());
      setAuditCount(count || 0);
    } catch {
      setAuditCount(0);
    }

    // Recent meetings
    try {
      const { data } = await supabase
        .from("meeting_logs")
        .select("id, room_name, started_at, ended_at, duration_seconds, participants, summary")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentMeetings(data || []);
    } catch {
      setRecentMeetings([]);
    }

    // Recent logs
    try {
      const { data } = await supabase
        .from("focus_ai_logs")
        .select("id, tipo, mensagem, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      setRecentLogs(data || []);
    } catch {
      setRecentLogs([]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (role === "admin") checkAll();
  }, [role, checkAll]);

  if (role !== "admin") {
    return (
      <HexaLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground text-sm">Painel de operações exclusivo para administradores.</p>
            </CardContent>
          </Card>
        </div>
      </HexaLayout>
    );
  }

  const statusBadge = (s: ServiceStatus["status"]) => {
    const map = { ok: "Operacional", warning: "Atenção", error: "Offline", unknown: "Desconhecido" };
    const variant = s === "ok" ? "default" : s === "warning" ? "secondary" : s === "error" ? "destructive" : "outline";
    return <Badge variant={variant as any} className="text-xs">{map[s]}</Badge>;
  };

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> Painel de Operações
            </h1>
            <p className="text-muted-foreground text-sm">Status em tempo real de todas as integrações e serviços do HexaOS.</p>
          </div>
          <Button onClick={checkAll} disabled={refreshing} variant="outline" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Service health grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(loading ? Array(5).fill(null) : services).map((svc, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                {!svc ? (
                  <div className="animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-2/3" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      svc.status === "ok" ? "bg-hexa-green/10" : svc.status === "warning" ? "bg-hexa-amber/10" : svc.status === "error" ? "bg-destructive/10" : "bg-muted"
                    }`}>
                      <svc.icon className={`w-5 h-5 ${
                        svc.status === "ok" ? "text-hexa-green" : svc.status === "warning" ? "text-hexa-amber" : svc.status === "error" ? "text-destructive" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{svc.name}</p>
                        {statusBadge(svc.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">{svc.detail}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Queue & Audit metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {queue && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Fila de Eventos (OpenClaw)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: "pending", label: "Pendentes", color: "text-hexa-amber", bg: "bg-hexa-amber/10" },
                    { key: "processing", label: "Processando", color: "text-primary", bg: "bg-primary/10" },
                    { key: "delivered", label: "Entregues", color: "text-hexa-green", bg: "bg-hexa-green/10" },
                    { key: "failed", label: "Falhas", color: "text-destructive", bg: "bg-destructive/10" },
                    { key: "dlq", label: "DLQ", color: "text-destructive", bg: "bg-destructive/10" },
                  ].map(({ key, label, color, bg }) => (
                    <div key={key} className={`text-center p-2 rounded-lg ${bg}`}>
                      <p className={`text-xl font-bold ${color}`}>{queue[key] || 0}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" /> Auditoria & Governança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-primary/10">
                  <p className="text-2xl font-bold text-primary">{auditCount}</p>
                  <p className="text-xs text-muted-foreground">Eventos auditados (24h)</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  {syncStatus && syncStatus.length > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-foreground">{syncStatus.length}</p>
                      <p className="text-xs text-muted-foreground">Métricas de sync</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-muted-foreground">—</p>
                      <p className="text-xs text-muted-foreground">Sem dados de sync</p>
                    </>
                  )}
                </div>
              </div>
              {syncStatus && syncStatus.length > 0 && (
                <div className="mt-3 space-y-1">
                  {syncStatus.slice(0, 4).map((s: any, i: number) => (
                    <div key={i} className="text-xs flex justify-between p-1.5 rounded bg-muted/50">
                      <span className="font-medium">{s.metric_name}</span>
                      <span className="text-muted-foreground">{new Date(s.updated_at).toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent meetings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="w-5 h-5" /> Reuniões Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentMeetings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhuma reunião registrada.</p>
              ) : (
                <div className="space-y-3">
                  {recentMeetings.map(m => {
                    const pCount = Array.isArray(m.participants) ? m.participants.length : 0;
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{m.room_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(m.started_at).toLocaleString("pt-BR")} · {pCount} participante{pCount !== 1 ? "s" : ""}
                            {m.duration_seconds ? ` · ${Math.round(m.duration_seconds / 60)}min` : ""}
                          </p>
                        </div>
                        <Badge variant={m.ended_at ? "secondary" : "default"} className="text-xs">
                          {m.ended_at ? "Encerrada" : "Ativa"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" /> Logs de Execução
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum log registrado.</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {recentLogs.map(l => (
                    <div key={l.id} className="text-xs flex items-start gap-2 p-2 rounded bg-muted/50">
                      <span className={`mt-0.5 ${l.tipo === "erro" ? "text-destructive" : l.tipo === "sucesso" ? "text-hexa-green" : "text-muted-foreground"}`}>●</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")} </span>
                        <span className="break-words">{l.mensagem}</span>
                      </div>
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
