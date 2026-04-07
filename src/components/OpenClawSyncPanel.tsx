import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { triggerSync, getQueueStats, flushDLQ, enqueueEvent, retryEvent } from "@/lib/openclaw-events";
import {
  RefreshCw, Play, Trash2, Clock, CheckCircle2, XCircle,
  AlertTriangle, ArrowUpCircle, Inbox, Eye, RotateCcw, Activity
} from "lucide-react";
import { toast } from "sonner";

type HealthStatus = "active" | "degraded" | "inactive";

export default function OpenClawSyncPanel() {
  const [stats, setStats] = useState<Record<string, number>>({ pending: 0, delivered: 0, failed: 0, dlq: 0, processing: 0 });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [health, setHealth] = useState<HealthStatus>("inactive");
  const [failures24h, setFailures24h] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorModal, setErrorModal] = useState<{ open: boolean; error: string; eventType: string }>({ open: false, error: "", eventType: "" });

  const loadData = useCallback(async () => {
    setLoading(true);

    const [statsRes, eventsRes, recentDelivered] = await Promise.all([
      getQueueStats(),
      supabase.from("openclaw_event_queue" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("openclaw_event_queue" as any)
        .select("status")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    setStats(statsRes);
    const events = (eventsRes.data || []) as any[];
    setRecentEvents(events);

    // Derive health from last 10 events
    const last10 = (recentDelivered.data || []) as any[];
    if (last10.length === 0) {
      setHealth("inactive");
    } else {
      const deliveredCount = last10.filter((e: any) => e.status === "delivered").length;
      const failedCount = last10.filter((e: any) => ["failed", "dlq"].includes(e.status)).length;
      if (deliveredCount > 0 && failedCount === 0) setHealth("active");
      else if (deliveredCount > 0) setHealth("degraded");
      else setHealth("inactive");
    }

    // Count failures in last 24h
    const since24h = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase.from("openclaw_event_queue" as any)
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "dlq"])
      .gte("created_at", since24h) as any;
    setFailures24h(count || 0);

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    const result = await triggerSync();
    if (result.success) toast.success(result.message || `${result.processed} eventos processados`);
    else toast.error(result.message || "Falha no sync");
    await loadData();
    setSyncing(false);
  };

  const handleFlushDLQ = async () => {
    const ok = await flushDLQ();
    if (ok) toast.success("DLQ reprocessada");
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

  const handleRetry = async (eventId: string) => {
    const ok = await retryEvent(eventId);
    if (ok) toast.success("Evento reenfileirado");
    else toast.error("Erro ao reenviar");
    await loadData();
  };

  const healthConfig: Record<HealthStatus, { label: string; color: string; icon: typeof Activity }> = {
    active: { label: "Sincronização Ativa", color: "text-green-600", icon: CheckCircle2 },
    degraded: { label: "Sincronização Degradada", color: "text-yellow-600", icon: AlertTriangle },
    inactive: { label: "Sincronização Inativa", color: "text-muted-foreground", icon: XCircle },
  };

  const hc = healthConfig[health];
  const StatusIcon = hc.icon;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      delivered: "bg-green-500/10 text-green-600 border-green-500/20",
      failed: "bg-red-500/10 text-red-600 border-red-500/20",
      dlq: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* Health Indicators */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5" /> Sync 2.0 — OpenClaw
          </CardTitle>
          <CardDescription>Arquitetura event-driven com fila assíncrona e backoff exponencial.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${hc.color}`} />
              <span className={`text-sm font-medium ${hc.color}`}>{hc.label}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Inbox className="w-4 h-4 text-yellow-600" />
              <span className="font-semibold">{stats.pending || 0}</span>
              <span className="text-muted-foreground">na fila</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-semibold">{failures24h}</span>
              <span className="text-muted-foreground">falhas (24h)</span>
            </div>
          </div>

          {/* Stats grid */}
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
              <ArrowUpCircle className="w-3 h-3" /> Evento Teste
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

      {/* Audit Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" /> Log de Auditoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento na fila.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Evento</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Tentativas</TableHead>
                    <TableHead className="text-xs">Erro</TableHead>
                    <TableHead className="text-xs">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((e: any) => (
                    <TableRow key={e.id} className="text-xs">
                      <TableCell className="whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-mono">{e.event_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${statusBadge(e.status)}`}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{e.attempts || 0}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={e.last_error || ""}>
                        {e.last_error ? (
                          <span className="text-destructive">{e.last_error.substring(0, 60)}...</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {["failed", "dlq"].includes(e.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => handleRetry(e.id)}
                              title="Reenviar"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                          {e.last_error && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => setErrorModal({ open: true, error: e.last_error, eventType: e.event_type })}
                              title="Ver erro"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Detail Modal */}
      <Dialog open={errorModal.open} onOpenChange={(o) => setErrorModal(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Erro: {errorModal.eventType}</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
            {errorModal.error}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
