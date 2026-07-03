import { useEffect, useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, PlugZap, DownloadCloud, AlertTriangle, CheckCircle2, Clock, KeyRound, Save, Eye, EyeOff } from "lucide-react";
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

async function getFunctionErrorMessage(err: any) {
  const fallback = err?.message ?? String(err);
  const context = err?.context;
  if (!context || typeof context.clone !== "function") return fallback;
  try {
    const body = await context.clone().json();
    return body?.detail || body?.error || body?.message || fallback;
  } catch (_) {
    try {
      const text = await context.clone().text();
      return text || fallback;
    } catch (_) {
      return fallback;
    }
  }
}

export default function RdStationIntegration() {
  const [integ, setInteg] = useState<Integ | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [errors, setErrors] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [privateToken, setPrivateToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [showToken, setShowToken] = useState(false);

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

  async function loadCreds() {
    try {
      const { data, error } = await supabase.functions.invoke("rd-save-credentials", { method: "GET" as any });
      if (error) throw error;
      setHasToken(!!data?.has_private_token);
    } catch (_) { /* silencioso */ }
  }

  async function saveToken() {
    if (!privateToken.trim()) {
      toast.error("Cole o Private Token antes de salvar");
      return;
    }
    setBusy("save-token");
    try {
      const { data, error } = await supabase.functions.invoke("rd-save-credentials", {
        method: "POST",
        body: { private_token: privateToken.trim() },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.detail || data?.error || "Token inválido");
      toast.success("Private Token salvo e validado com sucesso");
      setPrivateToken("");
      await Promise.all([loadCreds(), load()]);
    } catch (err: any) {
      toast.error("Falha ao salvar: " + await getFunctionErrorMessage(err));
    } finally { setBusy(null); }
  }

  useEffect(() => {
    load();
    loadCreds();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function trigger(fn: "rd-sync-full" | "rd-sync-delta") {
    setBusy(fn);
    try {
      const { error } = await supabase.functions.invoke(fn);
      if (error) throw error;
      toast.success(fn === "rd-sync-full" ? "Sincronização completa iniciada" : "Sincronização delta iniciada");
      setTimeout(load, 1500);
    } catch (err: any) {
      toast.error("Falha: " + await getFunctionErrorMessage(err));
    } finally { setBusy(null); }
  }

  const connected = integ?.status === "connected";
  const canSync = connected || hasToken;
  const lastSync = integ?.last_delta_sync_at ?? integ?.last_full_sync_at ?? null;

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PlugZap className="w-6 h-6 text-primary" /> Integração RD Station CRM
            </h1>
            <p className="text-sm text-muted-foreground">Autenticação via <strong>Private Token</strong> (Token de Instância) do RD Station CRM.</p>
          </div>
          <Badge variant={connected ? "default" : "outline"} className="gap-1.5">
            {connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {integ?.status ?? "carregando..."}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" /> Private Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Gere o token em <strong>RD Station CRM → Configurações → Integrações → API do RD Station CRM</strong> e cole aqui.
              O valor é criptografado no banco e nunca é devolvido para o navegador.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="rd-private-token">
                Private Token {hasToken && <span className="text-emerald-600 text-xs">• salvo</span>}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="rd-private-token"
                  type={showToken ? "text" : "password"}
                  autoComplete="new-password"
                  value={privateToken}
                  onChange={(e) => setPrivateToken(e.target.value)}
                  placeholder={hasToken ? "••••••••  (deixe em branco para manter o atual)" : "cole seu Private Token"}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowToken((s) => !s)}>
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveToken} disabled={busy === "save-token" || !privateToken.trim()}>
                <Save className="w-4 h-4 mr-1.5" /> Salvar e validar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Sincronização</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => trigger("rd-sync-full")} disabled={!canSync || !!busy}>
                <DownloadCloud className="w-4 h-4 mr-1.5" /> Sincronização completa
              </Button>
              <Button onClick={() => trigger("rd-sync-delta")} disabled={!canSync || !!busy} variant="outline">
                <RefreshCw className={"w-4 h-4 mr-1.5" + (busy === "rd-sync-delta" ? " animate-spin" : "")} /> Sincronizar alterações
              </Button>
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
      </div>
    </HexaLayout>
  );
}
