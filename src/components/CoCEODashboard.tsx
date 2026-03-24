import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  triggerBusinessSnapshot, triggerCatalogDiscovery,
  triggerExecutiveSummary, triggerDataQuality, triggerSync,
} from "@/lib/openclaw-events";
import {
  RefreshCw, Database, BarChart3, Shield, Brain, Play,
  CheckCircle2, XCircle, AlertTriangle, Zap, Eye, TrendingUp,
  Clock, Layers, Activity, FileSearch
} from "lucide-react";
import { toast } from "sonner";

interface CatalogEntry {
  table_name: string;
  row_count: number;
  column_count: number;
  domain: string;
  quality_score: number;
  updated_at: string;
}

interface AutonomyRule {
  id: string;
  acao: string;
  domain: string;
  nivel: string;
  descricao: string;
  permitido: boolean;
  requer_aprovacao: boolean;
  limite_diario: number;
  ativo: boolean;
}

interface InsightWithPlaybook {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  status: string;
  prioridade: string;
  domain: string;
  causa_provavel: string;
  acao_recomendada: string;
  responsavel_sugerido: string;
  prazo_sugerido: string;
  nivel_autonomia: string;
  created_at: string;
}

const NIVEL_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  A: { label: "Análise", color: "bg-blue-500/10 text-blue-700", desc: "Somente leitura e análise" },
  B: { label: "Sugestão", color: "bg-yellow-500/10 text-yellow-700", desc: "Sugere e aguarda aprovação" },
  C: { label: "Automação", color: "bg-orange-500/10 text-orange-700", desc: "Executa ações não críticas" },
  D: { label: "Crítico", color: "bg-red-500/10 text-red-700", desc: "Ações críticas com aprovação" },
};

const DOMAIN_COLORS: Record<string, string> = {
  sales: "bg-emerald-500/10 text-emerald-700",
  ops: "bg-blue-500/10 text-blue-700",
  finance: "bg-amber-500/10 text-amber-700",
  general: "bg-slate-500/10 text-slate-700",
  support: "bg-purple-500/10 text-purple-700",
};

