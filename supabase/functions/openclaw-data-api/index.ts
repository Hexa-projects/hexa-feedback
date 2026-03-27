import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-openclaw-token",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// All readable tables and their domains
const TABLES: Record<string, { domain: string; description: string }> = {
  leads:                  { domain: "sales",    description: "Pipeline de vendas - leads e oportunidades" },
  lead_interactions:      { domain: "sales",    description: "Interações com leads (notas, ligações, emails)" },
  proposals:              { domain: "sales",    description: "Propostas comerciais e valores" },
  contracts:              { domain: "sales",    description: "Contratos ativos, vencidos e valores" },
  financial_records:      { domain: "finance",  description: "Registros financeiros (receitas e despesas)" },
  lab_parts:              { domain: "ops",      description: "Peças em laboratório/reparo" },
  installed_equipment:    { domain: "ops",      description: "Equipamentos instalados em clientes" },
  daily_forms:            { domain: "ops",      description: "Formulários diários dos colaboradores" },
  bottlenecks:            { domain: "ops",      description: "Gargalos operacionais reportados" },
  repetitive_processes:   { domain: "ops",      description: "Processos repetitivos mapeados" },
  projects:               { domain: "ops",      description: "Projetos em andamento" },
  project_tasks:          { domain: "ops",      description: "Tarefas dos projetos" },
  profiles:               { domain: "people",   description: "Perfis dos colaboradores" },
  corporate_channels:     { domain: "comms",    description: "Canais corporativos de comunicação" },
  channel_messages:       { domain: "comms",    description: "Mensagens dos canais corporativos" },
  channel_tasks:          { domain: "comms",    description: "Tarefas criadas nos canais" },
  meeting_logs:           { domain: "comms",    description: "Histórico de reuniões LiveKit" },
  notifications:          { domain: "comms",    description: "Notificações do sistema" },
  focus_ai_insights:      { domain: "ai",       description: "Insights gerados pela IA" },
  focus_ai_logs:          { domain: "ai",       description: "Logs de execução da IA" },
  ai_action_requests:     { domain: "ai",       description: "Ações propostas/executadas pela IA" },
  ai_audit_trail:         { domain: "ai",       description: "Trilha de auditoria da IA" },
  ai_learning_feedback:   { domain: "ai",       description: "Feedback de aprendizado da IA" },
  ai_agents:              { domain: "ai",       description: "Agentes de IA configurados" },
  autonomy_rules:         { domain: "ai",       description: "Regras de autonomia da IA" },
  data_catalog:           { domain: "meta",     description: "Catálogo de dados do sistema" },
  openclaw_event_queue:   { domain: "meta",     description: "Fila de eventos para OpenClaw" },
  openclaw_sync_status:   { domain: "meta",     description: "Status de sincronização" },
  hex_calendars:          { domain: "calendar",  description: "Calendários dos colaboradores" },
  hex_calendar_events:    { domain: "calendar",  description: "Eventos de calendário" },
};

// PII fields to mask
const PII_FIELDS = ["email", "telefone", "llm_api_key", "openclaw_api_key", "hmac_secret"];

function maskPII(row: Record<string, any>): Record<string, any> {
  const masked = { ...row };
  for (const field of PII_FIELDS) {
    if (masked[field] && typeof masked[field] === "string" && masked[field].length > 4) {
      masked[field] = masked[field].slice(0, 3) + "***" + masked[field].slice(-2);
    }
  }
  return masked;
}

