import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENCLAW_INGEST_TOKEN = Deno.env.get("OPENCLAW_INGEST_TOKEN");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth via bearer token
    const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!OPENCLAW_INGEST_TOKEN || auth !== OPENCLAW_INGEST_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      event_id,
      openclaw_request_id,
      status,
      summary = "",
      actions = [],
      kpi_updates = [],
      errors = [],
    } = body;

    if (!openclaw_request_id || !status) {
      return new Response(JSON.stringify({ error: "openclaw_request_id and status are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Upsert agent_run by openclaw_request_id (idempotent)
    const { error: runErr } = await supabase
      .from("agent_runs")
      .upsert({
        event_id,
        openclaw_request_id,
        status,
        summary,
        actions,
        errors,
        finished_at: new Date().toISOString(),
      }, { onConflict: "openclaw_request_id" });

    if (runErr) {
      console.error("Failed to upsert agent_run:", runErr.message);
      throw new Error(runErr.message);
    }

    // Update event status
    if (event_id) {
      const eventStatus = status === "success" ? "processed" : status === "failed" ? "failed" : "new";
      await supabase.from("operational_events").update({ status: eventStatus }).eq("id", event_id);
    }

    // Upsert KPI snapshots
    if (kpi_updates && kpi_updates.length > 0) {
      for (const kpi of kpi_updates) {
        const { error: kpiErr } = await supabase
          .from("kpi_snapshots")
          .upsert({
            kpi_key: kpi.kpi_key,
            period_start: kpi.period_start,
            period_end: kpi.period_end,
            value: kpi.value,
            meta: kpi.meta || {},
          }, { onConflict: "kpi_key,period_start,period_end" });

        if (kpiErr) console.error(`KPI upsert error for ${kpi.kpi_key}:`, kpiErr.message);
      }
    }

    // Create action_queue entries if needs_review
    if (status === "needs_review" && actions.length > 0) {
      const actionRows = actions.map((a: any) => ({
        event_id,
        action_type: a.type || a.action_type || "unknown",
        payload: a.meta || a.payload || {},
        requires_review: true,
        status: "pending",
      }));
      const { error: aqErr } = await supabase.from("action_queue").insert(actionRows);
      if (aqErr) console.error("Failed to create action_queue entries:", aqErr.message);
    }

    // Audit trail
    await supabase.from("ai_audit_trail").insert({
      event_type: "openclaw_ingest",
      action: `agent_${status}`,
      actor_type: "openclaw",
      entity_type: "agent_run",
      entity_id: openclaw_request_id,
      details: { event_id, summary, actions_count: actions.length, kpi_count: kpi_updates.length },
      outcome: status,
    });

    return new Response(JSON.stringify({ success: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("ingest-openclaw error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