export default function CoCEODashboard() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [rules, setRules] = useState<AutonomyRule[]>([]);
  const [insights, setInsights] = useState<InsightWithPlaybook[]>([]);
  const [syncMetrics, setSyncMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [catalogRes, rulesRes, insightsRes, metricsRes] = await Promise.all([
      supabase.from("data_catalog" as any).select("*").order("table_name"),
      supabase.from("autonomy_rules" as any).select("*").order("nivel").order("acao"),
      supabase.from("focus_ai_insights").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("openclaw_sync_status" as any).select("*"),
    ]);
    setCatalog((catalogRes.data || []) as any);
    setRules((rulesRes.data || []) as any);
    setInsights((insightsRes.data || []) as any);

    const metricsMap: Record<string, any> = {};
    ((metricsRes.data || []) as any[]).forEach((m: any) => {
      metricsMap[m.metric_name] = m.metric_value;
    });
    setSyncMetrics(metricsMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const runAction = async (key: string, fn: () => Promise<any>, successMsg: string) => {
    setActionLoading(key);
    try {
      const result = await fn();
      if (result?.success !== false) {
        toast.success(successMsg);
      } else {
        toast.error(result?.message || "Falha na operação");
      }
    } catch {
      toast.error("Erro na operação");
    }
    await loadAll();
    setActionLoading(null);
  };

  const toggleRule = async (rule: AutonomyRule) => {
    await supabase.from("autonomy_rules" as any).update({
      ativo: !rule.ativo,
    } as any).eq("id", rule.id);
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, ativo: !r.ativo } : r));
  };

  const toggleRuleApproval = async (rule: AutonomyRule) => {
    await supabase.from("autonomy_rules" as any).update({
      requer_aprovacao: !rule.requer_aprovacao,
    } as any).eq("id", rule.id);
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, requer_aprovacao: !r.requer_aprovacao } : r));
  };

  const updateInsightStatus = async (id: string, status: string) => {
    await supabase.from("focus_ai_insights").update({ status }).eq("id", id);
    setInsights(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    toast.success("Status atualizado");
  };

  const totalRows = catalog.reduce((sum, c) => sum + (c.row_count || 0), 0);
  const connection = syncMetrics.connection;
  const lastSnapshot = syncMetrics.last_snapshot;
  const lastHeartbeat = syncMetrics.last_heartbeat;

  if (loading) {
    return <div className="flex items-center justify-center py-12">
      <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Health */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connection?.status === "connected" ? "bg-green-500/10" : "bg-muted"}`}>
                <Activity className={`w-5 h-5 ${connection?.status === "connected" ? "text-green-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline</p>
                <p className="text-sm font-semibold">{connection?.status === "connected" ? "Online" : "Offline"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tabelas Mapeadas</p>
                <p className="text-sm font-semibold">{catalog.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registros Totais</p>
                <p className="text-sm font-semibold">{totalRows.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último Snapshot</p>
                <p className="text-sm font-semibold">
                  {lastSnapshot?.timestamp
                    ? new Date(lastSnapshot.timestamp).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
                    : "Nunca"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5" /> Ações de Coleta & Análise
          </CardTitle>
          <CardDescription>Dispare coletas manuais de dados para o OpenClaw.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1"
              disabled={actionLoading === "catalog"}
              onClick={() => runAction("catalog", triggerCatalogDiscovery, "Catálogo de dados atualizado!")}
            >
              {actionLoading === "catalog" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
              Descobrir Catálogo
            </Button>
            <Button
              size="sm"
              className="gap-1"
              disabled={actionLoading === "snapshot"}
              onClick={() => runAction("snapshot", triggerBusinessSnapshot, "Snapshot de negócio gerado!")}
            >
              {actionLoading === "snapshot" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
              Snapshot de Negócio
            </Button>
            <Button
              size="sm"
              className="gap-1"
              disabled={actionLoading === "summary"}
              onClick={() => runAction("summary", triggerExecutiveSummary, "Resumo executivo gerado!")}
            >
              {actionLoading === "summary" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              Resumo Executivo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={actionLoading === "quality"}
              onClick={() => runAction("quality", triggerDataQuality, "Qualidade de dados verificada!")}
            >
              {actionLoading === "quality" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileSearch className="w-3 h-3" />}
              Qualidade dos Dados
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={actionLoading === "sync"}
              onClick={() => runAction("sync", triggerSync, "Fila processada com sucesso!")}
            >
              {actionLoading === "sync" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Processar Fila
            </Button>
            <Button size="sm" variant="ghost" className="gap-1" onClick={loadAll} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Catalog */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5" /> Catálogo de Dados
          </CardTitle>
          <CardDescription>Estrutura mapeada automaticamente do banco de dados.</CardDescription>
        </CardHeader>
        <CardContent>
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma tabela mapeada. Clique em "Descobrir Catálogo" acima.
            </p>
          ) : (
            <div className="space-y-1">
              {catalog.map((c) => (
                <div key={c.table_name} className="flex items-center gap-3 p-2.5 rounded-lg border text-sm">
                  <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-mono font-medium min-w-[140px]">{c.table_name}</span>
                  <Badge variant="outline" className={`text-[10px] ${DOMAIN_COLORS[c.domain] || DOMAIN_COLORS.general}`}>
                    {c.domain}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{c.column_count} cols</span>
                  <span className="text-muted-foreground text-xs">{(c.row_count || 0).toLocaleString()} rows</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {c.updated_at ? new Date(c.updated_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Autonomy Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" /> Matriz de Autonomia
          </CardTitle>
          <CardDescription>Controle granular de permissões do Focus AI por tipo de ação.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {Object.entries(NIVEL_LABELS).map(([key, val]) => (
              <div key={key} className={`p-3 rounded-lg border ${val.color}`}>
                <p className="text-xs font-semibold">Nível {key}: {val.label}</p>
                <p className="text-[10px] mt-0.5 opacity-80">{val.desc}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Switch checked={rule.ativo} onCheckedChange={() => toggleRule(rule)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{rule.acao.replace(/_/g, " ")}</span>
                    <Badge variant="outline" className={`text-[10px] ${NIVEL_LABELS[rule.nivel]?.color || ""}`}>
                      {rule.nivel}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${DOMAIN_COLORS[rule.domain] || DOMAIN_COLORS.general}`}>
                      {rule.domain}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{rule.descricao}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={rule.requer_aprovacao}
                      onCheckedChange={() => toggleRuleApproval(rule)}
                      className="scale-75"
                    />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Aprovação</span>
                  </div>
                  {rule.ativo ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights with Playbooks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="w-5 h-5" /> Insights & Playbooks
          </CardTitle>
          <CardDescription>Recomendações acionáveis com causa, impacto e ação sugerida.</CardDescription>
        </CardHeader>
        <CardContent>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum insight gerado. Execute um Resumo Executivo para começar.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.map((i) => (
                <div key={i.id} className="p-4 rounded-lg border space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={i.prioridade === "Alta" ? "destructive" : i.prioridade === "Média" ? "default" : "secondary"} className="text-xs">
                      {i.prioridade}
                    </Badge>
                    {i.domain && (
                      <Badge variant="outline" className={`text-[10px] ${DOMAIN_COLORS[i.domain] || DOMAIN_COLORS.general}`}>
                        {i.domain}
                      </Badge>
                    )}
                    {i.nivel_autonomia && (
                      <Badge variant="outline" className={`text-[10px] ${NIVEL_LABELS[i.nivel_autonomia]?.color || ""}`}>
                        Nível {i.nivel_autonomia}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{i.status}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(i.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{i.titulo}</p>
                  <p className="text-xs text-muted-foreground">{i.descricao}</p>
                  {(i.causa_provavel || i.acao_recomendada) && (
                    <div className="grid md:grid-cols-2 gap-2 pt-1">
                      {i.causa_provavel && (
                        <div className="text-xs p-2 bg-muted/50 rounded">
                          <span className="font-medium">Causa:</span> {i.causa_provavel}
                        </div>
                      )}
                      {i.acao_recomendada && (
                        <div className="text-xs p-2 bg-muted/50 rounded">
                          <span className="font-medium">Ação:</span> {i.acao_recomendada}
                        </div>
                      )}
                      {i.responsavel_sugerido && (
                        <div className="text-xs p-2 bg-muted/50 rounded">
                          <span className="font-medium">Responsável:</span> {i.responsavel_sugerido}
                        </div>
                      )}
                      {i.prazo_sugerido && (
                        <div className="text-xs p-2 bg-muted/50 rounded">
                          <span className="font-medium">Prazo:</span> {i.prazo_sugerido}
                        </div>
                      )}
                    </div>
                  )}
                  {i.status === "pendente" && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="text-xs h-7" onClick={() => updateInsightStatus(i.id, "aprovada")}>Aprovar</Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => updateInsightStatus(i.id, "rejeitada")}>Rejeitar</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