async function authenticateRequest(req: Request, db: any): Promise<{ valid: boolean; error?: string }> {
  // Check X-OpenClaw-Token header
  const token = req.headers.get("x-openclaw-token") || req.headers.get("authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return { valid: false, error: "Token ausente. Envie via header X-OpenClaw-Token ou Authorization: Bearer <token>" };
  }

  // Validate against stored config
  const { data: cfg } = await db.from("focus_ai_config").select("openclaw_api_key, openclaw_ativo").limit(1).single();
  
  if (!cfg || !cfg.openclaw_ativo) {
    return { valid: false, error: "OpenClaw desativado na plataforma." };
  }

  if (!cfg.openclaw_api_key || cfg.openclaw_api_key !== token) {
    return { valid: false, error: "Token inválido." };
  }

  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  // Authenticate
  const auth = await authenticateRequest(req, db);
  if (!auth.valid) {
    return jsonResp({ success: false, error: "auth_failed", message: auth.error }, 401);
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/openclaw-data-api\/?/, "").replace(/^\//, "");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ─── GET /catalog — Full schema catalog ───
    if (path === "catalog" || body.action === "catalog") {
      const catalog = Object.entries(TABLES).map(([table, info]) => ({
        table,
        ...info,
      }));

      // Enrich with row counts
      const enriched = [];
      for (const item of catalog) {
        const { count } = await db.from(item.table).select("*", { count: "exact", head: true });
        const { data: sample } = await db.from(item.table).select("*").limit(1);
        const columns = sample?.[0] ? Object.keys(sample[0]) : [];
        enriched.push({
          ...item,
          row_count: count || 0,
          columns,
          sample: sample?.[0] ? maskPII(sample[0]) : null,
        });
      }

      // Log access
      await db.from("ai_audit_trail").insert({
        event_type: "data_pull",
        action: "catalog",
        actor_type: "openclaw",
        details: { tables_count: enriched.length },
      });

      return jsonResp({ success: true, source: "hexaos", tables: enriched, pulled_at: new Date().toISOString() });
    }

    // ─── POST /table/:name — Pull data from a specific table ───
    if (path.startsWith("table/") || body.action === "pull_table") {
      const tableName = path.replace("table/", "") || body.table;
      
      if (!tableName || !TABLES[tableName]) {
        return jsonResp({ 
          success: false, error: "invalid_table", 
          message: `Tabela '${tableName}' não encontrada. Use /catalog para ver tabelas disponíveis.`,
          available: Object.keys(TABLES),
        }, 400);
      }

      const limit = Math.min(body.limit || 500, 1000);
      const offset = body.offset || 0;
      const orderBy = body.order_by || "created_at";
      const ascending = body.ascending ?? false;
      const since = body.since; // ISO date filter
      const filters = body.filters || {}; // { column: value }

      let query = db.from(tableName).select("*", { count: "exact" });

      // Apply date filter
      if (since) {
        const dateCol = ["created_at", "updated_at"].find(c => true); // default
        query = query.gte(dateCol!, since);
      }

      // Apply custom filters
      for (const [col, val] of Object.entries(filters)) {
        if (typeof val === "string") query = query.eq(col, val);
        if (typeof val === "boolean") query = query.eq(col, val);
        if (typeof val === "number") query = query.eq(col, val);
      }

      const { data, count, error } = await query
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);

      if (error) {
        return jsonResp({ success: false, error: "query_error", message: error.message }, 500);
      }

      const maskedData = (data || []).map(maskPII);

      // Audit
      await db.from("ai_audit_trail").insert({
        event_type: "data_pull",
        action: `pull_table:${tableName}`,
        actor_type: "openclaw",
        details: { table: tableName, rows_returned: maskedData.length, total: count, offset, limit },
      });

      return jsonResp({
        success: true,
        source: "hexaos",
        table: tableName,
        domain: TABLES[tableName].domain,
        total_rows: count || 0,
        returned: maskedData.length,
        offset,
        limit,
        has_more: (count || 0) > offset + limit,
        data: maskedData,
        pulled_at: new Date().toISOString(),
      });
    }

    // ─── POST /snapshot — Full business snapshot ───
    if (path === "snapshot" || body.action === "snapshot") {
      const [
        leadsRes, proposalsRes, osRes, labRes, usersRes, bottleRes, sugRes,
        leadsMonthRes, osCritRes
      ] = await Promise.all([
        db.from("leads").select("*", { count: "exact", head: true }),
        db.from("proposals").select("*", { count: "exact", head: true }),
        db.from("work_orders").select("*", { count: "exact", head: true }),
        db.from("lab_parts").select("*", { count: "exact", head: true }),
        db.from("profiles").select("*", { count: "exact", head: true }),
        db.from("bottlenecks").select("*", { count: "exact", head: true }),
        db.from("suggestions").select("*", { count: "exact", head: true }),
        db.from("leads").select("*", { count: "exact", head: true })
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        db.from("work_orders").select("*", { count: "exact", head: true })
          .in("urgencia", ["Alta", "Crítica"])
          .not("status", "in", '("Concluído","Cancelado")'),
      ]);

      // Funnel
      const { data: leadsByStatus } = await db.from("leads").select("status");
      const funnel: Record<string, number> = {};
      (leadsByStatus || []).forEach((l: any) => { funnel[l.status] = (funnel[l.status] || 0) + 1; });

      // OS by status
      const { data: osByStatus } = await db.from("work_orders").select("status");
      const osStatus: Record<string, number> = {};
      (osByStatus || []).forEach((o: any) => { osStatus[o.status] = (osStatus[o.status] || 0) + 1; });

      // Proposals value
      const { data: propsVal } = await db.from("proposals").select("valor").neq("status", "Cancelado");
      const pipelineValue = (propsVal || []).reduce((s: number, p: any) => s + (p.valor || 0), 0);

      // Stale leads (14+ days no contact)
      const { data: staleLeads } = await db.from("leads")
        .select("id, nome, empresa, status, ultimo_contato")
        .not("status", "in", '("Ganho","Perdido")')
        .or(`ultimo_contato.is.null,ultimo_contato.lt.${new Date(Date.now() - 14 * 86400000).toISOString()}`)
        .limit(20);

      // SLA at risk
      const { data: slaRisk } = await db.from("work_orders")
        .select("numero_os, cliente, equipamento, urgencia, status, created_at, sla_horas")
        .not("status", "in", '("Concluído","Cancelado")')
        .in("urgencia", ["Alta", "Crítica"])
        .limit(10);

      const snapshot = {
        generated_at: new Date().toISOString(),
        source: "hexaos",
        summary: {
          total_leads: leadsRes.count || 0,
          leads_this_month: leadsMonthRes.count || 0,
          lead_funnel: funnel,
          total_proposals: proposalsRes.count || 0,
          pipeline_value: pipelineValue,
          open_work_orders: osRes.count || 0,
          critical_work_orders: osCritRes.count || 0,
          os_by_status: osStatus,
          lab_parts: labRes.count || 0,
          total_users: usersRes.count || 0,
          bottlenecks: bottleRes.count || 0,
          suggestions: sugRes.count || 0,
        },
        risks: {
          stale_leads: (staleLeads || []).map((l: any) => ({
            nome: l.nome,
            empresa: l.empresa,
            status: l.status,
            days_idle: l.ultimo_contato
              ? Math.round((Date.now() - new Date(l.ultimo_contato).getTime()) / 86400000)
              : "never_contacted",
          })),
          sla_at_risk: (slaRisk || []).map((o: any) => ({
            os: o.numero_os,
            cliente: o.cliente,
            equipamento: o.equipamento,
            urgencia: o.urgencia,
            hours_elapsed: Math.round((Date.now() - new Date(o.created_at).getTime()) / 3600000),
            sla_hours: o.sla_horas,
          })),
        },
      };

      await db.from("ai_audit_trail").insert({
        event_type: "data_pull",
        action: "full_snapshot",
        actor_type: "openclaw",
        details: { metrics_count: Object.keys(snapshot.summary).length },
      });

      return jsonResp({ success: true, ...snapshot });
    }

    // ─── POST /search — Search across tables ───
    if (path === "search" || body.action === "search") {
      const { query: searchQuery, tables: searchTables, limit: searchLimit } = body;
      if (!searchQuery) {
        return jsonResp({ success: false, error: "missing_query", message: "Informe 'query' para buscar." }, 400);
      }

      const targetTables = searchTables || ["leads", "work_orders", "bottlenecks", "suggestions", "proposals"];
      const lim = Math.min(searchLimit || 10, 50);
      const results: Record<string, any[]> = {};

      // Text columns to search per table
      const searchFields: Record<string, string[]> = {
        leads: ["nome", "empresa", "notas", "email"],
        proposals: ["titulo", "descricao"],
        contracts: ["titulo", "descricao", "notas"],
        financial_records: ["descricao", "cliente", "categoria"],
        bottlenecks: ["descricao", "exemplo_real"],
        profiles: ["nome", "funcao", "responsabilidades"],
        lab_parts: ["descricao", "equipamento_origem"],
        installed_equipment: ["nome", "cliente", "modelo"],
        repetitive_processes: ["processo"],
        projects: ["titulo", "descricao", "cliente"],
        channel_messages: ["content"],
      };

      for (const table of targetTables) {
        if (!TABLES[table] || !searchFields[table]) continue;
        const fields = searchFields[table];
        const orFilter = fields.map(f => `${f}.ilike.%${searchQuery}%`).join(",");
        const { data } = await db.from(table).select("*").or(orFilter).limit(lim);
        if (data && data.length > 0) {
          results[table] = data.map(maskPII);
        }
      }

      await db.from("ai_audit_trail").insert({
        event_type: "data_pull",
        action: "search",
        actor_type: "openclaw",
        details: { query: searchQuery, tables: targetTables, results_count: Object.values(results).flat().length },
      });

      return jsonResp({ success: true, query: searchQuery, results, pulled_at: new Date().toISOString() });
    }

    // ─── POST /changes — Get recent changes (incremental sync) ───
    if (path === "changes" || body.action === "changes") {
      const since = body.since || new Date(Date.now() - 24 * 3600000).toISOString();
      const targetTables = body.tables || Object.keys(TABLES);
      const changes: Record<string, { count: number; data: any[] }> = {};

      for (const table of targetTables) {
        if (!TABLES[table]) continue;
        const { data, count } = await db.from(table)
          .select("*", { count: "exact" })
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(100);

        if (data && data.length > 0) {
          changes[table] = { count: count || data.length, data: data.map(maskPII) };
        }
      }

      await db.from("ai_audit_trail").insert({
        event_type: "data_pull",
        action: "incremental_changes",
        actor_type: "openclaw",
        details: { since, tables_with_changes: Object.keys(changes).length },
      });

      return jsonResp({
        success: true,
        source: "hexaos",
        since,
        changes,
        pulled_at: new Date().toISOString(),
      });
    }

    // ─── Default: show available endpoints ───
    return jsonResp({
      success: true,
      source: "hexaos",
      api: "OpenClaw Data API",
      version: "1.0",
      endpoints: {
        "POST /catalog":    "Lista todas as tabelas, colunas e amostras",
        "POST /table/{name}": "Puxa dados de uma tabela específica (com filtros, paginação)",
        "POST /snapshot":   "Snapshot completo de KPIs e riscos do negócio",
        "POST /search":     "Busca textual em múltiplas tabelas",
        "POST /changes":    "Mudanças incrementais desde uma data (sync delta)",
      },
      auth: "Header X-OpenClaw-Token ou Authorization: Bearer <token>",
      tables_available: Object.keys(TABLES),
    });

  } catch (err) {
    console.error("[openclaw-data-api] Error:", err);
    return jsonResp({ success: false, error: "internal", message: "Erro interno." }, 500);
  }
});
