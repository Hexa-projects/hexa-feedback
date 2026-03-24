import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Brain, Plug, Cpu, MessageSquare, Shield, Zap, Eye,
  CheckCircle2, XCircle, RefreshCw, Play, Settings2,
  Download, Upload, Calendar, Clock, AlertTriangle, Wifi, WifiOff, ArrowUpCircle, Crown
} from "lucide-react";
import CoCEODashboard from "@/components/CoCEODashboard";
import WebhookOpsDashboard from "@/components/WebhookOpsDashboard";
import OpenClawSyncPanel from "@/components/OpenClawSyncPanel";
import { checkHealth, maskToken, buildWsUrl } from "@/lib/openclaw-client";
import { toast } from "sonner";

interface FocusConfig {
  id: string;
  openclaw_url: string;
  openclaw_api_key: string;
  openclaw_env: string;
  openclaw_ativo: boolean;
  llm_modelo: string;
  llm_api_key: string;
  llm_temperatura: number;
  llm_max_tokens: number;
  llm_limite_custo_mensal: number;
  prompt_identidade: string;
  prompt_objetivo: string;
  prompt_tom_voz: string;
  prompt_restricoes: string;
  memoria_ativa: boolean;
  rag_provedor_embeddings: string;
  rag_fonte: string;
  guardrail_custo_mensal: number;
  guardrail_aprovacao_humana: boolean;
  guardrail_max_mensagens_dia: number;
  updated_at: string;
}

interface Skill {
  id: string;
  nome: string;
  descricao: string;
  status: string;
  versao: string;
}

interface Routine {
  id: string;
  nome: string;
  descricao: string;
  frequencia: string;
  ativo: boolean;
  ultima_execucao: string | null;
}

interface Insight {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: string;
  created_at: string;
}

interface LogEntry {
  id: string;
  tipo: string;
  mensagem: string;
  created_at: string;
}

const LLM_MODELS = [
  "Claude Sonnet 4.6",
  "GPT-5.x",
  "Gemini 2.5 Flash",
  "DeepSeek V3.2",
];

