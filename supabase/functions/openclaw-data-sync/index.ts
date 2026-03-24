import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskToken(t: string): string {
  if (!t || t.length < 8) return "***";
  return t.slice(0, 4) + "..." + t.slice(-4);
}

// Domain mapping for tables
const TABLE_DOMAINS: Record<string, string> = {
  leads: "sales",
  lead_interactions: "sales",
  proposals: "sales",
  work_orders: "ops",
  work_order_activities: "ops",
  lab_parts: "ops",
  daily_forms: "ops",
  bottlenecks: "ops",
  repetitive_processes: "ops",
  suggestions: "ops",
  tool_mappings: "ops",
  profiles: "general",
  focus_ai_insights: "general",
  focus_ai_logs: "general",
};

// Business metrics definitions
const METRIC_QUERIES: Record<string, string> = {
  total_leads: `SELECT count(*) as value FROM leads`,
  leads_by_status: `SELECT status, count(*) as value FROM leads GROUP BY status`,
  leads_this_month: `SELECT count(*) as value FROM leads WHERE created_at >= date_trunc('month', now())`,
  total_proposals: `SELECT count(*) as value FROM proposals`,
  proposals_value: `SELECT COALESCE(sum(valor), 0) as value FROM proposals WHERE status != 'Cancelado'`,
  open_work_orders: `SELECT count(*) as value FROM work_orders WHERE status NOT IN ('Concluído', 'Cancelado')`,
  critical_work_orders: `SELECT count(*) as value FROM work_orders WHERE urgencia IN ('Alta', 'Crítica') AND status NOT IN ('Concluído', 'Cancelado')`,
  sla_breaches: `SELECT count(*) as value FROM work_orders WHERE status NOT IN ('Concluído', 'Cancelado') AND created_at + (sla_horas * interval '1 hour') < now()`,
  lab_parts_in_repair: `SELECT count(*) as value FROM lab_parts WHERE status NOT IN ('Concluído', 'Devolvido')`,
  total_users: `SELECT count(*) as value FROM profiles`,
  bottlenecks_critical: `SELECT count(*) as value FROM bottlenecks WHERE urgencia IN ('Alta', 'Crítica')`,
  suggestions_pending: `SELECT count(*) as value FROM suggestions`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const { action } = await req.json();

    // ─── CATALOG: Auto-discover database schema ───
    if (action === "discover_catalog") {
      const tables = [
        "leads", "lead_interactions", "proposals", "work_orders",
        "work_order_activities", "lab_parts", "daily_forms", "bottlenecks",
        "repetitive_processes", "suggestions", "tool_mappings", "profiles",
      ];

      const catalog: any[] = [];

      for (const table of tables) {
        // Get row count
        const { count } = await db.from(table).select("*", { count: "exact", head: true });

        // Get column info from a sample row
        const { data: sample } = await db.from(table).select("*").limit(1);
        const columns = sample && sample.length > 0
          ? Object.keys(sample[0]).map(col => ({
              name: col,
              type: typeof sample[0][col],
              nullable: sample[0][col] === null,
              sample_value: typeof sample[0][col] === "string" && sample[0][col].length > 50
                ? sample[0][col].slice(0, 50) + "..."
                : sample[0][col],
            }))
          : [];

        catalog.push({
          table_name: table,
          schema_name: "public",
          column_count: columns.length,
          row_count: count || 0,
          columns_info: columns,
          domain: TABLE_DOMAINS[table] || "general",
        });

        // Upsert to data_catalog
        await db.from("data_catalog").upsert({
          table_name: table,
          schema_name: "public",
          column_count: columns.length,
          row_count: count || 0,
          columns_info: columns,
          domain: TABLE_DOMAINS[table] || "general",
          last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "table_name" });
      }

      // Enqueue catalog event for OpenClaw
      await db.from("openclaw_event_queue").insert({
        event_id: crypto.randomUUID(),
        event_type: "catalog.discovery",
        priority: "low",
        domain: "general",
        tags: ["catalog", "discovery"],
        data: { tables: catalog, discovered_at: new Date().toISOString() },
        meta: { schema_version: "1.0", source: "hexaos", env: "production" },
        status: "pending",
      });

      return jsonResp({ success: true, tables: catalog.length, catalog });
    }

    // ─── SNAPSHOT: Collect business metrics ───
    if (action === "business_snapshot") {
      const metrics: Record<string, any> = {};

      for (const [key, query] of Object.entries(METRIC_QUERIES)) {
        try {
          const { data, error } = await db.rpc("", {}).then(() => null).catch(() => null) as any;
          // Use direct select for simpler queries
        } catch {
          metrics[key] = { error: "query_failed" };
        }
      }

      // Collect metrics via Supabase client
      const [
        leadsRes, leadsMonthRes, proposalsRes, proposalsValRes,
        osOpenRes, osCritRes, labRes, usersRes, bottleRes, sugRes
      ] = await Promise.all([
        db.from("leads").select("*", { count: "exact", head: true }),
        db.from("leads").select("*", { count: "exact", head: true }).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        db.from("proposals").select("*", { count: "exact", head: true }),
        db.from("proposals").select("valor").neq("status", "Cancelado"),
        db.from("work_orders").select("*", { count: "exact", head: true }).not("status", "in", '("Concluído","Cancelado")'),
        db.from("work_orders").select("*", { count: "exact", head: true }).in("urgencia", ["Alta", "Crítica"]).not("status", "in", '("Concluído","Cancelado")'),
        db.from("lab_parts").select("*", { count: "exact", head: true }).not("status", "in", '("Concluído","Devolvido")'),
        db.from("profiles").select("*", { count: "exact", head: true }),
        db.from("bottlenecks").select("*", { count: "exact", head: true }).in("urgencia", ["Alta", "Crítica"]),
        db.from("suggestions").select("*", { count: "exact", head: true }),
      ]);

      const proposalsTotalValue = (proposalsValRes.data || []).reduce((sum: number, p: any) => sum + (p.valor || 0), 0);

      // Lead funnel
      const { data: leadsByStatus } = await db.from("leads").select("status");
      const funnelCounts: Record<string, number> = {};
      (leadsByStatus || []).forEach((l: any) => {
        funnelCounts[l.status] = (funnelCounts[l.status] || 0) + 1;
      });

      // OS by status
      const { data: osByStatus } = await db.from("work_orders").select("status, urgencia");
      const osCounts: Record<string, number> = {};
      (osByStatus || []).forEach((o: any) => {
        osCounts[o.status] = (osCounts[o.status] || 0) + 1;
      });

      const snapshot = {
        timestamp: new Date().toISOString(),
        source: "hexaos",
        sales: {
          total_leads: leadsRes.count || 0,
          leads_this_month: leadsMonthRes.count || 0,
          funnel: funnelCounts,
          total_proposals: proposalsRes.count || 0,
          pipeline_value: proposalsTotalValue,
        },
        operations: {
          open_work_orders: osOpenRes.count || 0,
          critical_work_orders: osCritRes.count || 0,
          os_by_status: osCounts,
        },
        lab: {
          parts_in_repair: labRes.count || 0,
        },
        team: {
          total_users: usersRes.count || 0,
        },
        intelligence: {
          critical_bottlenecks: bottleRes.count || 0,
          pending_suggestions: sugRes.count || 0,
        },
      };

      // Enqueue snapshot event
      await db.from("openclaw_event_queue").insert({
        event_id: crypto.randomUUID(),
        event_type: "snapshot.business",
        priority: "medium",
        domain: "general",
        tags: ["snapshot", "business", "periodic"],
        data: snapshot,
        meta: { schema_version: "1.0", source: "hexaos", type: "business_snapshot" },
        status: "pending",
      });

      // Update sync status
      await db.from("openclaw_sync_status").upsert({
        metric_name: "last_snapshot",
        metric_value: { timestamp: snapshot.timestamp, metrics_count: Object.keys(snapshot).length },
        updated_at: new Date().toISOString(),
      }, { onConflict: "metric_name" });

      return jsonResp({ success: true, snapshot });
    }

    // ─── EXECUTIVE SUMMARY: High-level insights ───
    if (action === "executive_summary") {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const monthAgo = new Date(now.getTime() - 30 * 86400000);

      // Recent activity
      const [newLeads, newOS, closedOS, newProposals] = await Promise.all([
        db.from("leads").select("*", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
        db.from("work_orders").select("*", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
        db.from("work_orders").select("*", { count: "exact", head: true }).eq("status", "Concluído").gte("updated_at", weekAgo.toISOString()),
        db.from("proposals").select("*", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
      ]);

      // Risks
      const { data: slaRisk } = await db.from("work_orders")
        .select("id, numero_os, cliente, equipamento, urgencia, created_at, sla_horas")
        .not("status", "in", '("Concluído","Cancelado")')
        .in("urgencia", ["Alta", "Crítica"])
        .order("created_at", { ascending: true })
        .limit(5);

      // Stale leads (no contact in 14+ days)
      const { data: staleLeads } = await db.from("leads")
        .select("id, nome, empresa, status, ultimo_contato")
        .not("status", "in", '("Ganho","Perdido")')
        .or(`ultimo_contato.is.null,ultimo_contato.lt.${new Date(now.getTime() - 14 * 86400000).toISOString()}`)
        .limit(10);

      const summary = {
        period: "last_7_days",
        generated_at: now.toISOString(),
        activity: {
          new_leads: newLeads.count || 0,
          new_work_orders: newOS.count || 0,
          closed_work_orders: closedOS.count || 0,
          new_proposals: newProposals.count || 0,
        },
        risks: {
          sla_at_risk: (slaRisk || []).map((o: any) => ({
            os: o.numero_os,
            cliente: o.cliente,
            equipamento: o.equipamento,
            urgencia: o.urgencia,
            hours_elapsed: Math.round((now.getTime() - new Date(o.created_at).getTime()) / 3600000),
            sla_hours: o.sla_horas,
          })),
          stale_leads: (staleLeads || []).map((l: any) => ({
            nome: l.nome,
            empresa: l.empresa,
            status: l.status,
            days_without_contact: l.ultimo_contato
              ? Math.round((now.getTime() - new Date(l.ultimo_contato).getTime()) / 86400000)
              : "never",
          })),
        },
      };

      // Enqueue
      await db.from("openclaw_event_queue").insert({
        event_id: crypto.randomUUID(),
        event_type: "summary.executive",
        priority: "high",
        domain: "general",
        tags: ["summary", "executive", "weekly"],
        data: summary,
        meta: { schema_version: "1.0", source: "hexaos", type: "executive_summary" },
        status: "pending",
      });

      return jsonResp({ success: true, summary });
    }

    // ─── DATA QUALITY: Check data health ───
    if (action === "data_quality") {
      const checks: any[] = [];

      // Leads without email
      const { count: noEmail } = await db.from("leads").select("*", { count: "exact", head: true }).or("email.is.null,email.eq.");
      checks.push({ table: "leads", check: "missing_email", count: noEmail || 0, severity: "medium" });

      // OS without description
      const { count: noDesc } = await db.from("work_orders").select("*", { count: "exact", head: true }).or("descricao.is.null,descricao.eq.");
      checks.push({ table: "work_orders", check: "missing_description", count: noDesc || 0, severity: "low" });

      // Profiles without function
      const { count: noFunc } = await db.from("profiles").select("*", { count: "exact", head: true }).or("funcao.is.null,funcao.eq.");
      checks.push({ table: "profiles", check: "missing_funcao", count: noFunc || 0, severity: "medium" });

      const qualityScore = checks.reduce((score, c) => {
        return score - (c.count * (c.severity === "high" ? 3 : c.severity === "medium" ? 2 : 1));
      }, 100);

      return jsonResp({
        success: true,
        quality_score: Math.max(0, qualityScore),
        checks,
        checked_at: new Date().toISOString(),
      });
    }

    return jsonResp({ success: false, error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[openclaw-data-sync] Error:", err);
    return jsonResp({ success: false, error: "internal", message: "Erro interno." }, 500);
  }
});
