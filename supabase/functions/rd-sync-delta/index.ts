// Delta sync — reuses the same entity list as rd-sync-full but with
// updated_at_period[start]=<last_delta_sync_at>. Falls back to full when
// there is no previous sync yet.

import { corsHeaders, jsonResponse, requireAdmin, serviceRoleClient } from "../_shared/rd-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const svc = serviceRoleClient();
  const { data: integ } = await svc.from("crm_integrations")
    .select("last_delta_sync_at, last_full_sync_at")
    .eq("provider", "rd_station")
    .maybeSingle();
  const since = integ?.last_delta_sync_at ?? integ?.last_full_sync_at ?? null;

  const { data: job, error } = await svc.from("rd_sync_jobs").insert({
    type: "delta", status: "running", triggered_by: auth.userId,
    stats: { since },
  }).select("id").single();
  if (error || !job) return jsonResponse({ error: "job_create_failed" }, 500);

  // Import runSync at runtime from full to keep the mapping list DRY.
  const { runSync } = await import("../rd-sync-full/index.ts").catch(async () => {
    // Fallback: inline import via dynamic path resolution
    return await import("../rd-sync-full/runner.ts");
  }) as any;

  (globalThis as any).EdgeRuntime?.waitUntil(runSync(svc, job.id, true, since));
  return jsonResponse({ job_id: job.id, since });
});
