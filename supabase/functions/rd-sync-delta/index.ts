import { corsHeaders, jsonResponse, requireAdmin, serviceRoleClient } from "../_shared/rd-client.ts";
import { runSync } from "../_shared/rd-sync-runner.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const svc = serviceRoleClient();
  const { data: integ } = await svc.from("crm_integrations")
    .select("last_delta_sync_at, last_full_sync_at")
    .eq("provider", "rd_station")
    .maybeSingle();
  const since = (integ?.last_delta_sync_at ?? integ?.last_full_sync_at ?? null) as string | null;

  const { data: job, error } = await svc.from("rd_sync_jobs").insert({
    type: "delta", status: "running", triggered_by: auth.userId,
    stats: { since },
  }).select("id").single();
  if (error || !job) return jsonResponse({ error: "job_create_failed" }, 500);

  (globalThis as any).EdgeRuntime?.waitUntil(runSync(svc, job.id, true, since));
  return jsonResponse({ job_id: job.id, since });
});
