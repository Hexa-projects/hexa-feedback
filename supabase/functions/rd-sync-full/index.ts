import { corsHeaders, jsonResponse, requireAdmin, serviceRoleClient } from "../_shared/rd-client.ts";
import { runSync } from "../_shared/rd-sync-runner.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const svc = serviceRoleClient();
  const { data: job, error } = await svc.from("rd_sync_jobs").insert({
    type: "full", status: "running", triggered_by: auth.userId,
  }).select("id").single();
  if (error || !job) return jsonResponse({ error: "job_create_failed" }, 500);

  (globalThis as any).EdgeRuntime?.waitUntil(runSync(svc, job.id, false, null));
  return jsonResponse({ job_id: job.id });
});
