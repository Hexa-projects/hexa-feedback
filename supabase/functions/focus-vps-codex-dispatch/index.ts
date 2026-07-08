import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VPS_URL = Deno.env.get("FOCUS_CODEX_BRIDGE_URL") || Deno.env.get("VPS_CODEX_BRIDGE_URL") || "";
const VPS_TOKEN = Deno.env.get("FOCUS_CODEX_BRIDGE_TOKEN") || Deno.env.get("VPS_CODEX_BRIDGE_TOKEN") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);
    if (!VPS_URL || !VPS_TOKEN) return json({ error: "Focus AI VPS bridge not configured" }, 500);

    const { job_id, share_token, timeout_ms } = await req.json().catch(() => ({}));
    if (!job_id || !share_token) return json({ error: "job_id and share_token required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: job } = await admin
      .from("focus_ai_codex_jobs")
      .select("id, user_id")
      .eq("id", job_id)
      .maybeSingle();
    if (!job || job.user_id !== user.id) return json({ error: "job not found" }, 404);

    const dispatchBody = {
      async: true,
      run_id: `focus-${job_id}`,
      codex_bridge_url: `${SUPABASE_URL}/functions/v1/focus-codex-bridge`,
      job_id,
      share_token,
      timeout_ms: typeof timeout_ms === "number" ? timeout_ms : 1800000,
      sandbox: "workspace-write",
      app: "hexaos",
      persona: "focus_ai",
    };

    let vpsRes: Response;
    try {
      vpsRes = await fetch(VPS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VPS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dispatchBody),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      await admin.from("focus_ai_codex_jobs").update({ status: "failed", error: `VPS unreachable: ${msg}` }).eq("id", job_id);
      return json({ error: `VPS unreachable: ${msg}` }, 502);
    }

    const rawText = await vpsRes.text();
    let parsed: any = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    if (vpsRes.status !== 202 && !vpsRes.ok) {
      await admin
        .from("focus_ai_codex_jobs")
        .update({ status: "failed", error: `VPS dispatch failed (HTTP ${vpsRes.status})` })
        .eq("id", job_id);

      return json({
        error: `VPS dispatch failed (HTTP ${vpsRes.status})`,
        vps_response: parsed ?? rawText?.slice(0, 500) ?? null,
      }, 502);
    }

    const vpsRunId: string | null = parsed?.run_id ?? parsed?.id ?? dispatchBody.run_id;
    await admin
      .from("focus_ai_codex_jobs")
      .update({ status: "running", dispatched_at: new Date().toISOString(), vps_run_id: vpsRunId })
      .eq("id", job_id);

    return json({ ok: true, job_id, vps_run_id: vpsRunId, http_status: vpsRes.status });
  } catch (e) {
    console.error("focus-vps-codex-dispatch error", e);
    return json({ error: e instanceof Error ? e.message : "unknown error" }, 500);
  }
});
