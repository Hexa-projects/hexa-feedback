import { corsHeaders, jsonResponse, requireAdmin, serviceRoleClient, rdPaginate, logSync } from "../_shared/rd-client.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Entity → { path, mapper(rdItem) => row for public.<table> }
const ENTITY_ORDER: Array<{
  entity: string;
  path: string;
  table: string;
  map: (item: any) => Record<string, unknown>;
}> = [
  { entity: "users", path: "/crm/v2/users", table: "rd_users",
    map: (u) => ({ rd_id: String(u.id ?? u._id), name: u.name ?? null, email: u.email ?? null,
      raw_payload: u, rd_created_at: u.created_at ?? null, rd_updated_at: u.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "custom_fields", path: "/crm/v2/custom_fields", table: "rd_custom_fields",
    map: (c) => ({ rd_id: String(c.id ?? c._id), label: c.label ?? null, type: c.type ?? null,
      for_entity: c.for ?? c.entity ?? null, raw_payload: c,
      rd_created_at: c.created_at ?? null, rd_updated_at: c.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "pipelines", path: "/crm/v2/deal_pipelines", table: "rd_pipelines",
    map: (p) => ({ rd_id: String(p.id ?? p._id), name: p.name ?? null, raw_payload: p,
      rd_created_at: p.created_at ?? null, rd_updated_at: p.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "stages", path: "/crm/v2/deal_stages", table: "rd_pipeline_stages",
    map: (s) => ({ rd_id: String(s.id ?? s._id),
      pipeline_rd_id: s.deal_pipeline_id ? String(s.deal_pipeline_id) : (s.pipeline_id ? String(s.pipeline_id) : null),
      name: s.name ?? null, order: s.order ?? null, raw_payload: s,
      rd_created_at: s.created_at ?? null, rd_updated_at: s.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "sources", path: "/crm/v2/deal_sources", table: "rd_sources",
    map: (s) => ({ rd_id: String(s.id ?? s._id), name: s.name ?? null, raw_payload: s,
      rd_created_at: s.created_at ?? null, rd_updated_at: s.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "lost_reasons", path: "/crm/v2/deal_lost_reasons", table: "rd_lost_reasons",
    map: (r) => ({ rd_id: String(r.id ?? r._id), name: r.name ?? null, raw_payload: r,
      rd_created_at: r.created_at ?? null, rd_updated_at: r.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "products", path: "/crm/v2/products", table: "rd_products",
    map: (p) => ({ rd_id: String(p.id ?? p._id), name: p.name ?? null,
      price: p.base_price ?? p.price ?? null, raw_payload: p,
      rd_created_at: p.created_at ?? null, rd_updated_at: p.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "organizations", path: "/crm/v2/organizations", table: "rd_organizations",
    map: (o) => ({ rd_id: String(o.id ?? o._id), name: o.name ?? null,
      email: o.email ?? null, phone: o.phone ?? null, cnpj: o.cnpj ?? null, raw_payload: o,
      rd_created_at: o.created_at ?? null, rd_updated_at: o.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "contacts", path: "/crm/v2/contacts", table: "rd_contacts",
    map: (c) => ({ rd_id: String(c.id ?? c._id), name: c.name ?? null,
      email: Array.isArray(c.emails) ? c.emails[0]?.email ?? null : c.email ?? null,
      phone: Array.isArray(c.phones) ? c.phones[0]?.phone ?? null : c.phone ?? null,
      organization_rd_id: c.organization?.id ? String(c.organization.id) : (c.organization_id ? String(c.organization_id) : null),
      raw_payload: c, rd_created_at: c.created_at ?? null, rd_updated_at: c.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "deals", path: "/crm/v2/deals", table: "rd_deals",
    map: (d) => ({ rd_id: String(d.id ?? d._id), name: d.name ?? null,
      amount_total: d.amount_total ?? null, amount_unique: d.amount_unique ?? null,
      amount_montly: d.amount_montly ?? d.amount_monthly ?? null,
      status: d.dealstage?.type ?? d.stage_type ?? null,
      pipeline_rd_id: d.deal_pipeline?.id ? String(d.deal_pipeline.id) : (d.pipeline_id ? String(d.pipeline_id) : null),
      stage_rd_id: d.deal_stage?.id ? String(d.deal_stage.id) : (d.stage_id ? String(d.stage_id) : null),
      user_rd_id: d.user?.id ? String(d.user.id) : (d.user_id ? String(d.user_id) : null),
      organization_rd_id: d.organization?.id ? String(d.organization.id) : (d.organization_id ? String(d.organization_id) : null),
      contact_rd_id: Array.isArray(d.contacts) && d.contacts[0]?.id ? String(d.contacts[0].id) : null,
      source_rd_id: d.deal_source?.id ? String(d.deal_source.id) : null,
      lost_reason_rd_id: d.deal_lost_reason?.id ? String(d.deal_lost_reason.id) : null,
      win: d.win ?? null, hold: d.hold ?? null,
      closed_at: d.closed_at ?? null, raw_payload: d,
      rd_created_at: d.created_at ?? null, rd_updated_at: d.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
  { entity: "tasks", path: "/crm/v2/tasks", table: "rd_tasks",
    map: (t) => ({ rd_id: String(t.id ?? t._id), title: t.subject ?? t.title ?? null,
      type: t.type ?? null, status: t.status ?? null, done: t.done ?? null,
      due_at: t.date ?? t.due_date ?? null,
      deal_rd_id: t.deal?.id ? String(t.deal.id) : (t.deal_id ? String(t.deal_id) : null),
      user_rd_id: t.user?.id ? String(t.user.id) : (t.user_id ? String(t.user_id) : null),
      raw_payload: t, rd_created_at: t.created_at ?? null, rd_updated_at: t.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
];

async function runSync(svc: SupabaseClient, jobId: string, delta: boolean, since: string | null) {
  const stats: Record<string, number> = {};
  let hadError = false;
  for (const { entity, path, table, map } of ENTITY_ORDER) {
    const extraParams: Record<string, string> = {};
    if (delta && since) extraParams["updated_at_period[start]"] = since;
    let count = 0;
    try {
      for await (const page of rdPaginate<any>(svc, path, extraParams)) {
        const rows = page.map(map).filter((r) => r.rd_id);
        if (rows.length === 0) continue;
        const { error } = await svc.from(table).upsert(rows, { onConflict: "rd_id" });
        if (error) throw error;
        count += rows.length;
      }
      stats[entity] = count;
      await logSync(svc, jobId, entity, "info", `Imported ${count} ${entity}`);
    } catch (err) {
      hadError = true;
      stats[entity] = count;
      await logSync(svc, jobId, entity, "error", String((err as Error).message).slice(0, 500));
    }
  }

  await svc.from("rd_sync_jobs").update({
    status: hadError ? "partial" : "success",
    finished_at: new Date().toISOString(),
    stats,
  }).eq("id", jobId);

  const patch: Record<string, string> = {};
  const now = new Date().toISOString();
  if (delta) patch["last_delta_sync_at"] = now;
  else { patch["last_full_sync_at"] = now; patch["last_delta_sync_at"] = now; }
  await svc.from("crm_integrations").update(patch).eq("provider", "rd_station");
}

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