export default function FocusAI() {
  const { user, role } = useAuth();
  const [config, setConfig] = useState<FocusConfig | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!user || (role !== "admin")) return;
    loadAll();
  }, [user, role]);

  const loadAll = async () => {
    setLoading(true);
    const [cfgRes, skillsRes, routinesRes, insightsRes, logsRes] = await Promise.all([
      supabase.from("focus_ai_config").select("*").limit(1).single(),
      supabase.from("focus_ai_skills").select("*").order("nome"),
      supabase.from("focus_ai_routines").select("*").order("nome"),
      supabase.from("focus_ai_insights").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("focus_ai_logs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (cfgRes.data) setConfig(cfgRes.data as any);
    setSkills((skillsRes.data || []) as any);
    setRoutines((routinesRes.data || []) as any);
    setInsights((insightsRes.data || []) as any);
    setLogs((logsRes.data || []) as any);
    setLoading(false);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { id, updated_at, ...rest } = config;
    const { error } = await supabase.from("focus_ai_config").update({ ...rest, updated_by: user!.id }).eq("id", id);
    if (error) toast.error("Erro ao salvar configuração");
    else toast.success("Configuração salva com sucesso!");
    setSaving(false);
  };

  const updateConfig = (field: keyof FocusConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await checkHealth(config?.openclaw_url || "", config?.openclaw_api_key || "");

      if (result.success) {
        toast.success("✅ " + result.message, { description: `Status: ${result.status} — ${JSON.stringify(result.data)}` });
        await supabase.from("focus_ai_logs").insert({
          tipo: "sucesso",
          mensagem: `Teste de conexão OpenClaw: OK (${config?.openclaw_url})`,
        });
      } else {
        const icons: Record<string, string> = {
          url_missing: "📝",
          url_invalid: "🔗",
          auth_error: "🔑",
          timeout: "⏱️",
          dns_error: "🌐",
          connection_refused: "🚫",
          tls_error: "🔒",
          private_network: "🏠",
          network_error: "📡",
          edge_function_error: "⚙️",
        };
        const icon = icons[result.error || ""] || "❌";
        toast.error(`${icon} ${result.message}`, {
          description: result.detail ? `Detalhe: ${result.detail}` : undefined,
          duration: 8000,
        });
        await supabase.from("focus_ai_logs").insert({
          tipo: "erro",
          mensagem: `Teste OpenClaw falhou: ${result.error} — ${result.message}`,
        });
      }
    } catch {
      toast.error("Erro inesperado ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const toggleSkill = async (skill: Skill) => {
    const newStatus = skill.status === "Instalado" ? "Disponível" : "Instalado";
    await supabase.from("focus_ai_skills").update({ status: newStatus }).eq("id", skill.id);
    setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, status: newStatus } : s));
    toast.success(`Skill "${skill.nome}" ${newStatus === "Instalado" ? "ativada" : "desativada"}`);
  };

  const toggleRoutine = async (routine: Routine) => {
    await supabase.from("focus_ai_routines").update({ ativo: !routine.ativo }).eq("id", routine.id);
    setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, ativo: !r.ativo } : r));
  };

  const runRoutine = async (routine: Routine) => {
    toast.info(`Executando "${routine.nome}"...`);
    await supabase.from("focus_ai_routines").update({ ultima_execucao: new Date().toISOString() }).eq("id", routine.id);
    await supabase.from("focus_ai_logs").insert({ tipo: "info", mensagem: `Rotina executada manualmente: ${routine.nome}` });
    toast.success(`"${routine.nome}" executada com sucesso`);
    loadAll();
  };

  const updateInsightStatus = async (id: string, status: string) => {
    await supabase.from("focus_ai_insights").update({ status }).eq("id", id);
    setInsights(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    toast.success("Status atualizado");
  };

  if (role !== "admin") {
    return (
      <HexaLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground text-sm">Esta seção é exclusiva para Administradores e Diretoria.</p>
            </CardContent>
          </Card>
        </div>
      </HexaLayout>
    );
  }

  if (loading || !config) {
    return (
      <HexaLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Carregando configurações do Focus AI...</p>
        </div>
      </HexaLayout>
    );
  }

  const healthCards = [
    { label: "OpenClaw", ok: config.openclaw_ativo, icon: Plug },
    { label: "Skills Ativas", ok: skills.filter(s => s.status === "Instalado").length > 0, icon: Zap, count: skills.filter(s => s.status === "Instalado").length },
    { label: "LLM Ativo", ok: !!config.llm_modelo, icon: Cpu },
    { label: "Memória/RAG", ok: config.memoria_ativa, icon: Brain },
  ];

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" /> Focus AI
            </h1>
            <p className="text-muted-foreground text-sm">Configuração, skills, memória e automações da IA estratégica.</p>
          </div>
          <Button onClick={saveConfig} disabled={saving} className="gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
            Salvar Configurações
          </Button>
        </div>

        {/* Health cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {healthCards.map(h => (
            <Card key={h.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${h.ok ? "bg-hexa-green/10" : "bg-muted"}`}>
                  <h.icon className={`w-5 h-5 ${h.ok ? "text-hexa-green" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{h.label}</p>
                  <div className="flex items-center gap-1">
                    {h.ok ? (
                      <><CheckCircle2 className="w-3 h-3 text-hexa-green" /><span className="text-xs text-hexa-green">{h.count !== undefined ? `${h.count} ativas` : "Conectado"}</span></>
                    ) : (
                      <><XCircle className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">Inativo</span></>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="coceo" className="space-y-4">
          <TabsList className="grid grid-cols-5 lg:grid-cols-10 h-auto">
            <TabsTrigger value="coceo" className="text-xs gap-1"><Crown className="w-3 h-3" />Co-CEO</TabsTrigger>
            <TabsTrigger value="ops" className="text-xs gap-1"><Zap className="w-3 h-3" />Operações</TabsTrigger>
            <TabsTrigger value="openclaw" className="text-xs">OpenClaw</TabsTrigger>
            <TabsTrigger value="sync" className="text-xs">Sync</TabsTrigger>
            <TabsTrigger value="llm" className="text-xs">LLM</TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs">Prompt Base</TabsTrigger>
            <TabsTrigger value="skills" className="text-xs">Skills</TabsTrigger>
            <TabsTrigger value="memory" className="text-xs">Memória</TabsTrigger>
            <TabsTrigger value="guardrails" className="text-xs">Guardrails</TabsTrigger>
            <TabsTrigger value="autonomy" className="text-xs">Autonomia</TabsTrigger>
          </TabsList>

          {/* Co-CEO Dashboard */}
          <TabsContent value="coceo">
            <CoCEODashboard />
          </TabsContent>

          {/* OpenClaw */}
          <TabsContent value="openclaw">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Plug className="w-5 h-5" /> Integração OpenClaw (VPS)</CardTitle>
                <CardDescription>Conecte-se ao servidor OpenClaw para habilitar automações e skills.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>URL da API</Label>
                    <Input placeholder="https://openclaw.seuservidor.com" value={config.openclaw_url} onChange={e => updateConfig("openclaw_url", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key / Token</Label>
                    <Input type="password" placeholder="oc_..." value={config.openclaw_api_key} onChange={e => updateConfig("openclaw_api_key", e.target.value)} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ambiente</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={config.openclaw_env} onChange={e => updateConfig("openclaw_env", e.target.value)}>
                      <option value="prod">Produção</option>
                      <option value="dev">Desenvolvimento</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-3">
                    <Button onClick={testConnection} disabled={testing} variant="outline" className="gap-2">
                      {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                      Testar Conexão
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch checked={config.openclaw_ativo} onCheckedChange={v => updateConfig("openclaw_ativo", v)} />
                  <Label>Ativar Focus AI</Label>
                </div>

                {/* Connection log */}
                <div className="pt-4">
                  <p className="text-sm font-medium mb-2">Últimos eventos de conexão</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {logs.filter(l => l.mensagem.includes("OpenClaw") || l.mensagem.includes("conexão")).slice(0, 5).map(l => (
                      <div key={l.id} className="text-xs flex items-center gap-2 p-2 rounded bg-muted/50">
                        <span className={l.tipo === "erro" ? "text-destructive" : "text-hexa-green"}>●</span>
                        <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                        <span>{l.mensagem}</span>
                      </div>
                    ))}
                    {logs.filter(l => l.mensagem.includes("OpenClaw") || l.mensagem.includes("conexão")).length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync Panel */}
          <TabsContent value="sync">
            <OpenClawSyncPanel />
          </TabsContent>

          {/* LLM */}
          <TabsContent value="llm">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Cpu className="w-5 h-5" /> Configuração do LLM</CardTitle>
                <CardDescription>Escolha o modelo de linguagem e ajuste os parâmetros de geração.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={config.llm_modelo} onChange={e => updateConfig("llm_modelo", e.target.value)}>
                      {LLM_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>API Key do Provedor</Label>
                    <Input type="password" placeholder="sk-..." value={config.llm_api_key} onChange={e => updateConfig("llm_api_key", e.target.value)} />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Temperatura: {config.llm_temperatura}</Label>
                    <Slider min={0} max={2} step={0.1} value={[config.llm_temperatura]} onValueChange={([v]) => updateConfig("llm_temperatura", v)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input type="number" value={config.llm_max_tokens} onChange={e => updateConfig("llm_max_tokens", parseInt(e.target.value) || 4096)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Limite de Custo Mensal (R$)</Label>
                    <Input type="number" value={config.llm_limite_custo_mensal} onChange={e => updateConfig("llm_limite_custo_mensal", parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prompt Base */}
          <TabsContent value="prompt">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Prompt Base / Identidade</CardTitle>
                <CardDescription>Defina a personalidade, objetivo e limites do Focus AI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Prompt Alma / Identidade</Label>
                  <Textarea rows={6} placeholder="Você é o Focus AI, a sócia-CEO digital da Hexamedical..." value={config.prompt_identidade} onChange={e => updateConfig("prompt_identidade", e.target.value)} />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Objetivo Principal</Label>
                    <Textarea rows={3} placeholder="Escalar a operação..." value={config.prompt_objetivo} onChange={e => updateConfig("prompt_objetivo", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tom de Voz</Label>
                    <Textarea rows={3} placeholder="Profissional, direto..." value={config.prompt_tom_voz} onChange={e => updateConfig("prompt_tom_voz", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Restrições Críticas</Label>
                    <Textarea rows={3} placeholder="Nunca compartilhar dados..." value={config.prompt_restricoes} onChange={e => updateConfig("prompt_restricoes", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Skills */}
          <TabsContent value="skills">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Zap className="w-5 h-5" /> Skills (Claw Hub)</CardTitle>
                <CardDescription>Gerencie as skills instaladas e disponíveis para o Focus AI.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {skills.map(skill => (
                    <div key={skill.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${skill.status === "Instalado" ? "bg-hexa-green" : "bg-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-medium">{skill.nome}</p>
                          <p className="text-xs text-muted-foreground">{skill.descricao}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={skill.status === "Instalado" ? "default" : "secondary"} className="text-xs">
                          {skill.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">v{skill.versao}</span>
                        <Button size="sm" variant={skill.status === "Instalado" ? "outline" : "default"} onClick={() => toggleSkill(skill)} className="text-xs h-7">
                          {skill.status === "Instalado" ? "Desativar" : "Instalar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Memory + RAG */}
          <TabsContent value="memory">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Brain className="w-5 h-5" /> Memória + RAG</CardTitle>
                <CardDescription>Configure a memória semântica e sistema de recuperação de informações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={config.memoria_ativa} onCheckedChange={v => updateConfig("memoria_ativa", v)} />
                  <Label>Memória Semântica Ativa</Label>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provedor de Embeddings</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={config.rag_provedor_embeddings} onChange={e => updateConfig("rag_provedor_embeddings", e.target.value)}>
                      <option value="Google Gemini">Google Gemini</option>
                      <option value="OpenAI">OpenAI</option>
                      <option value="Cohere">Cohere</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fonte da Base</Label>
                    <Input value={config.rag_fonte} onChange={e => updateConfig("rag_fonte", e.target.value)} />
                  </div>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => toast.info("Reindexação iniciada...")}>
                  <RefreshCw className="w-4 h-4" /> Reindexar Base
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guardrails */}
          <TabsContent value="guardrails">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Shield className="w-5 h-5" /> Guardrails (Segurança)</CardTitle>
                <CardDescription>Defina limites de custo, aprovação humana e controle de automações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Limite de Custo Mensal (R$)</Label>
                    <Input type="number" value={config.guardrail_custo_mensal} onChange={e => updateConfig("guardrail_custo_mensal", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. Mensagens/Dia</Label>
                    <Input type="number" value={config.guardrail_max_mensagens_dia} onChange={e => updateConfig("guardrail_max_mensagens_dia", parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={config.guardrail_aprovacao_humana} onCheckedChange={v => updateConfig("guardrail_aprovacao_humana", v)} />
                  <Label>Aprovação humana para ações críticas</Label>
                </div>

                {/* Decision logs */}
                <div className="pt-4">
                  <p className="text-sm font-medium mb-2">Logs de Decisões da IA</p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {logs.slice(0, 10).map(l => (
                      <div key={l.id} className="text-xs flex items-center gap-2 p-2 rounded bg-muted/50">
                        <span className={l.tipo === "erro" ? "text-destructive" : l.tipo === "sucesso" ? "text-hexa-green" : "text-primary"}>●</span>
                        <span className="text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                        <span className="truncate">{l.mensagem}</span>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum log registrado.</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Autonomy */}
          <TabsContent value="autonomy">
            <div className="space-y-4">
              {/* Routines */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5" /> Rotinas Automáticas</CardTitle>
                  <CardDescription>Agende ações recorrentes do Focus AI.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {routines.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Switch checked={r.ativo} onCheckedChange={() => toggleRoutine(r)} />
                          <div>
                            <p className="text-sm font-medium">{r.nome}</p>
                            <p className="text-xs text-muted-foreground">{r.descricao}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">{r.frequencia}</Badge>
                          {r.ultima_execucao && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(r.ultima_execucao).toLocaleString("pt-BR")}
                            </span>
                          )}
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => runRoutine(r)}>
                            <Play className="w-3 h-3" /> Rodar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Insights / Outputs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Eye className="w-5 h-5" /> Insights & Ações Sugeridas</CardTitle>
                  <CardDescription>Últimos outputs gerados pelo Focus AI.</CardDescription>
                </CardHeader>
                <CardContent>
                  {insights.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhum insight gerado ainda. Execute uma rotina para começar.</p>
                  ) : (
                    <div className="space-y-3">
                      {insights.map(i => (
                        <div key={i.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={i.prioridade === "Alta" ? "destructive" : i.prioridade === "Média" ? "default" : "secondary"} className="text-xs">
                                {i.prioridade}
                              </Badge>
                              <span className="text-sm font-medium">{i.titulo}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{i.descricao}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge variant="outline" className="text-xs">{i.status}</Badge>
                            {i.status === "pendente" && (
                              <>
                                <Button size="sm" variant="default" className="text-xs h-7" onClick={() => updateInsightStatus(i.id, "aprovada")}>Aprovar</Button>
                                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => updateInsightStatus(i.id, "rejeitada")}>Rejeitar</Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
