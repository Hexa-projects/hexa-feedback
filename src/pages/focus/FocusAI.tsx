import { useEffect, useMemo, useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Bot, BrainCircuit, RefreshCw, Send, ServerCog, ShieldCheck } from "lucide-react";

type FocusJob = {
  id: string;
  title: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  scope: string;
  user_message?: string | null;
  output_text?: string | null;
  result?: any;
  error?: string | null;
  vps_run_id?: string | null;
  created_at: string;
  updated_at?: string;
};

const statusLabels: Record<FocusJob["status"], string> = {
  pending: "Pendente",
  running: "Processando",
  completed: "Concluido",
  failed: "Falhou",
  cancelled: "Cancelado",
};

const statusClass: Record<FocusJob["status"], string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-300",
  running: "bg-blue-500/10 text-blue-700 border-blue-300",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  failed: "bg-red-500/10 text-red-700 border-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default function FocusAI() {
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState("general");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<FocusJob[]>([]);

  const activeJob = useMemo(() => jobs[0], [jobs]);

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from("focus_ai_codex_jobs")
      .select("id, title, job_type, status, scope, user_message, output_text, result, error, vps_run_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      toast.error(`Erro ao carregar Focus AI: ${error.message}`);
      return;
    }

    setJobs((data || []) as FocusJob[]);
  };

  useEffect(() => {
    void loadJobs();
    const timer = window.setInterval(() => {
      void loadJobs();
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const dispatchToVps = async (payload: { job_id: string; share_token: string }) => {
    const { error } = await supabase.functions.invoke("focus-vps-codex-dispatch", { body: payload });
    if (error) throw error;
  };

  const createChatJob = async () => {
    if (!message.trim()) {
      toast.info("Digite uma pergunta ou tarefa para o Focus AI.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("focus-codex-bridge", {
        body: {
          action: "create_job",
          job_type: "chat",
          scope,
          title: message.trim().slice(0, 120),
          message: message.trim(),
          context_package: {
            source: "hexaos_frontend",
            requested_at: new Date().toISOString(),
            scope,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await dispatchToVps(data.dispatch_payload);
      setMessage("");
      toast.success("Job enviado para o Codex da VPS.");
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar job para a VPS");
    } finally {
      setLoading(false);
    }
  };

  const syncSystem = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("focus-ai-sync-system", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await dispatchToVps(data.dispatch_payload);
      toast.success("Contexto do HexaOS enviado para assimilacao do Focus AI.");
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar contexto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <HexaLayout>
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold">Focus AI</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Codex da VPS conectado ao HexaOS para suporte operacional, analise e planos de acao.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadJobs()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button onClick={syncSystem} disabled={loading}>
              <ServerCog className="mr-2 h-4 w-4" /> Sincronizar contexto
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-primary" /> Conversar com o Codex da VPS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label>Escopo</Label>
                  <Input value={scope} onChange={(event) => setScope(event.target.value)} placeholder="general, finance, quality..." />
                </div>
                <div className="space-y-2">
                  <Label>Pedido</Label>
                  <Textarea
                    rows={5}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Ex: analise os gargalos do comercial e proponha prioridades para esta semana"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={createChatJob} disabled={loading}>
                  <Send className="mr-2 h-4 w-4" /> Enviar para Focus AI
                </Button>
              </div>

              <Separator />

              {activeJob ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={statusClass[activeJob.status]}>{statusLabels[activeJob.status]}</Badge>
                    <span className="text-sm font-medium">{activeJob.title}</span>
                    {activeJob.vps_run_id && <code className="rounded bg-muted px-2 py-1 text-xs">{activeJob.vps_run_id}</code>}
                  </div>
                  {activeJob.error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{activeJob.error}</div>
                  )}
                  <div className="min-h-[220px] rounded-md border bg-muted/30 p-4 text-sm leading-6 whitespace-pre-wrap">
                    {activeJob.output_text || activeJob.result?.answer || "Aguardando retorno da VPS..."}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum job do Focus AI criado ainda.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Operacao segura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>O navegador cria jobs, mas nao acessa o token da VPS.</p>
                <p>A Edge Function despacha para o worker externo usando secrets do Supabase.</p>
                <p>O Codex devolve resultado por token temporario hashado no banco.</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Ultimos jobs</h2>
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)])}
                      className="w-full rounded-md border p-3 text-left transition hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-medium">{job.title}</span>
                        <Badge variant="outline" className={statusClass[job.status]}>{statusLabels[job.status]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{job.job_type} - {job.scope}</p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </HexaLayout>
  );
}
