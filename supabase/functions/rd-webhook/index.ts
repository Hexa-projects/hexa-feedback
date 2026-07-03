// RD Station webhook receiver. Public (no JWT). Fast ack + async processing.
import { corsHeaders, serviceRoleClient, logSync } from "../_shared/rd-client.ts";

const ENTITY_MAP: Record<string, string> = {
  crm_deal_created: "rd_deals",
  crm_deal_updated: "rd_deals",
  crm_deal_deleted: "rd_deals",
  crm_contact_created: "rd_contacts",
  crm_contact_updated: "rd_contacts",
  crm_organization_created: "rd_organizations",
  crm_organization_updated: "rd_organizations",
  crm_task_created: "rd_tasks",
  crm_task_updated: "rd_tasks",
  crm_proposal_created: "rd_deals",
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function processEvent(eventId: string, eventType: string, payload: any) {
  const svc = serviceRoleClient();
  try {
    const table = ENTITY_MAP[eventType];
    if (!table) throw new Error(`unknown event_type ${eventType}`);
    const rdId = String(payload?.id ?? payload?._id ?? payload?.deal?.id ?? payload?.contact?.id ?? payload?.organization?.id ?? "");
    if (!rdId) throw new Error("missing rd_id in payload");

    if (eventType === "crm_deal_deleted") {
      await svc.from(table).update({
        deleted_at: new Date().toISOString(),
        sync_status: "deleted",
        raw_payload: payload,
      }).eq("rd_id", rdId);
    } else {
      // Minimal upsert — full re-fetch handled by delta sync.
      await svc.from(table).upsert({
        rd_id: rdId,
        raw_payload: payload,
        rd_updated_at: payload?.updated_at ?? new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        sync_status: "synced",
      }, { onConflict: "rd_id" });
    }

    await svc.from("rd_webhook_events").update({
      status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("id", eventId);
    await logSync(svc, null, table, "info", `webhook ${eventType} processed`, { rd_id: rdId });
  } catch (err) {
    await svc.from("rd_webhook_events").update({
      status: "error",
      error: String((err as Error).message).slice(0, 500),
    }).eq("id", eventId);
    await logSync(svc, null, "webhook", "error", `webhook ${eventType} failed`, { err: String((err as Error).message) });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("ok", { headers: corsHeaders });

  let body: any;
  try { body = await req.json(); } catch { return new Response("ok", { headers: corsHeaders }); }

  const eventType = body?.event_type ?? body?.type ?? "unknown";
  const rdId = String(body?.id ?? body?._id ?? body?.deal?.id ?? body?.contact?.id ?? body?.organization?.id ?? "");
  const updated = body?.updated_at ?? "";
  const eventHash = await sha256(`${eventType}|${rdId}|${updated}|${JSON.stringify(body).slice(0, 2000)}`);

  const svc = serviceRoleClient();
  const { data: inserted, error } = await svc.from("rd_webhook_events").insert({
    event_type: eventType,
    event_hash: eventHash,
    payload: body,
    status: "received",
  }).select("id").maybeSingle();

  // Duplicate → already processed, ack fast.
  if (error || !inserted) return new Response(JSON.stringify({ ok: true, deduped: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  (globalThis as any).EdgeRuntime?.waitUntil(processEvent(inserted.id, eventType, body));
  return new Response(JSON.stringify({ ok: true, id: inserted.id }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
