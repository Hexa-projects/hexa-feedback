import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp, x-event-id",
};

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Expected: /webhooks/:source or invoked with body.source
    const source = pathParts[pathParts.length - 1] || "unknown";

    const body = await req.json();
    const eventSource = body.source || source;
    const eventId = req.headers.get("x-event-id") || body.eventId || crypto.randomUUID();
    const timestamp = req.headers.get("x-timestamp") || body.occurredAt || new Date().toISOString();
    const signature = req.headers.get("x-signature") || "";

    // Anti-replay check
    const tsMs = new Date(timestamp).getTime();
    if (Date.now() - tsMs > REPLAY_WINDOW_MS) {
      return new Response(JSON.stringify({ error: "timestamp_expired", message: "Evento expirado (>5min)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup source config
    const { data: srcConfig } = await supabase
      .from("webhook_sources")
      .select("*")
      .eq("name", eventSource)
      .eq("enabled", true)
      .single();

    let signatureValid = false;
    if (srcConfig?.hmac_secret && signature) {
      // HMAC verification
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(srcConfig.hmac_secret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(body)));
      const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      signatureValid = expected === signature;
    } else if (!srcConfig) {
      // Auto-accept if no source configured (internal events)
      signatureValid = true;
    }

    // Idempotency hash
    const hashInput = `${eventSource}:${eventId}:${JSON.stringify(body.data || {})}`;
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashInput));
    const idempotencyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Build canonical event
    const canonicalEvent = {
      event_id: eventId,
      event_type: body.eventType || body.event_type || "unknown",
      source: eventSource,
      occurred_at: timestamp,
      received_at: new Date().toISOString(),
      actor: body.actor || { type: "system" },
      entity: body.entity || {},
      priority: body.priority || "medium",
      tags: body.tags || [],
      data: sanitizePII(body.data || body),
      meta: {
        schema_version: "v1",
        trace_id: crypto.randomUUID(),
        signature_valid: signatureValid,
        source_config: srcConfig ? "registered" : "auto",
        ...(body.meta || {}),
      },
      status: "received",
      signature_valid: signatureValid,
      idempotency_hash: idempotencyHash,
    };

    // Insert (idempotent — unique constraint on hash)
    const { error: insertErr } = await supabase.from("webhook_events").insert(canonicalEvent);

    if (insertErr) {
      if (insertErr.message?.includes("duplicate") || insertErr.code === "23505") {
        return new Response(JSON.stringify({ accepted: true, deduplicated: true, eventId }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertErr;
    }

    // Also enqueue to openclaw_event_queue for delivery
    await supabase.from("openclaw_event_queue").insert({
      event_id: eventId,
      event_type: canonicalEvent.event_type,
      priority: canonicalEvent.priority,
      domain: body.domain || mapDomain(canonicalEvent.event_type),
      tags: canonicalEvent.tags,
      data: canonicalEvent.data,
      meta: canonicalEvent.meta,
      status: "pending",
    });

    // Audit trail
    await supabase.from("ai_audit_trail").insert({
      event_type: "webhook_received",
      actor_id: eventSource,
      actor_type: "webhook",
      entity_type: canonicalEvent.entity?.type || "event",
      entity_id: eventId,
      action: "ingest",
      details: { event_type: canonicalEvent.event_type, priority: canonicalEvent.priority, signature_valid: signatureValid },
      outcome: "success",
    });

    return new Response(JSON.stringify({ accepted: true, eventId, canonicalType: canonicalEvent.event_type }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[WebhookGateway] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: "ingestion_failed", message: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapDomain(eventType: string): string {
  if (eventType.startsWith("sales.") || eventType.includes("lead") || eventType.includes("deal")) return "sales";
  if (eventType.startsWith("finance.") || eventType.includes("invoice") || eventType.includes("payment")) return "finance";
  if (eventType.startsWith("ops.") || eventType.includes("order") || eventType.includes("task")) return "ops";
  if (eventType.startsWith("support.") || eventType.includes("ticket")) return "support";
  return "general";
}

const PII_FIELDS = ["senha", "password", "cpf", "rg", "token", "api_key", "secret", "credit_card"];
function sanitizePII(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELDS.some(f => key.toLowerCase().includes(f))) {
      clean[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = sanitizePII(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}
