import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, PlugZap, DownloadCloud, Webhook, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Integ = {
  status: "disconnected" | "pending" | "connected" | "error";
  last_full_sync_at: string | null;
  last_delta_sync_at: string | null;
  last_error: string | null;
};
type Counts = Record<string, number>;
type Job = { id: string; type: string; status: string; started_at: string; finished_at: string | null; stats: any; error: string | null };
type LogRow = { id: string; entity: string | null; level: string; message: string; created_at: string; context: any };

export default function RdStationIntegration() {
  const [integ, setInteg] = useState<Integ | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [errors, setErrors] = useState<LogRow[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  async function load() {
    const [i, c, j, l] = await Promise.all([
      supabase.from("crm_integrations").select("status,last_full_sync_at,last_delta_sync_at,last_error").eq("provider", "rd_station").maybeSingle(),
      supabase.from("rd_sync_counts").select("*").maybeSingle(),
      supabase.from("rd_sync_jobs").select("id,type,status,started_at,finished_at,stats,error").order("started_at", { ascending: false }).limit(10),
      supabase.from("rd_sync_logs").select("id,entity,level,message,created_at,context").eq("level", "error").order("created_at", { ascending: false }).limit(20),
    ]);
    setInteg(i.data as Integ | null);
    setCounts((c.data as Counts | null) ?? null);
    setJobs((j.data as Job[]) ?? []);
    setErrors((l.data as LogRow[]) ?? []);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (params.get("connected") === "1") {
      toast.success("RD Station conectado!");
      setParams({}, { replace: true });
    } else if (params.get("connected") === "0") {
      toast.error("Falha na conexão com RD Station: " + (params.get("error") ?? "erro desconhecido"));
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  async function connect() {
    setBusy("connect");
    try {
      const { data, error } = await supabase.functions.invoke("rd-oauth-start");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error("Erro ao iniciar OAuth: " + (err.message ?? String(err)));
    } finally { setBusy(null); }
  }

  async function trigger(fn: "rd-sync-full" | "rd-sync-delta") {
    setBusy(fn);
    try {
      const { error } = await supabase.functions.invoke(fn);
      if (error) throw error;
      toast.success(fn === "rd-sync-full" ? "Sincronização completa iniciada" : "Sincronização delta iniciada");
      setTimeout(load, 1500);
    } catch (err: any) {
      toast.error("Falha: " + (err.message ?? String(err)));
    } finally { setBusy(null); }
  }

  async function registerWebhooks() {
    setBusy("webhooks");
    try {
      const { data, error } = await supabase.functions.invoke("rd-create-webhooks", { method: "POST" });
      if (error) throw error;
      toast.success("Webhooks processados");
      setWebhooks(data?.results ?? []);
    } catch (err: any) {
      toast.error("Falha ao registrar webhooks: " + (err.message ?? String(err)));
    } finally { setBusy(null); }
  }

  async function listWebhooks() {
    try {
      const { data, error } = await supabase.functions.invoke("rd-create-webhooks", { method: "GET" as any });
      if (error) throw error;
      setWebhooks(data?.existing ?? []);
    } catch (err: any) {
      toast.error("Falha ao listar webhooks: " + (err.message ?? String(err)));
    }
  }

  const connected = integ?.status === "connected";
  const lastSync = integ?.last_delta_sync_at ?? integ?.last_full_sync_at ?? null;

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PlugZap className="w-6 h-6 text-primary" /> Integração RD Station CRM
            </h1>
            <p className="text-sm text-muted-foreground">Sincronize funis, contatos, empresas, negociações e tarefas do RD Station.</p>
          </div>
          <Badge variant={connected ? "default" : "outline"} className="gap-1.5">
            {connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {integ?.status ?? "carregando..."}
          </Badge>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Conexão</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={connect} disabled={busy === "connect"} variant={connected ? "outline" : "default"}>
                <PlugZap className="w-4 h-4 mr-1.5" /> {connected ? "Reconectar" : "Conectar RD Station"}
              </Button>
              <Button onClick={() => trigger("rd-sync-full")} disabled={!connected || !!busy} variant="outline">
                <DownloadCloud className="w-4 h-4 mr-1.5" /> Sincronização completa
              </Button>
              <Button onClick={() => trigger("rd-sync-delta")} disabled={!connected || !!busy} variant="outline">
                <RefreshCw className={"w-4 h-4 mr-1.5" + (busy === "rd-sync-delta" ? " animate-spin" : "")} /> Sincronizar alterações
              </Button>
              <Button onClick={registerWebhooks} disabled={!connected || !!busy} variant="outline">
                <Webhook className="w-4 h-4 mr-1.5" /> Registrar webhooks
              </Button>
              <Button onClick={listWebhooks} disabled={!connected} variant="ghost" size="sm">Ver webhooks</Button>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Última sincronização: {lastSync ? formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ptBR }) : "—"}</span>
              {integ?.last_error && <span className="text-destructive">Último erro: {integ.last_error}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Dados sincronizados</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {counts && Object.entries(counts).map(([k, v]) => (
                <div key={k} className="border rounded-md p-3 bg-card">
                  <div className="text-2xl font-semibold">{v ?? 0}</div>
                  <div className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                </div>
              ))}
              {!counts && <p className="text-sm text-muted-foreground">Nenhum dado ainda.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Últimos jobs</CardTitle></CardHeader>
          <CardContent>
            {jobs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum job ainda.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tipo</TableHead><TableHead>Status</TableHead>
                  <TableHead>Início</TableHead><TableHead>Fim</TableHead>
                  <TableHead>Registros</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {jobs.map(j => {
                    const total = j.stats && typeof j.stats === "object"
                      ? Object.entries(j.stats).filter(([k]) => k !== "since").reduce((a, [, v]) => a + (typeof v === "number" ? v : 0), 0)
                      : 0;
                    return (
                      <TableRow key={j.id}>
                        <TableCell className="font-mono text-xs">{j.type}</TableCell>
                        <TableCell><Badge variant={j.status === "success" ? "default" : j.status === "error" ? "destructive" : "outline"}>{j.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(j.started_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{j.finished_at ? new Date(j.finished_at).toLocaleString("pt-BR") : "…"}</TableCell>
                        <TableCell>{total}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {errors.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Erros recentes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {errors.map(e => (
                  <div key={e.id} className="text-xs border-l-2 border-destructive pl-3 py-1">
                    <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")} • {e.entity ?? "-"}</div>
                    <div className="text-destructive">{e.message}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {webhooks.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Webhooks</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-80">{JSON.stringify(webhooks, null, 2)}</pre>
            </CardContent>
          </Card>
        )}
      </div>
    </HexaLayout>
  );
}
