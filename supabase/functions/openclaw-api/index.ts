import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Whitelist of readable tables
const ALLOWED_TABLES: Record<string, string> = {
  onboarding_responses: "Respostas do onboarding",
  profiles: "Perfis dos colaboradores",
  daily_forms: "Formulários diários",
  bottlenecks: "Gargalos reportados",
  repetitive_processes: "Processos repetitivos",
  leads: "Leads do CRM",
  lead_interactions: "Interações com leads",
  proposals: "Propostas comerciais",
  contracts: "Contratos",
  financial_records: "Registros financeiros",
  lab_parts: "Peças em laboratório",
  installed_equipment: "Equipamentos instalados",
  projects: "Projetos",
  project_tasks: "Tarefas de projetos",
  corporate_channels: "Canais corporativos",
  channel_messages: "Mensagens de canais",
  channel_tasks: "Tarefas de canais",
  meeting_logs: "Histórico de reuniões",
  notifications: "Notificações",
  focus_ai_insights: "Insights da IA",
  focus_ai_logs: "Logs da IA",
  ai_action_requests: "Ações da IA",
  ai_audit_trail: "Auditoria da IA",
  ai_agents: "Agentes de IA",
  autonomy_rules: "Regras de autonomia",
  data_catalog: "Catálogo de dados",
  openclaw_event_queue: "Fila de eventos",
  openclaw_sync_status: "Status de sincronização",
  hex_calendars: "Calendários",
  hex_calendar_events: "Eventos de calendário",
  work_orders: "Ordens de serviço",
  kpi_snapshots: "Snapshots de KPIs",
  user_roles: "Papéis de usuários",
};

// PII fields to mask
const PII_FIELDS = ["email", "telefone", "llm_api_key", "openclaw_api_key", "hmac_secret", "sync_token"];

