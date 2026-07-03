// Registers RD Station CRM webhooks pointing at our rd-webhook function.
// Also supports GET to list currently registered webhooks (idempotent).

import { corsHeaders, jsonResponse, requireAdmin, serviceRoleClient, rdFetch } from "../_shared/rd-client.ts";

const EVENTS = [
  "crm_deal_created",
  "crm_deal_updated",
  "crm_deal_deleted",
  "crm_contact_created",
  "crm_contact_updated",
  "crm_organization_created",
  "crm_organization_updated",
  "crm_task_created",
  "crm_task_updated",
  "crm_proposal_created",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const svc = serviceRoleClient();
  const targetUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/rd-webhook`;

  // Fetch existing webhooks
  let existing: any[] = [];
  try {
    const listRes = await rdFetch(svc, "/crm/v2/webhooks");
    if (listRes.ok) {
      const body = await listRes.json();
      existing = Array.isArray(body) ? body : body.webhooks ?? body.data ?? [];
    }
  } catch (err) {
    return jsonResponse({ error: "list_failed", detail: String((err as Error).message).slice(0, 300) }, 502);
  }

  if (req.method === "GET") {
    return jsonResponse({ target: targetUrl, existing });
  }

  const results: any[] = [];
  for (const event of EVENTS) {
    const already = existing.find((w) => (w.url === targetUrl || w.callback_url === targetUrl) &&
      (w.event === event || (Array.isArray(w.events) && w.events.includes(event))));
    if (already) { results.push({ event, status: "exists", id: already.id ?? null }); continue; }

    try {
      const res = await rdFetch(svc, "/crm/v2/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: targetUrl, event, events: [event] }),
      });
      const body = await res.json().catch(() => ({}));
      results.push({ event, status: res.ok ? "created" : "failed", http: res.status, detail: body });
    } catch (err) {
      results.push({ event, status: "failed", detail: String((err as Error).message).slice(0, 300) });
    }
  }

  return jsonResponse({ target: targetUrl, results });
});
