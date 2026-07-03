// Shared sync runner used by rd-sync-full and rd-sync-delta.
// Targets RD Station CRM API v1 (crm.rdstation.com/api/v1) with Private Token auth.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { rdPaginate, logSync } from "./rd-client.ts";

const idOf = (o: any) => o?._id ?? o?.id ?? null;
const idStr = (o: any) => {
  const v = idOf(o);
  return v == null ? null : String(v);
};

export const ENTITY_ORDER: Array<{
  entity: string;
  path: string;
  itemsKey?: string;
  table: string;
  supportsDelta?: boolean;
  map: (item: any) => Record<string, unknown>;
}> = [
  { entity: "users", path: "/users", itemsKey: "users", table: "rd_users",
    map: (u) => ({ rd_id: idStr(u), name: u.name ?? u.nickname ?? null, email: u.email ?? null,
      raw_payload: u, rd_created_at: u.created_at ?? null, rd_updated_at: u.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "custom_fields", path: "/custom_fields", itemsKey: "custom_fields", table: "rd_custom_fields",
    map: (c) => ({ rd_id: idStr(c), label: c.label ?? c.name ?? null, type: c.type ?? null,
      for_entity: c.custom_field_related_object ?? c.for ?? c.entity ?? null, raw_payload: c,
      rd_created_at: c.created_at ?? null, rd_updated_at: c.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "pipelines", path: "/deal_pipelines", itemsKey: "deal_pipelines", table: "rd_pipelines",
    map: (p) => ({ rd_id: idStr(p), name: p.name ?? null, raw_payload: p,
      rd_created_at: p.created_at ?? null, rd_updated_at: p.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "stages", path: "/deal_stages", itemsKey: "deal_stages", table: "rd_pipeline_stages",
    map: (s) => ({ rd_id: idStr(s),
      pipeline_rd_id: s.deal_pipeline_id ? String(s.deal_pipeline_id) : (s.deal_pipeline?._id ? String(s.deal_pipeline._id) : null),
      name: s.name ?? null, order: s.order ?? s.nickname ?? null, raw_payload: s,
      rd_created_at: s.created_at ?? null, rd_updated_at: s.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "sources", path: "/deal_sources", itemsKey: "deal_sources", table: "rd_sources",
    map: (s) => ({ rd_id: idStr(s), name: s.name ?? null, raw_payload: s,
      rd_created_at: s.created_at ?? null, rd_updated_at: s.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "lost_reasons", path: "/deal_lost_reasons", itemsKey: "deal_lost_reasons", table: "rd_lost_reasons",
    map: (r) => ({ rd_id: idStr(r), name: r.name ?? null, raw_payload: r,
      rd_created_at: r.created_at ?? null, rd_updated_at: r.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "products", path: "/products", itemsKey: "products", table: "rd_products",
    map: (p) => ({ rd_id: idStr(p), name: p.name ?? null,
      price: p.base_price ?? p.price ?? null, raw_payload: p,
      rd_created_at: p.created_at ?? null, rd_updated_at: p.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "organizations", path: "/organizations", itemsKey: "organizations", table: "rd_organizations",
    map: (o) => ({ rd_id: idStr(o), name: o.name ?? null,
      email: (Array.isArray(o.emails) ? o.emails[0]?.email : o.email) ?? null,
      phone: (Array.isArray(o.phones) ? o.phones[0]?.phone : o.phone) ?? null,
      cnpj: o.cnpj ?? null, raw_payload: o,
      rd_created_at: o.created_at ?? null, rd_updated_at: o.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "contacts", path: "/contacts", itemsKey: "contacts", table: "rd_contacts",
    map: (c) => ({ rd_id: idStr(c), name: c.name ?? null,
      email: Array.isArray(c.emails) ? c.emails[0]?.email ?? null : c.email ?? null,
      phone: Array.isArray(c.phones) ? c.phones[0]?.phone ?? null : c.phone ?? null,
      organization_rd_id: c.organization?._id ? String(c.organization._id) :
        (c.organization?.id ? String(c.organization.id) : (c.organization_id ? String(c.organization_id) : null)),
      raw_payload: c, rd_created_at: c.created_at ?? null, rd_updated_at: c.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "deals", path: "/deals", itemsKey: "deals", table: "rd_deals", supportsDelta: true,
    map: (d) => ({ rd_id: idStr(d), name: d.name ?? null,
      amount_total: d.amount_total ?? null, amount_unique: d.amount_unique ?? null,
      amount_montly: d.amount_montly ?? d.amount_monthly ?? null,
      status: d.dealstage?.type ?? d.deal_stage?.type ?? d.stage_type ?? null,
      pipeline_rd_id: d.deal_pipeline?._id ? String(d.deal_pipeline._id) :
        (d.deal_pipeline_id ? String(d.deal_pipeline_id) : null),
      stage_rd_id: d.deal_stage?._id ? String(d.deal_stage._id) :
        (d.deal_stage_id ? String(d.deal_stage_id) : null),
      user_rd_id: d.user?._id ? String(d.user._id) :
        (d.user_id ? String(d.user_id) : null),
      organization_rd_id: d.organization?._id ? String(d.organization._id) :
        (d.organization_id ? String(d.organization_id) : null),
      contact_rd_id: Array.isArray(d.contacts) && (d.contacts[0]?._id || d.contacts[0]?.id)
        ? String(d.contacts[0]._id ?? d.contacts[0].id) : null,
      source_rd_id: d.deal_source?._id ? String(d.deal_source._id) :
        (d.deal_source_id ? String(d.deal_source_id) : null),
      lost_reason_rd_id: d.deal_lost_reason?._id ? String(d.deal_lost_reason._id) :
        (d.deal_lost_reason_id ? String(d.deal_lost_reason_id) : null),
      win: d.win ?? null, hold: d.hold ?? null,
      closed_at: d.closed_at ?? null, raw_payload: d,
      rd_created_at: d.created_at ?? null, rd_updated_at: d.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },

  { entity: "tasks", path: "/activities", itemsKey: "activities", table: "rd_tasks",
    map: (t) => ({ rd_id: idStr(t), title: t.subject ?? t.title ?? t.text ?? null,
      type: t.type ?? null, status: t.status ?? null, done: t.done ?? null,
      due_at: t.date ?? t.due_date ?? null,
      deal_rd_id: t.deal?._id ? String(t.deal._id) : (t.deal_id ? String(t.deal_id) : null),
      user_rd_id: t.user?._id ? String(t.user._id) : (t.user_id ? String(t.user_id) : null),
      raw_payload: t, rd_created_at: t.created_at ?? null, rd_updated_at: t.updated_at ?? null,
      last_synced_at: new Date().toISOString(), sync_status: "synced", deleted_at: null }) },
];

export async function runSync(
  svc: SupabaseClient,
  jobId: string,
  delta: boolean,
  since: string | null,
) {
  const stats: Record<string, number> = {};
  let hadError = false;
  for (const { entity, path, itemsKey, table, map, supportsDelta } of ENTITY_ORDER) {
    const extraParams: Record<string, string> = {};
    if (delta && since && supportsDelta) extraParams["updated_at_since"] = since;
    let count = 0;
    try {
      // Special case: stages must be fetched per pipeline in RD CRM v1
      // (/deal_stages returns only the default pipeline's stages).
      if (entity === "stages") {
        const { data: pipes } = await svc
          .from("rd_pipelines")
          .select("rd_id")
          .is("deleted_at", null);
        const pipelineIds = (pipes || []).map((p: any) => p.rd_id).filter(Boolean);
        for (const pid of pipelineIds) {
          for await (const page of rdPaginate<any>(svc, path, { deal_pipeline_id: pid }, itemsKey)) {
            const rows = page
              .map((s: any) => ({ ...map(s), pipeline_rd_id: String(pid) }))
              .filter((r: any) => r.rd_id);
            if (rows.length === 0) continue;
            const { error } = await svc.from(table).upsert(rows, { onConflict: "rd_id" });
            if (error) throw error;
            count += rows.length;
          }
        }
      } else {
        for await (const page of rdPaginate<any>(svc, path, extraParams, itemsKey)) {
          const rows = page.map(map).filter((r) => r.rd_id);
          if (rows.length === 0) continue;
          const { error } = await svc.from(table).upsert(rows, { onConflict: "rd_id" });
          if (error) throw error;
          count += rows.length;
        }
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
