import { useEffect, useState, useCallback } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Shield, RefreshCw, Eye, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: "Na Fila", color: "bg-yellow-500/10 text-yellow-600", icon: Clock },
  running: { label: "Executando", color: "bg-blue-500/10 text-blue-600", icon: RefreshCw },
  success: { label: "Sucesso", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  failed: { label: "Falha", color: "bg-red-500/10 text-red-600", icon: XCircle },
  needs_review: { label: "Revisão", color: "bg-amber-500/10 text-amber-600", icon: AlertTriangle },
};

export default function OpenClawAgentAudit() {
  const [runs, setRuns] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<any>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("agent_runs")
      .select("*, operational_events(type, entity_type, entity_id)")
      .order("started_at", { ascending: false })
      .limit(50);
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setRuns((data || []) as any[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  return (
    <HexaLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> Auditoria do Agente
            </h1>
            <p className="text-sm text-muted-foreground">Histórico completo de execuções do OpenClaw Agent.</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="queued">Na Fila</SelectItem>
                <SelectItem value="running">Executando</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
                <SelectItem value="needs_review">Revisão</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadRuns} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma execução registrada.</TableCell></TableRow>
                )}
                {runs.map((r: any) => {
                  const st = STATUS_MAP[r.status] || STATUS_MAP.queued;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.operational_events?.type || "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.summary || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.started_at ? new Date(r.started_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.finished_at ? new Date(r.finished_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedRun(r)}>
                              <Eye className="w-3 h-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Detalhes da Execução</DialogTitle>
                            </DialogHeader>
                            {selectedRun && (
                              <div className="space-y-4 text-sm">
                                <div>
                                  <p className="font-medium text-muted-foreground">Request ID</p>
                                  <p className="font-mono text-xs">{selectedRun.openclaw_request_id}</p>
                                </div>
                                <div>
                                  <p className="font-medium text-muted-foreground">Resumo</p>
                                  <p>{selectedRun.summary || "Sem resumo"}</p>
                                </div>
                                <div>
                                  <p className="font-medium text-muted-foreground">Ações ({(selectedRun.actions || []).length})</p>
                                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(selectedRun.actions, null, 2)}
                                  </pre>
                                </div>
                                {(selectedRun.errors || []).length > 0 && (
                                  <div>
                                    <p className="font-medium text-destructive">Erros</p>
                                    <pre className="bg-destructive/10 p-2 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(selectedRun.errors, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
