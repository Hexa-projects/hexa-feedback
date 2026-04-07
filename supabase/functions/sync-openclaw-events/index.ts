import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;
const POST_TIMEOUT_MS = 8000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results = { processed: 0, delivered: 0, failed: 0, dlq: 0, errors: [] as string[] };

  try {
    // 1. Get OpenClaw config
    const { data: configRows } = await supabase
      .from("focus_ai_config")
      .select("openclaw_url, openclaw_api_key, openclaw_ativo")
      .limit(1);

    const config = configRows?.[0];
    if (!config?.openclaw_ativo || !config?.openclaw_url) {
      // Update sync status
      await supabase.from("openclaw_sync_status").upsert({
        metric_name: "connection",
        metric_value: { status: "disabled", checked_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: "metric_name" });

      return new Response(JSON.stringify({ success: true, message: "OpenClaw desativado", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch pending/failed events ready for processing
    const { data: events, error: fetchErr } = await supabase
      .from("openclaw_event_queue")
      .select("*")
      .in("status", ["pending", "failed"])
      .or("next_retry_at.is.null,next_retry_at.lte." + new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      throw new Error(`Fetch error: ${fetchErr.message}`);
    }

    if (!events || events.length === 0) {
      await updateSyncStatus(supabase, results);
      return new Response(JSON.stringify({ success: true, message: "Fila vazia", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Process each event
    for (const event of events) {
      results.processed++;

      // Mark as processing
      await supabase
        .from("openclaw_event_queue")
        .update({ status: "processing" })
        .eq("id", event.id);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);

        const response = await fetch(`${config.openclaw_url}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.openclaw_api_key ? { "x-api-token": config.openclaw_api_key } : {}),
          },
          body: JSON.stringify({
            event_type: event.event_type,
            event_id: event.event_id,
            domain: event.domain,
            priority: event.priority,
            tags: event.tags,
            data: event.data,
            meta: event.meta,
            source: "hexaos-sync-worker",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorBody.substring(0, 500)}`);
        }

        // Consume response body
        await response.text();

        // Success: mark delivered
        await supabase
          .from("openclaw_event_queue")
          .update({
            status: "delivered",
            delivered_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", event.id);

        results.delivered++;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const currentAttempts = (event.attempts || 0) + 1;

        if (currentAttempts >= MAX_ATTEMPTS) {
          // Move to DLQ
          await supabase
            .from("openclaw_event_queue")
            .update({
              status: "dlq",
              attempts: currentAttempts,
              last_error: `[DLQ] ${errorMessage}`,
            })
            .eq("id", event.id);
          results.dlq++;
        } else {
          // Exponential backoff: 2^attempts seconds + random jitter
          const backoffMs = Math.pow(2, currentAttempts) * 1000 + Math.random() * 1000;
          const nextRetry = new Date(Date.now() + backoffMs).toISOString();

          await supabase
            .from("openclaw_event_queue")
            .update({
              status: "failed",
              attempts: currentAttempts,
              last_error: errorMessage,
              next_retry_at: nextRetry,
            })
            .eq("id", event.id);
          results.failed++;
        }

        results.errors.push(`${event.event_type}: ${errorMessage}`);
      }
    }

    // 4. Update sync status
    await updateSyncStatus(supabase, results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-openclaw-events] Fatal:", msg);
    return new Response(JSON.stringify({ success: false, message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function updateSyncStatus(supabase: any, results: any) {
  const now = new Date().toISOString();

  await supabase.from("openclaw_sync_status").upsert({
    metric_name: "last_sync_run",
    metric_value: {
      ran_at: now,
      processed: results.processed,
      delivered: results.delivered,
      failed: results.failed,
      dlq: results.dlq,
    },
    updated_at: now,
  }, { onConflict: "metric_name" });

  // Derive connection status from results
  const status = results.delivered > 0 && results.failed === 0
    ? "connected"
    : results.delivered > 0
      ? "degraded"
      : results.processed === 0
        ? "idle"
        : "disconnected";

  await supabase.from("openclaw_sync_status").upsert({
    metric_name: "connection",
    metric_value: { status, checked_at: now, last_results: results },
    updated_at: now,
  }, { onConflict: "metric_name" });
}
