import { corsHeaders, jsonResponse, requireFinanceAccess, serviceRoleClient } from "../_shared/omie-client.ts";
import { runOmieFinanceSync } from "../_shared/omie-finance-sync.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireFinanceAccess(req);
  if (auth instanceof Response) return auth;

  const svc = serviceRoleClient();
  const { data: running } = await svc
    .from("omie_sync_jobs")
    .select("id,status,next_retry_at")
    .eq("module", "finance")
    .in("status", ["queued", "running", "waiting_cooldown"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (running) {
    return jsonResponse({ job_id: running.id, status: running.status, next_retry_at: running.next_retry_at, already_running: true }, 409);
  }

  const { data: job, error } = await svc.from("omie_sync_jobs").insert({
    job_type: "delta",
    type: "delta",
    module: "finance",
    status: "running",
    triggered_by: auth.userId,
  }).select("id").single();
  if (error || !job) return jsonResponse({ error: "job_create_failed", details: error?.message }, 500);

  (globalThis as any).EdgeRuntime?.waitUntil(runOmieFinanceSync(svc, job.id, { delta: true }));
  return jsonResponse({ job_id: job.id, status: "running" });
});
