import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { triggerSync, getQueueStats, flushDLQ, enqueueEvent } from "@/lib/openclaw-events";
import {
  RefreshCw, Play, Trash2, Wifi, WifiOff, Clock,
  CheckCircle2, XCircle, AlertTriangle, ArrowUpCircle, Inbox
} from "lucide-react";
import { toast } from "sonner";

interface SyncMetric {
  metric_name: string;
  metric_value: any;
  updated_at: string;
}

export default function OpenClawSyncPanel() {
  const [stats, setStats] = useState<Record<string, number>>({ pending: 0, delivered: 0, failed: 0, dlq: 0, processing: 0 });
  const [metrics, setMetrics] = useState<SyncMetric[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statsRes, metricsRes, eventsRes] = await Promise.all([
      getQueueStats(),
      supabase.from("openclaw_sync_status" as any).select("*"),
      supabase.from("openclaw_event_queue" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    setStats(statsRes);
    setMetrics((metricsRes.data || []) as any);
    setRecentEvents((eventsRes.data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    const result = await triggerSync();
    if (result.success) {
      toast.success(result.message || `${result.processed} eventos enviados`);
    } else {
      toast.error(result.message || "Falha no sync");
    }
    await loadData();
    setSyncing(false);
  };

  const handleFlushDLQ = async () => {
    const ok = await flushDLQ();
    if (ok) toast.success("DLQ reprocessada com sucesso");
    else toast.error("Erro ao reprocessar DLQ");
    await loadData();
  };

  const handleTestEvent = async () => {
    const id = await enqueueEvent({
      event_type: "test.ping",
      priority: "low",
      tags: ["test"],
      data: { message: "Evento de teste do HexaOS", timestamp: new Date().toISOString() },
    });
    if (id) toast.success("Evento de teste enfileirado");
    else toast.error("Erro ao enfileirar evento");
    await loadData();
  };

  const connection = metrics.find(m => m.metric_name === "connection")?.metric_value;
  const heartbeat = metrics.find(m => m.metric_name === "last_heartbeat")?.metric_value;
  const isConnected = connection?.status === "connected";

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-500/10 text-yellow-600",
      processing: "bg-blue-500/10 text-blue-600",
      delivered: "bg-green-500/10 text-green-600",
      failed: "bg-red-500/10 text-red-600",
      dlq: "bg-destructive/10 text-destructive",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* Status header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5" /> Sync Autônomo — OpenClaw
          </CardTitle>
          <CardDescription>Envio contínuo de dados operacionais ao OpenClaw Gateway.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <><Wifi className="w-4 h-4 text-green-500" /><span className="text-sm text-green-600 font-medium">Conectado</span></>
              ) : (
                <><WifiOff className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Desconectado</span></>
              )}
            </div>
            {heartbeat?.sent_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Último envio: {new Date(heartbeat.sent_at).toLocaleString("pt-BR")}
              </span>
            )}
            {connection?.error && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {connection.error}
              </span>
            )}
          </div>

          {/* Queue stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[
              { label: "Pendentes", key: "pending", icon: Inbox, color: "text-yellow-600" },
              { label: "Processando", key: "processing", icon: RefreshCw, color: "text-blue-600" },
              { label: "Entregues", key: "delivered", icon: CheckCircle2, color: "text-green-600" },
              { label: "Falhas", key: "failed", icon: XCircle, color: "text-red-500" },
              { label: "DLQ", key: "dlq", icon: AlertTriangle, color: "text-destructive" },
            ].map(s => (
              <div key={s.key} className="flex items-center gap-2 p-3 rounded-lg border">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <div>
                  <p className="text-lg font-bold">{stats[s.key] || 0}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSync} disabled={syncing} size="sm" className="gap-1">
              {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Processar Fila
            </Button>
            <Button onClick={handleTestEvent} variant="outline" size="sm" className="gap-1">
              <ArrowUpCircle className="w-3 h-3" /> Enviar Evento Teste
            </Button>
            {(stats.dlq || 0) > 0 && (
              <Button onClick={handleFlushDLQ} variant="destructive" size="sm" className="gap-1">
                <Trash2 className="w-3 h-3" /> Reprocessar DLQ ({stats.dlq})
              </Button>
            )}
            <Button onClick={loadData} variant="ghost" size="sm" className="gap-1" disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Últimos Eventos na Fila</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {recentEvents.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento na fila.</p>
            )}
            {recentEvents.map((e: any) => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded text-xs bg-muted/30">
                <Badge variant="outline" className={`text-[10px] px-1.5 ${statusColor(e.status)}`}>
                  {e.status}
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5">{e.priority}</Badge>
                <span className="font-mono text-muted-foreground">{e.event_type}</span>
                <span className="ml-auto text-muted-foreground whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </span>
                {e.last_error && (
                  <span className="text-destructive truncate max-w-[200px]" title={e.last_error}>
                    {e.last_error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
