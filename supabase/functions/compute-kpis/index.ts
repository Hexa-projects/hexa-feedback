import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: verify JWT is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Compute KPIs for last 30 days
    const results: Record<string, number> = {};

    // 1) ops_events_total (today)
    const { count: eventsToday } = await supabase
      .from("operational_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${todayStr}T00:00:00Z`);
    results.ops_events_total = eventsToday || 0;

    // 2) agent_success_rate (last 7 days)
    const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split("T")[0];
    const { count: totalRuns } = await supabase
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .gte("started_at", `${weekAgo}T00:00:00Z`);
    const { count: successRuns } = await supabase
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .gte("started_at", `${weekAgo}T00:00:00Z`)
      .eq("status", "success");
    results.agent_success_rate = totalRuns ? Math.round(((successRuns || 0) / totalRuns) * 100) : 0;

    // 3) needs_review_count (current pending)
    const { count: needsReview } = await supabase
      .from("action_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("requires_review", true);
    results.needs_review_count = needsReview || 0;

    // 4) avg_time_to_close (last 7 days, in minutes)
    const { data: closedRuns } = await supabase
      .from("agent_runs")
      .select("started_at, finished_at")
      .gte("started_at", `${weekAgo}T00:00:00Z`)
      .not("finished_at", "is", null)
      .in("status", ["success", "failed"]);

    let avgMinutes = 0;
    if (closedRuns && closedRuns.length > 0) {
      const totalMs = closedRuns.reduce((sum, r) => {
        return sum + (new Date(r.finished_at!).getTime() - new Date(r.started_at!).getTime());
      }, 0);
      avgMinutes = Math.round(totalMs / closedRuns.length / 60000);
    }
    results.avg_time_to_close = avgMinutes;

    // 5) total events last 7 days
    const { count: eventsWeek } = await supabase
      .from("operational_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${weekAgo}T00:00:00Z`);
    results.ops_events_week = eventsWeek || 0;

    // Upsert all KPIs
    for (const [key, value] of Object.entries(results)) {
      await supabase.from("kpi_snapshots").upsert({
        kpi_key: key,
        period_start: todayStr,
        period_end: todayStr,
        value,
        meta: { computed_at: new Date().toISOString() },
      }, { onConflict: "kpi_key,period_start,period_end" });
    }

    return new Response(JSON.stringify({ success: true, kpis: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("compute-kpis error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
