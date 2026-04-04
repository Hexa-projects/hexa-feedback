import { useEffect, useState, useCallback } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  Terminal, Play, RefreshCw, Plus, CheckCircle2, XCircle,
  Clock, Inbox, Zap
} from "lucide-react";
import { toast } from "sonner";

export default function OpenClawOpsConsole() {
  const [events, setEvents] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [evRes, aqRes] = await Promise.all([
      supabase.from("operational_events").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("action_queue").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setEvents((evRes.data || []) as any[]);
    setActions((aqRes.data || []) as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTrigger = async (eventId: string) => {
    setTriggering(eventId);
    const { data, error } = await supabase.functions.invoke("trigger-openclaw", {
      body: { event_id: eventId },
    });
    if (error) toast.error(`Erro: ${error.message}`);
    else if (data?.deduplicated) toast.info("Execução já existente (idempotente)");
    else toast.success("Agente disparado com sucesso");
    await loadData();
    setTriggering(null);
  };

  const handleCreateTestEvent = async () => {
    const { error } = await supabase.from("operational_events").insert({
      type: "sla_breach",
      entity_type: "ticket",
      entity_id: `TICKET-${Date.now()}`,
      payload: {
        description: "SLA de atendimento excedido",
        severity: "high",
        customer: "Cliente Teste",
        elapsed_hours: 48,
      },
      source: "ui_test",
      status: "new",
    });
    if (error) toast.error("Erro ao criar evento");
    else toast.success("Evento de teste criado");
    await loadData();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      new: "bg-blue-500/10 text-blue-600",
      queued: "bg-yellow-500/10 text-yellow-600",
      processed: "bg-green-500/10 text-green-600",
      failed: "bg-red-500/10 text-red-600",
      pending: "bg-yellow-500/10 text-yellow-600",
      approved: "bg-green-500/10 text-green-600",
      rejected: "bg-red-500/10 text-red-600",
      executed: "bg-green-500/10 text-green-600",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  return (
    <HexaLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Terminal className="w-6 h-6 text-primary" /> Console Operacional
            </h1>
            <p className="text-sm text-muted-foreground">Eventos, ações e controle do agente OpenClaw.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateTestEvent} variant="outline" size="sm" className="gap-1">
              <Plus className="w-3 h-3" /> Evento de Teste
            </Button>
            <Button onClick={loadData} variant="ghost" size="sm" disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="events">
          <TabsList>
            <TabsTrigger value="events" className="gap-1"><Inbox className="w-3 h-3" /> Eventos ({events.length})</TabsTrigger>
            <TabsTrigger value="actions" className="gap-1"><Zap className="w-3 h-3" /> Fila de Ações ({actions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum evento registrado.</TableCell></TableRow>
                    )}
                    {events.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${statusBadge(e.status)}`}>{e.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{e.type}</TableCell>
                        <TableCell className="text-xs">{e.entity_type}/{e.entity_id || "—"}</TableCell>
                        <TableCell className="text-xs">{e.source}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            disabled={triggering === e.id || e.status === "processed"}
                            onClick={() => handleTrigger(e.id)}>
                            {triggering === e.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Executar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Revisão</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma ação na fila.</TableCell></TableRow>
                    )}
                    {actions.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${statusBadge(a.status)}`}>{a.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{a.action_type}</TableCell>
                        <TableCell>
                          {a.requires_review ? <Badge variant="secondary" className="text-[10px]">Requer revisão</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {a.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={async () => {
                                  await supabase.from("action_queue").update({ status: "approved" }).eq("id", a.id);
                                  toast.success("Aprovada"); loadData();
                                }}><CheckCircle2 className="w-3 h-3" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                                onClick={async () => {
                                  await supabase.from("action_queue").update({ status: "rejected" }).eq("id", a.id);
                                  toast.info("Rejeitada"); loadData();
                                }}><XCircle className="w-3 h-3" /></Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Curl examples */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Exemplos de Teste (curl)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">trigger-openclaw</p>
              <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
{`curl -X POST '${window.location.origin.includes('localhost') ? 'https://fevmcjnaeuxydmxmkarw.supabase.co' : 'https://fevmcjnaeuxydmxmkarw.supabase.co'}/functions/v1/trigger-openclaw' \\
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{"event_id": "EVENT_UUID_HERE"}'`}
              </pre>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">ingest-openclaw (callback do OpenClaw)</p>
              <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
{`curl -X POST 'https://fevmcjnaeuxydmxmkarw.supabase.co/functions/v1/ingest-openclaw' \\
  -H 'Authorization: Bearer OPENCLAW_INGEST_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{"event_id":"...","openclaw_request_id":"...","status":"success","summary":"Ticket resolvido","actions":[{"type":"close_ticket","result":"ok"}],"kpi_updates":[{"kpi_key":"sla_compliance","period_start":"2026-04-04","period_end":"2026-04-04","value":95}]}'`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