function maskPII(row: Record<string, any>): Record<string, any> {
  const masked = { ...row };
  for (const f of PII_FIELDS) {
    if (masked[f] && typeof masked[f] === "string" && masked[f].length > 4) {
      masked[f] = masked[f].slice(0, 3) + "***" + masked[f].slice(-2);
    }
  }
  return masked;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Auth via x-api-token ---
  const token = req.headers.get("x-api-token") || req.headers.get("x-openclaw-token");
  if (!token) {
    return json({ success: false, error: "Token ausente. Envie via header x-api-token." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  // Validate token against stored config
  const { data: cfg } = await db
    .from("focus_ai_config")
    .select("openclaw_api_key, openclaw_ativo")
    .limit(1)
    .single();

  if (!cfg || !cfg.openclaw_api_key || cfg.openclaw_api_key !== token) {
    return json({ success: false, error: "Token inválido." }, 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // GET requests or empty body
  }

  const action = body.action || "help";

  console.log(`[openclaw-api] action=${action}`, JSON.stringify(body));

  try {
    // ─── health ───
    if (action === "health") {
      return json({
        success: true,
        status: "ok",
        service: "hexaos-openclaw-api",
        timestamp: new Date().toISOString(),
      });
    }

    // ─── list_tables ───
    if (action === "list_tables") {
      const tables = [];
      for (const [name, desc] of Object.entries(ALLOWED_TABLES)) {
        const { count } = await db.from(name).select("*", { count: "exact", head: true });
        tables.push({ table: name, description: desc, row_count: count || 0 });
      }
      return json({ success: true, tables });
    }

    // ─── table_query — safe read from whitelisted tables ───
    if (action === "table_query") {
      const { table, limit: lim, offset, order_by, ascending, filters, columns, since } = body;

      if (!table || !ALLOWED_TABLES[table]) {
        return json({
          success: false,
          error: `Tabela '${table}' não permitida. Use list_tables para ver disponíveis.`,
          allowed: Object.keys(ALLOWED_TABLES),
        }, 400);
      }

      const queryLimit = Math.min(lim || 200, 1000);
      const queryOffset = offset || 0;
      const selectCols = columns || "*";

      let query = db.from(table).select(selectCols, { count: "exact" });

      if (since) {
        query = query.gte("created_at", since);
      }

      if (filters && typeof filters === "object") {
        for (const [col, val] of Object.entries(filters)) {
          if (val !== null && val !== undefined) {
            query = query.eq(col, val);
          }
        }
      }

      const { data, count, error } = await query
        .order(order_by || "created_at", { ascending: ascending ?? false })
        .range(queryOffset, queryOffset + queryLimit - 1);

      if (error) {
        return json({ success: false, error: error.message }, 500);
      }

      const masked = (data || []).map(maskPII);

      await db.from("ai_audit_trail").insert({
        event_type: "data_pull",
        action: `openclaw-api:table_query:${table}`,
        actor_type: "openclaw",
        details: { table, rows: masked.length, total: count, offset: queryOffset },
      });

      return json({
        success: true,
        table,
        total_rows: count || 0,
        returned: masked.length,
        offset: queryOffset,
        limit: queryLimit,
        has_more: (count || 0) > queryOffset + queryLimit,
        data: masked,
      });
    }

    // ─── table_stats — column info + sample ───
    if (action === "table_stats") {
      const { table } = body;
      if (!table || !ALLOWED_TABLES[table]) {
        return json({ success: false, error: `Tabela '${table}' não permitida.` }, 400);
      }

      const { count } = await db.from(table).select("*", { count: "exact", head: true });
      const { data: sample } = await db.from(table).select("*").limit(1);
      const cols = sample?.[0] ? Object.keys(sample[0]) : [];

      return json({
        success: true,
        table,
        row_count: count || 0,
        columns: cols,
        sample: sample?.[0] ? maskPII(sample[0]) : null,
      });
    }

    // ─── onboarding_report ───
    if (action === "onboarding_report") {
      const { data: responses, count } = await db
        .from("onboarding_responses")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(body.limit || 100);

      const { data: profiles } = await db.from("profiles").select("id, nome, funcao, setor");

      // Stats
      const bySetor: Record<string, number> = {};
      const byFuncao: Record<string, number> = {};
      const analyzed = { total: 0, by_ia: 0 };

      for (const r of responses || []) {
        bySetor[r.setor] = (bySetor[r.setor] || 0) + 1;
        byFuncao[r.funcao] = (byFuncao[r.funcao] || 0) + 1;
        analyzed.total++;
        if (r.analisado_por_ia) analyzed.by_ia++;
      }

      await db.from("ai_audit_trail").insert({
        event_type: "data_pull",
        action: "openclaw-api:onboarding_report",
        actor_type: "openclaw",
        details: { total: count },
      });

      return json({
        success: true,
        report: "onboarding",
        total_responses: count || 0,
        stats: { by_setor: bySetor, by_funcao: byFuncao, analyzed },
        profiles_count: profiles?.length || 0,
        data: (responses || []).map(maskPII),
      });
    }

    // ─── audit_logs ───
    if (action === "audit_logs") {
      const { limit: lim, since, event_type, actor_type } = body;

      let query = db
        .from("ai_audit_trail")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(Math.min(lim || 100, 500));

      if (since) query = query.gte("created_at", since);
      if (event_type) query = query.eq("event_type", event_type);
      if (actor_type) query = query.eq("actor_type", actor_type);

      const { data, count, error } = await query;

      if (error) {
        return json({ success: false, error: error.message }, 500);
      }

      return json({
        success: true,
        total: count || 0,
        returned: data?.length || 0,
        data: data || [],
      });
    }

    // ─── focus_logs — Logs do Focus AI ───
    if (action === "focus_logs") {
      const { limit: lim, since, tipo } = body;

      let query = db
        .from("focus_ai_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(Math.min(lim || 100, 500));

      if (since) query = query.gte("created_at", since);
      if (tipo) query = query.eq("tipo", tipo);

      const { data, count, error } = await query;
      if (error) return json({ success: false, error: error.message }, 500);

      return json({ success: true, total: count || 0, returned: data?.length || 0, data: data || [] });
    }

    // ─── help (default) ───
    return json({
      success: true,
      service: "hexaos-openclaw-api",
      version: "1.0",
      actions: {
        health: "Verificar conectividade",
        list_tables: "Listar tabelas disponíveis com contagem de registros",
        table_query: "Consultar dados de uma tabela (params: table, limit, offset, order_by, ascending, filters, columns, since)",
        table_stats: "Ver colunas e amostra de uma tabela (params: table)",
        onboarding_report: "Relatório completo de onboarding com estatísticas (params: limit)",
        audit_logs: "Logs de auditoria da IA (params: limit, since, event_type, actor_type)",
        focus_logs: "Logs do Focus AI (params: limit, since, tipo)",
      },
      auth: "Header x-api-token com o token configurado no Focus AI",
      tables_available: Object.keys(ALLOWED_TABLES).length,
    });
  } catch (err) {
    console.error("[openclaw-api] Error:", err);
    return json({ success: false, error: "Erro interno.", message: String(err) }, 500);
  }
});
