import { corsHeaders, jsonResponse, requireFinanceAccess, serviceRoleClient } from "../_shared/omie-client.ts";
import { runOmieFinanceSync } from "../_shared/omie-finance-sync.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireFinanceAccess(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const jobId = body?.job_id as string | undefined;
  if (!jobId) return jsonResponse({ error: "job_id_required" }, 400);

  const svc = serviceRoleClient();
  const { data: sourceJob, error: sourceError } = await svc
    .from("omie_sync_jobs")
    .select("id,type,module,status,next_retry_at,method")
    .eq("id", jobId)
    .maybeSingle();
  if (sourceError || !sourceJob) return jsonResponse({ error: "job_not_found" }, 404);

  if (sourceJob.next_retry_at && new Date(sourceJob.next_retry_at).getTime() > Date.now()) {
    return jsonResponse({
      error: "cooldown_active",
      next_retry_at: sourceJob.next_retry_at,
      message: "Aguarde o prazo de cooldown do Omie antes de tentar novamente.",
    }, 409);
  }

  const { data: running } = await svc
    .from("omie_sync_jobs")
    .select("id,status,next_retry_at")
    .eq("module", "finance")
    .in("status", ["queued", "running"])
    .neq("id", jobId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (running) return jsonResponse({ job_id: running.id, status: running.status, already_running: true }, 409);

  const { data: retryJob, error } = await svc.from("omie_sync_jobs").insert({
    job_type: "retry",
    type: "retry",
    module: "finance",
    method: sourceJob.method,
    status: "running",
    triggered_by: auth.userId,
    cursor_data: { retry_of: jobId },
  }).select("id").single();
  if (error || !retryJob) return jsonResponse({ error: "job_create_failed", details: error?.message }, 500);

  (globalThis as any).EdgeRuntime?.waitUntil(runOmieFinanceSync(svc, retryJob.id, {
    onlyMethod: sourceJob.method,
  }));
  return jsonResponse({ job_id: retryJob.id, status: "running" });
});
