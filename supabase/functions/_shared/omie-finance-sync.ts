import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  acquireOmieLock,
  getItems,
  normalizeForTarget,
  OMIE_FINANCE_ENDPOINTS,
  omieFetch,
  releaseOmieLock,
  sanitizePayload,
  sha256,
  type OmieEndpoint,
} from "./omie-client.ts";

type SyncOptions = {
  delta?: boolean;
  onlyMethod?: string | null;
};

const PAGE_SIZE = 50;
const MAX_PAGES_PER_ENDPOINT = 200;

export async function runOmieFinanceSync(
  svc: SupabaseClient,
  jobId: string,
  options: SyncOptions = {},
) {
  const endpoints = options.onlyMethod
    ? OMIE_FINANCE_ENDPOINTS.filter((e) => e.method === options.onlyMethod)
    : OMIE_FINANCE_ENDPOINTS;

  const totals = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0, pages: 0 };

  try {
    for (const endpoint of endpoints) {
      const stats = await syncEndpoint(svc, jobId, endpoint, options);
      totals.processed += stats.processed;
      totals.created += stats.created;
      totals.updated += stats.updated;
      totals.skipped += stats.skipped;
      totals.errors += stats.errors;
      totals.pages += stats.pages;
    }

    await svc.from("omie_sync_jobs").update({
      status: totals.errors > 0 ? "completed_with_errors" : "completed",
      finished_at: new Date().toISOString(),
      total_pages: totals.pages,
      processed_count: totals.processed,
      created_count: totals.created,
      updated_count: totals.updated,
      skipped_count: totals.skipped,
      error_count: totals.errors,
      stats: totals,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (error) {
    const nextRetryAt = error?.cooldownSeconds
      ? new Date(Date.now() + error.cooldownSeconds * 1000).toISOString()
      : null;
    await svc.from("omie_sync_jobs").update({
      status: nextRetryAt ? "waiting_cooldown" : "failed",
      finished_at: nextRetryAt ? null : new Date().toISOString(),
      next_retry_at: nextRetryAt,
      error_count: totals.errors + 1,
      error_summary: error?.faultstring ?? error?.message ?? "omie_sync_failed",
      error: {
        faultcode: error?.faultcode ?? "SYNC_ABORTED",
        faultstring: error?.faultstring ?? error?.message ?? "omie_sync_failed",
        cooldown_seconds: error?.cooldownSeconds ?? null,
      },
      stats: totals,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

async function syncEndpoint(
  svc: SupabaseClient,
  jobId: string,
  endpoint: OmieEndpoint,
  _options: SyncOptions,
) {
  const stats = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0, pages: 0 };

  for (let page = 1; page <= MAX_PAGES_PER_ENDPOINT; page += 1) {
    const param = {
      pagina: page,
      registros_por_pagina: PAGE_SIZE,
      apenas_importado_api: "N",
    };
    const payloadHash = await sha256(JSON.stringify({ endpoint: endpoint.endpoint, method: endpoint.method, param }));
    const lock = await acquireOmieLock(svc, jobId, endpoint.endpoint, endpoint.method, payloadHash, 90);

    if (!lock.acquired) {
      await recordCooldownEvent(svc, jobId, endpoint, payloadHash, lock.lockedUntil);
      stats.skipped += 1;
      await svc.from("omie_sync_jobs").update({
        status: "waiting_cooldown",
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        next_retry_at: lock.lockedUntil,
        error_summary: "Sync redundante bloqueada pelo HexaOS antes de chamar o Omie.",
        error: {
          faultcode: "LOCAL_LOCK_ACTIVE",
          faultstring: "Existe uma sincronizacao recente/ativa para o mesmo endpoint, metodo e payload.",
        },
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
      break;
    }

    try {
      await svc.from("omie_sync_jobs").update({
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        status: "running",
        attempts: page,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      const body = await omieFetch(endpoint.endpoint, endpoint.method, param);
      const items = getItems(body, endpoint.itemsKey);
      stats.pages += 1;
      stats.processed += items.length;

      for (const item of items) {
        const normalized = normalizeForTarget(endpoint.targetTable, item);
        if (!normalized.omie_id) {
          stats.skipped += 1;
          continue;
        }
        const { error } = await svc
          .from(endpoint.targetTable)
          .upsert(normalized, { onConflict: "omie_id" });
        if (error) {
          stats.errors += 1;
          await svc.from("omie_sync_events").insert({
            job_id: jobId,
            entity_type: endpoint.entityType,
            entity_id: normalized.omie_id,
            endpoint: endpoint.endpoint,
            method: endpoint.method,
            payload_hash: payloadHash,
            status: "error",
            faultcode: "UPSERT_FAILED",
            faultstring: error.message,
            sanitized_payload: sanitizePayload({ param }),
          });
        } else {
          stats.updated += 1;
        }
      }

      await svc.from("omie_sync_events").insert({
        job_id: jobId,
        entity_type: endpoint.entityType,
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        payload_hash: payloadHash,
        status: "success",
        attempts: page,
        sanitized_payload: sanitizePayload({ param }),
        raw_response: {
          page,
          count: items.length,
          total_de_paginas: body?.total_de_paginas ?? body?.total_paginas ?? null,
        },
      });

      const totalPages = Number(body?.total_de_paginas ?? body?.total_paginas ?? 0);
      if (items.length < PAGE_SIZE || (totalPages > 0 && page >= totalPages)) break;
    } catch (error) {
      stats.errors += 1;
      const cooldownSeconds = error?.cooldownSeconds ?? null;
      const nextRetryAt = cooldownSeconds ? new Date(Date.now() + cooldownSeconds * 1000).toISOString() : null;
      await svc.from("omie_sync_events").insert({
        job_id: jobId,
        entity_type: endpoint.entityType,
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        payload_hash: payloadHash,
        status: cooldownSeconds ? "waiting_cooldown" : "error",
        attempts: page,
        next_retry_at: nextRetryAt,
        faultcode: error?.faultcode ?? "SYNC_ABORTED",
        faultstring: error?.faultstring ?? error?.message ?? "omie_request_failed",
        sanitized_payload: sanitizePayload({ param }),
        raw_response: error?.raw ?? null,
      });
      if (cooldownSeconds) {
        await svc.from("omie_sync_jobs").update({
          status: "waiting_cooldown",
          next_retry_at: nextRetryAt,
          attempts: page,
          error_summary: error?.faultstring ?? error?.message,
          error: {
            faultcode: error?.faultcode ?? "REDUNDANT",
            faultstring: error?.faultstring ?? error?.message,
            cooldown_seconds: cooldownSeconds,
          },
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);
        return stats;
      }
      throw error;
    } finally {
      await releaseOmieLock(svc, lock.lockKey, jobId);
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  return stats;
}

async function recordCooldownEvent(
  svc: SupabaseClient,
  jobId: string,
  endpoint: OmieEndpoint,
  payloadHash: string,
  lockedUntil: string | null,
) {
  await svc.from("omie_sync_events").insert({
    job_id: jobId,
    entity_type: endpoint.entityType,
    endpoint: endpoint.endpoint,
    method: endpoint.method,
    payload_hash: payloadHash,
    status: "waiting_cooldown",
    next_retry_at: lockedUntil,
    faultcode: "LOCAL_LOCK_ACTIVE",
    faultstring: "Chamada redundante bloqueada localmente antes de consumir a API Omie.",
    sanitized_payload: {},
  });
}
