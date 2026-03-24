import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function maskToken(t: string): string {
  if (!t || t.length < 8) return "***";
  return t.slice(0, 4) + "..." + t.slice(-4);
}

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleFailure(db: any, events: any[], errorMsg: string) {
  const now = new Date();
  for (const evt of events) {
    const attempts = (evt.attempts || 0) + 1;
    if (attempts >= (evt.max_attempts || 5)) {
      await db.from("openclaw_event_queue").update({
        status: "dlq",
        attempts,
        last_error: errorMsg,
      }).eq("id", evt.id);
    } else {
      const backoffMs = Math.pow(2, attempts) * 1000 + Math.random() * 1000;
      const retryAt = new Date(now.getTime() + backoffMs);
      await db.from("openclaw_event_queue").update({
        status: "failed",
        attempts,
        last_error: errorMsg,
        next_retry_at: retryAt.toISOString(),
      }).eq("id", evt.id);
    }
  }

  await db.from("openclaw_sync_status").upsert({
    metric_name: "connection",
    metric_value: { status: "error", last_check: now.toISOString(), error: errorMsg },
    updated_at: now.toISOString(),
  }, { onConflict: "metric_name" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const { action } = await req.json();

    if (action === "process_queue") {
      const { data: cfg } = await db.from("focus_ai_config").select("*").limit(1).single();
      if (!cfg || !cfg.openclaw_ativo) {
        return jsonResp({ success: false, error: "disabled", message: "OpenClaw sync desativado." });
      }
      const baseUrl = (cfg.openclaw_url || "").replace(/\/+$/, "");
      const token = cfg.openclaw_api_key || "";

      if (!baseUrl) {
        return jsonResp({ success: false, error: "no_url", message: "URL do OpenClaw não configurada." });
      }

      const { data: events, error: fetchErr } = await db
        .from("openclaw_event_queue")
        .select("*")
        .in("status", ["pending", "failed"])
        .or("next_retry_at.is.null,next_retry_at.lte." + new Date().toISOString())
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(50);

      if (fetchErr) {
        console.error("[openclaw-sync] DB fetch error:", fetchErr.message);
        return jsonResp({ success: false, error: "db_error", message: fetchErr.message });
      }

      if (!events || events.length === 0) {
        return jsonResp({ success: true, processed: 0, message: "Nenhum evento pendente." });
      }

      const ids = events.map((e: any) => e.id);
      await db.from("openclaw_event_queue").update({ status: "processing" }).in("id", ids);

      // Try /api/chat endpoint (OpenClaw standard)
      const endpoint = `${baseUrl}/api/chat`;

      const allResults: any[] = [];
      let allOk = true;

      for (const evt of events) {
        const payload = {
          message: JSON.stringify({
            type: "hexaos_event",
            source: "hexaos",
            event_id: evt.event_id,
            event_type: evt.event_type,
            priority: evt.priority,
            domain: evt.domain || "general",
            tags: evt.tags || [],
            data: evt.data,
            meta: evt.meta || {},
            created_at: evt.created_at,
          }),
          sessionKey: "hexaos-sync",
        };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok) {
            allResults.push({ id: evt.id, ok: true });
          } else {
            const errText = await res.text().catch(() => "");

            if (res.status === 401 || res.status === 403) {
              // Auth error - fail all remaining
              await handleFailure(db, events, "Token inválido ou ausente");
              return jsonResp({ success: false, error: "auth_error", message: "Token inválido." });
            }

            // For 404 on tools/invoke, the tool may not exist - still mark as delivered
            // since OpenClaw received it but doesn't have the tool installed
            if (res.status === 404) {
              console.log(`[openclaw-sync] Tool not found (404), marking event as delivered (gateway received it)`);
              allResults.push({ id: evt.id, ok: true, note: "tool_not_found" });
            } else {
              allOk = false;
              allResults.push({ id: evt.id, ok: false, status: res.status, error: errText.slice(0, 200) });
            }
          }
        } catch (fetchErr: any) {
          clearTimeout(timeout);
          const errMsg = fetchErr.name === "AbortError" ? "Timeout (8s)" : (fetchErr.message || "unknown");
          allOk = false;
          allResults.push({ id: evt.id, ok: false, error: errMsg });
        }
      }

      // Process results
      const successIds = allResults.filter(r => r.ok).map(r => r.id);
      const failedResults = allResults.filter(r => !r.ok);

      if (successIds.length > 0) {
        await db.from("openclaw_event_queue").update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
        }).in("id", successIds);
      }

      if (failedResults.length > 0) {
        const failedEvents = events.filter((e: any) => failedResults.some(r => r.id === e.id));
        await handleFailure(db, failedEvents, failedResults[0]?.error || "Unknown error");
      }

      await db.from("openclaw_sync_status").upsert({
        metric_name: "last_heartbeat",
        metric_value: { sent_at: new Date().toISOString(), success: allOk, count: successIds.length },
        updated_at: new Date().toISOString(),
      }, { onConflict: "metric_name" });

      await db.from("openclaw_sync_status").upsert({
        metric_name: "connection",
        metric_value: { status: allOk ? "connected" : "partial", last_check: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: "metric_name" });

      return jsonResp({
        success: allOk,
        processed: successIds.length,
        failed: failedResults.length,
        message: `${successIds.length}/${events.length} eventos enviados.`,
      });
    }

    if (action === "queue_stats") {
      const counts: Record<string, number> = {};
      for (const status of ["pending", "processing", "delivered", "failed", "dlq"]) {
        const { count } = await db.from("openclaw_event_queue").select("*", { count: "exact", head: true }).eq("status", status);
        counts[status] = count || 0;
      }

      await db.from("openclaw_sync_status").upsert({
        metric_name: "queue_stats",
        metric_value: counts,
        updated_at: new Date().toISOString(),
      }, { onConflict: "metric_name" });

      return jsonResp({ success: true, stats: counts });
    }

    if (action === "flush_dlq") {
      const { error } = await db.from("openclaw_event_queue")
        .update({ status: "pending", attempts: 0, next_retry_at: null, last_error: null })
        .eq("status", "dlq");
      if (error) return jsonResp({ success: false, message: error.message });
      return jsonResp({ success: true, message: "DLQ reprocessada." });
    }

    return jsonResp({ success: false, error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[openclaw-sync] Error:", err);
    return jsonResp({ success: false, error: "internal", message: "Erro interno." }, 500);
  }
});
