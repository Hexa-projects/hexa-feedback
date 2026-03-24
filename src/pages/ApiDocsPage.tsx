import { useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  BookOpen, Globe, Key, Shield, Zap, Copy, Check,
  ArrowRight, Code2, Database, Search, RefreshCw,
  AlertTriangle, Server, Lock, FileJson, ChevronDown, ChevronRight
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = "https://fevmcjnaeuxydmxmkarw.supabase.co";
const FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost" size="sm"
      className="h-7 w-7 p-0 shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copiado!");
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-card border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed font-mono text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Endpoint({
  method,
  path,
  description,
  auth,
  body,
  response,
  example,
  notes,
}: {
  method: "GET" | "POST";
  path: string;
  description: string;
  auth?: string;
  body?: string;
  response?: string;
  example?: string;
  notes?: string;
}) {
  const [open, setOpen] = useState(false);
  const methodColors = { GET: "bg-green-500/10 text-green-600 border-green-500/20", POST: "bg-blue-500/10 text-blue-600 border-blue-500/20" };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <Badge variant="outline" className={`${methodColors[method]} font-mono text-xs px-2`}>{method}</Badge>
        <code className="text-sm font-mono font-medium text-foreground flex-1">{path}</code>
        <span className="text-xs text-muted-foreground hidden md:block">{description}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-4 bg-muted/10">
          <p className="text-sm text-muted-foreground">{description}</p>

          {auth && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Autenticação</h4>
              <p className="text-sm">{auth}</p>
            </div>
          )}

          {body && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Body (JSON)</h4>
              <CodeBlock code={body} language="json" />
            </div>
          )}

          {response && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Resposta</h4>
              <CodeBlock code={response} language="json" />
            </div>
          )}

          {example && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Exemplo cURL</h4>
              <CodeBlock code={example} />
            </div>
          )}

          {notes && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">{notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════

export default function ApiDocsPage() {
  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Documentação API & Webhooks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Guia completo para integração do OpenClaw e sistemas externos com o HexaOS.
          </p>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center gap-3 min-w-0">
              <Globe className="w-8 h-8 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Base URL</p>
                <div className="flex items-center gap-1 min-w-0">
                  <code className="text-[10px] font-mono font-medium truncate block">{FUNCTION_BASE}</code>
                  <CopyButton text={FUNCTION_BASE} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Autenticação</p>
                <p className="text-sm font-medium">Token via Header</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Server className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Formato</p>
                <p className="text-sm font-medium">JSON (REST)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="data-api" className="space-y-4">
          <TabsList className="grid grid-cols-2 lg:grid-cols-5 h-auto">
            <TabsTrigger value="data-api" className="text-xs gap-1"><Database className="w-3 h-3" />Data API</TabsTrigger>
            <TabsTrigger value="webhooks" className="text-xs gap-1"><Zap className="w-3 h-3" />Webhooks</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs gap-1"><Code2 className="w-3 h-3" />Action API</TabsTrigger>
            <TabsTrigger value="auth" className="text-xs gap-1"><Key className="w-3 h-3" />Autenticação</TabsTrigger>
            <TabsTrigger value="errors" className="text-xs gap-1"><AlertTriangle className="w-3 h-3" />Erros & Limites</TabsTrigger>
          </TabsList>

          {/* ═══ DATA API ═══ */}
          <TabsContent value="data-api" className="space-y-6">
            <SectionTitle
              icon={Database}
              title="OpenClaw Data API"
              subtitle="Permite ao OpenClaw puxar todos os dados da plataforma de forma autônoma e segura."
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">URL Base</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono">{FUNCTION_BASE}/openclaw-data-api</code>
                  <CopyButton text={`${FUNCTION_BASE}/openclaw-data-api`} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Endpoints</h3>

              <Endpoint
                method="POST"
                path="/"
                description="Descobrir endpoints disponíveis"
                auth="X-OpenClaw-Token ou Authorization: Bearer <token>"
                example={`curl -X POST ${FUNCTION_BASE}/openclaw-data-api \\
  -H "Content-Type: application/json" \\
  -H "X-OpenClaw-Token: SEU_TOKEN"`}
                response={`{
  "success": true,
  "source": "hexaos",
  "api": "OpenClaw Data API",
  "version": "1.0",
  "endpoints": { ... },
  "tables_available": ["leads", "work_orders", ...]
}`}
              />

              <Endpoint
                method="POST"
                path="/catalog"
                description="Lista todas as tabelas com colunas, contagens e amostras"
                auth="X-OpenClaw-Token"
                body={`{ "action": "catalog" }`}
                response={`{
  "success": true,
  "tables": [
    {
      "table": "leads",
      "domain": "sales",
      "description": "Pipeline de vendas",
      "row_count": 42,
      "columns": ["id", "nome", "empresa", ...],
      "sample": { "id": "uuid", "nome": "...", ... }
    }
  ]
}`}
                example={`curl -X POST ${FUNCTION_BASE}/openclaw-data-api \\
  -H "Content-Type: application/json" \\
  -H "X-OpenClaw-Token: SEU_TOKEN" \\
  -d '{"action": "catalog"}'`}
                notes="PII é mascarado automaticamente nas amostras (email, telefone, chaves). Toda consulta é auditada em ai_audit_trail."
              />

              <Endpoint
                method="POST"
                path="/table/{nome}"
                description="Puxa dados de uma tabela específica com filtros e paginação"
                auth="X-OpenClaw-Token"
                body={`{
  "action": "pull_table",
  "table": "leads",
  "limit": 100,         // máx: 1000 (padrão: 500)
  "offset": 0,
  "order_by": "created_at",
  "ascending": false,
  "since": "2026-03-01T00:00:00Z",  // opcional
  "filters": {          // opcional
    "status": "Qualificação"
  }
}`}
                response={`{
  "success": true,
  "table": "leads",
  "domain": "sales",
  "total_rows": 42,
  "returned": 42,
  "has_more": false,
  "data": [ { ... }, { ... } ]
}`}
                example={`curl -X POST ${FUNCTION_BASE}/openclaw-data-api \\
  -H "Content-Type: application/json" \\
  -H "X-OpenClaw-Token: SEU_TOKEN" \\
  -d '{"action":"pull_table","table":"leads","limit":50}'`}
              />

              <Endpoint
                method="POST"
                path="/snapshot"
                description="Snapshot completo de KPIs, funil de vendas, riscos e SLA"
                auth="X-OpenClaw-Token"
                body={`{ "action": "snapshot" }`}
                response={`{
  "success": true,
  "source": "hexaos",
  "summary": {
    "total_leads": 42,
    "leads_this_month": 8,
    "lead_funnel": { "Qualificação": 15, "Proposta": 10, ... },
    "pipeline_value": 250000,
    "open_work_orders": 12,
    "critical_work_orders": 3,
    ...
  },
  "risks": {
    "stale_leads": [ ... ],
    "sla_at_risk": [ ... ]
  }
}`}
              />

              <Endpoint
                method="POST"
                path="/search"
                description="Busca textual em múltiplas tabelas (iLIKE)"
                auth="X-OpenClaw-Token"
                body={`{
  "action": "search",
  "query": "Hospital São Paulo",
  "tables": ["leads", "work_orders", "proposals"],
  "limit": 10
}`}
                response={`{
  "success": true,
  "query": "Hospital São Paulo",
  "results": {
    "leads": [ { ... } ],
    "work_orders": [ { ... } ]
  }
}`}
              />

              <Endpoint
                method="POST"
                path="/changes"
                description="Sync incremental — mudanças desde uma data (delta)"
                auth="X-OpenClaw-Token"
                body={`{
  "action": "changes",
  "since": "2026-03-23T00:00:00Z",
  "tables": ["leads", "work_orders"]
}`}
                response={`{
  "success": true,
  "since": "2026-03-23T00:00:00Z",
  "changes": {
    "leads": { "count": 3, "data": [ ... ] },
    "work_orders": { "count": 1, "data": [ ... ] }
  }
}`}
                notes="Se 'since' não for informado, retorna mudanças das últimas 24 horas."
              />
            </div>

            {/* Tables Reference */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" /> Tabelas Disponíveis</CardTitle>
                <CardDescription>27 tabelas acessíveis via Data API, organizadas por domínio.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { domain: "Vendas (sales)", tables: ["leads", "lead_interactions", "proposals"] },
                    { domain: "Operações (ops)", tables: ["work_orders", "work_order_activities", "lab_parts", "daily_forms", "bottlenecks", "repetitive_processes", "suggestions", "tool_mappings"] },
                    { domain: "Pessoas (people)", tables: ["profiles"] },
                    { domain: "Comunicação (comms)", tables: ["corporate_channels", "channel_messages"] },
                    { domain: "IA (ai)", tables: ["focus_ai_insights", "focus_ai_logs", "ai_action_requests", "ai_audit_trail", "ai_learning_feedback", "ai_agents", "autonomy_rules"] },
                    { domain: "Meta", tables: ["data_catalog", "openclaw_event_queue", "openclaw_sync_status", "webhook_events", "webhook_sources"] },
                  ].map(group => (
                    <div key={group.domain} className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">{group.domain}</p>
                      <div className="flex flex-wrap gap-1">
                        {group.tables.map(t => (
                          <Badge key={t} variant="outline" className="font-mono text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ WEBHOOKS ═══ */}
          <TabsContent value="webhooks" className="space-y-6">
            <SectionTitle
              icon={Zap}
              title="Webhook Gateway"
              subtitle="Receba eventos em tempo real de módulos internos e sistemas externos."
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">URL Base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono">{FUNCTION_BASE}/webhook-gateway</code>
                  <CopyButton text={`${FUNCTION_BASE}/webhook-gateway`} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Enviar Evento</h3>

              <Endpoint
                method="POST"
                path="/webhook-gateway"
                description="Enviar evento para processamento pelo HexaOS"
                auth="Authorization: Bearer <supabase_anon_key>"
                body={`{
  "eventId": "uuid-único",
  "eventType": "lead.created",
  "source": "crm-externo",
  "occurredAt": "2026-03-24T10:30:00Z",
  "priority": "medium",       // low | medium | high | critical
  "domain": "sales",          // sales | ops | finance | support
  "tags": ["crm", "novo-lead"],
  "actor": {
    "id": "user-123",
    "type": "user"             // user | system | api
  },
  "entity": {
    "type": "lead",
    "id": "lead-456"
  },
  "data": {
    "nome": "João Silva",
    "empresa": "Hospital ABC",
    "valor_estimado": 50000
  }
}`}
                response={`{
  "success": true,
  "eventId": "uuid-único",
  "status": "received"
}`}
                example={`curl -X POST ${FUNCTION_BASE}/webhook-gateway \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <ANON_KEY>" \\
  -d '{
    "eventId": "evt-001",
    "eventType": "os.created",
    "source": "sistema-externo",
    "occurredAt": "2026-03-24T10:30:00Z",
    "priority": "high",
    "domain": "ops",
    "data": { "numero_os": "OS-2024-100", "cliente": "Hospital ABC" }
  }'`}
                notes="Eventos são normalizados, sanitizados (PII) e armazenados na tabela webhook_events. O processamento é assíncrono."
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Modelo Canônico de Evento</CardTitle>
                <CardDescription>Todos os eventos são normalizados para este formato interno.</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock code={`{
  "eventId": "string (uuid)",      // Identificador único do evento
  "eventType": "string",           // Ex: lead.created, os.updated, payment.received
  "source": "string",              // Origem: hexaos-app, crm-externo, erp, etc.
  "occurredAt": "ISO-8601",        // Quando o evento aconteceu
  "receivedAt": "ISO-8601",        // Quando foi recebido pelo gateway
  "priority": "low|medium|high|critical",
  "domain": "sales|ops|finance|support|marketing|general",
  "tags": ["string"],              // Tags para classificação
  "actor": {
    "id": "string",
    "type": "user|system|api"
  },
  "entity": {
    "type": "string",              // lead, work_order, proposal, etc.
    "id": "string"
  },
  "data": { ... },                 // Payload do evento
  "meta": {
    "schemaVersion": "v1",
    "traceId": "string",
    "signatureValid": true
  }
}`} language="json" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tipos de Evento Suportados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {[
                    { domain: "Vendas", events: ["lead.created", "lead.updated", "lead.status_changed", "proposal.created", "proposal.approved", "proposal.rejected"] },
                    { domain: "Operações", events: ["os.created", "os.updated", "os.completed", "os.sla_breach", "lab_part.received", "lab_part.completed"] },
                    { domain: "Financeiro", events: ["payment.received", "invoice.created", "payment.overdue"] },
                    { domain: "Pessoas", events: ["user.registered", "user.onboarding_completed", "daily_form.submitted"] },
                    { domain: "IA", events: ["insight.generated", "action.proposed", "action.approved", "action.executed"] },
                    { domain: "Sistema", events: ["snapshot.business", "catalog.discovery", "summary.executive"] },
                  ].map(group => (
                    <div key={group.domain}>
                      <p className="font-semibold text-muted-foreground text-xs uppercase mb-1">{group.domain}</p>
                      <div className="space-y-0.5">
                        {group.events.map(e => (
                          <div key={e} className="flex items-center gap-2">
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <code className="text-xs font-mono">{e}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ACTION API ═══ */}
          <TabsContent value="actions" className="space-y-6">
            <SectionTitle
              icon={Code2}
              title="Action API (Focus AI)"
              subtitle="Permite ao Focus AI propor e executar ações administrativas com governança."
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">URL Base</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono">{FUNCTION_BASE}/ai-action-api</code>
                  <CopyButton text={`${FUNCTION_BASE}/ai-action-api`} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Endpoint
                method="POST"
                path="/ai-action-api"
                description="Propor uma ação para execução"
                body={`{
  "action": "propose",
  "action_type": "follow_up_lead",
  "domain": "sales",
  "title": "Follow-up com lead Hospital ABC",
  "description": "Lead sem contato há 14 dias",
  "reason": "Lead com alto valor estimado sem interação recente",
  "evidence": {
    "lead_id": "uuid",
    "days_without_contact": 14,
    "estimated_value": 50000
  },
  "estimated_impact": "Recuperar oportunidade de R$ 50k",
  "risk_level": "low"
}`}
                response={`{
  "success": true,
  "action": { "id": "uuid", "status": "pending", ... }
}`}
              />

              <Endpoint
                method="POST"
                path="/ai-action-api"
                description="Aprovar uma ação pendente"
                body={`{
  "action": "approve",
  "actionId": "uuid-da-acao"
}`}
              />

              <Endpoint
                method="POST"
                path="/ai-action-api"
                description="Rejeitar uma ação"
                body={`{
  "action": "reject",
  "actionId": "uuid-da-acao",
  "reason": "Motivo da rejeição"
}`}
              />

              <Endpoint
                method="POST"
                path="/ai-action-api"
                description="Listar ações pendentes"
                body={`{ "action": "list_pending" }`}
                response={`{
  "success": true,
  "actions": [
    { "id": "uuid", "title": "...", "status": "pending", ... }
  ]
}`}
              />

              <Endpoint
                method="POST"
                path="/ai-action-api"
                description="Enviar feedback sobre resultado de uma ação"
                body={`{
  "action": "feedback",
  "actionId": "uuid-da-acao",
  "decision": "accepted",
  "outcome": "Lead respondeu positivamente",
  "score": 8,
  "notes": "Reunião agendada para próxima semana"
}`}
              />

              <Endpoint
                method="POST"
                path="/ai-action-api"
                description="Estatísticas de aprendizado da IA"
                body={`{ "action": "learning_stats" }`}
              />

              <Endpoint
                method="POST"
                path="/ai-action-api"
                description="Estatísticas do pipeline de ações"
                body={`{ "action": "pipeline_stats" }`}
              />
            </div>

            {/* Autonomy Levels */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Níveis de Autonomia</CardTitle>
                <CardDescription>Cada ação é classificada por nível de autonomia e risco.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { level: "Nível 0", name: "Somente Leitura", desc: "Apenas consulta dados e gera insights. Nenhuma ação executada.", color: "bg-muted text-muted-foreground" },
                    { level: "Nível 1", name: "Recomendações", desc: "Propõe ações mas não executa. Requer aprovação humana para tudo.", color: "bg-blue-500/10 text-blue-600" },
                    { level: "Nível 2", name: "Automações Não-Críticas", desc: "Executa ações de baixo risco automaticamente (ex: follow-up, alertas).", color: "bg-amber-500/10 text-amber-600" },
                    { level: "Nível 3", name: "Semiautônomo", desc: "Executa ações de médio risco com limites rígidos. Ações críticas ainda requerem aprovação.", color: "bg-destructive/10 text-destructive" },
                  ].map(l => (
                    <div key={l.level} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Badge variant="outline" className={`${l.color} shrink-0`}>{l.level}</Badge>
                      <div>
                        <p className="text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{l.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ AUTH ═══ */}
          <TabsContent value="auth" className="space-y-6">
            <SectionTitle
              icon={Key}
              title="Autenticação & Segurança"
              subtitle="Como autenticar chamadas à API do HexaOS."
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Métodos de Autenticação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary">Data API</Badge>
                      <span className="text-sm font-medium">Token OpenClaw</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Usado pela Data API para autenticar chamadas do OpenClaw. O token é o mesmo configurado em Focus AI → OpenClaw.
                    </p>
                    <CodeBlock code={`# Via header X-OpenClaw-Token
curl -H "X-OpenClaw-Token: seu-token-aqui" ...

# Ou via Authorization Bearer
curl -H "Authorization: Bearer seu-token-aqui" ...`} />
                  </div>

                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/10 text-green-600">Webhook Gateway</Badge>
                      <span className="text-sm font-medium">Supabase Anon Key</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O Webhook Gateway aceita a chave anon do Supabase para autenticação via API externa.
                    </p>
                    <CodeBlock code={`curl -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \\
     -H "Content-Type: application/json" ...`} />
                  </div>

                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500/10 text-amber-600">Action API</Badge>
                      <span className="text-sm font-medium">JWT do Usuário</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A Action API requer autenticação via JWT do Supabase (sessão do usuário logado). Apenas admins podem gerenciar ações.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4" /> Segurança</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { title: "Mascaramento de PII", desc: "Campos sensíveis (email, telefone, chaves) são mascarados automaticamente antes de retornar ao OpenClaw." },
                    { title: "Auditoria Completa", desc: "Toda consulta à Data API é registrada na tabela ai_audit_trail com tipo, tabela, número de registros e timestamp." },
                    { title: "Tokens Mascarados em Logs", desc: "Tokens nunca são logados por completo. Formato: abc...xyz." },
                    { title: "HTTPS Obrigatório", desc: "Todas as Edge Functions são acessadas via HTTPS por padrão (Supabase)." },
                    { title: "RLS Ativo", desc: "Row-Level Security está ativo em todas as tabelas. A Data API usa service_role para acesso completo (somente para OpenClaw autenticado)." },
                    { title: "Rate Limiting", desc: "Limite de requisições por minuto configurável por fonte no webhook_sources." },
                  ].map(item => (
                    <div key={item.title} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{item.title}:</span>{" "}
                        <span className="text-muted-foreground">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ERRORS ═══ */}
          <TabsContent value="errors" className="space-y-6">
            <SectionTitle
              icon={AlertTriangle}
              title="Códigos de Erro & Limites"
              subtitle="Referência de erros e limites de uso da API."
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Códigos de Erro HTTP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Código</th>
                        <th className="text-left p-3 font-medium">Significado</th>
                        <th className="text-left p-3 font-medium hidden md:table-cell">Ação Recomendada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: "200", meaning: "Sucesso", action: "Processar resposta normalmente" },
                        { code: "400", meaning: "Requisição inválida", action: "Verificar formato do body/parâmetros" },
                        { code: "401", meaning: "Token inválido ou ausente", action: "Verificar header de autenticação" },
                        { code: "403", meaning: "Sem permissão", action: "Verificar role do usuário (admin requerido)" },
                        { code: "404", meaning: "Tabela/endpoint não encontrado", action: "Consultar /catalog para tabelas disponíveis" },
                        { code: "429", meaning: "Rate limit excedido", action: "Aguardar e tentar novamente com backoff" },
                        { code: "500", meaning: "Erro interno", action: "Verificar logs da Edge Function" },
                        { code: "502", meaning: "Timeout na Edge Function", action: "Reduzir volume de dados ou tentar novamente" },
                      ].map(err => (
                        <tr key={err.code} className="border-t">
                          <td className="p-3"><Badge variant="outline" className="font-mono">{err.code}</Badge></td>
                          <td className="p-3">{err.meaning}</td>
                          <td className="p-3 text-muted-foreground hidden md:table-cell">{err.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Formato de Erro</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={`{
  "success": false,
  "error": "auth_failed",         // Código do erro
  "message": "Token inválido."    // Mensagem legível
}`} language="json" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Limites da API</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { limit: "Linhas por consulta", value: "Máximo 1.000 (padrão 500)" },
                    { limit: "Busca textual", value: "Máximo 50 resultados por tabela" },
                    { limit: "Changes (delta)", value: "Máximo 100 registros por tabela" },
                    { limit: "Timeout", value: "Edge Functions: ~25s (Supabase)" },
                    { limit: "Tamanho do payload", value: "6 MB (limite do Supabase)" },
                    { limit: "Rate limit Webhook", value: "Configurável por fonte (padrão: 60/min)" },
                  ].map(item => (
                    <div key={item.limit} className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="font-medium">{item.limit}</span>
                      <Badge variant="outline">{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Retry & Resiliência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  O sistema de fila (<code className="text-xs bg-muted px-1 rounded">openclaw_event_queue</code>) implementa retry automático:
                </p>
                <div className="space-y-2">
                  {[
                    "Retry com backoff exponencial + jitter",
                    "Máximo 5 tentativas por evento",
                    "Dead Letter Queue (DLQ) para falhas definitivas",
                    "Reprocessamento manual da DLQ via UI ou API",
                    "Idempotência via eventId único",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
