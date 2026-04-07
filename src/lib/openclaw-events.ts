import { supabase } from "@/integrations/supabase/client";

export type EventPriority = "low" | "medium" | "high" | "critical";
export type EventDomain = "sales" | "finance" | "ops" | "support" | "marketing" | "general";

export interface OpenClawEvent {
  event_type: string;
  priority?: EventPriority;
  domain?: EventDomain;
  tags?: string[];
  data: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

/**
 * Enqueue an event into the openclaw_event_queue for async delivery.
 */
export async function enqueueEvent(event: OpenClawEvent): Promise<string | null> {
  const eventId = crypto.randomUUID();
  const { error } = await supabase.from("openclaw_event_queue" as any).insert({
    event_id: eventId,
    event_type: event.event_type,
    priority: event.priority || "medium",
    domain: event.domain || "general",
    tags: event.tags || [],
    data: sanitizePII(event.data),
    meta: {
      ...(event.meta || {}),
      schema_version: "1.0",
      source: "hexaos",
      env: import.meta.env.MODE || "production",
      enqueued_at: new Date().toISOString(),
    },
    status: "pending",
  } as any);

  if (error) {
    console.error("[OpenClawEvents] Enqueue failed:", error.message);
    return null;
  }
  return eventId;
}

/**
 * Enqueue a batch of events.
 */
export async function enqueueBatch(events: OpenClawEvent[]): Promise<number> {
  const rows = events.map(e => ({
    event_id: crypto.randomUUID(),
    event_type: e.event_type,
    priority: e.priority || "medium",
    domain: e.domain || "general",
    tags: e.tags || [],
    data: sanitizePII(e.data),
    meta: {
      ...(e.meta || {}),
      schema_version: "1.0",
      source: "hexaos",
      env: import.meta.env.MODE || "production",
      enqueued_at: new Date().toISOString(),
    },
    status: "pending",
  }));

  const { error } = await supabase.from("openclaw_event_queue" as any).insert(rows as any);
  if (error) {
    console.error("[OpenClawEvents] Batch enqueue failed:", error.message);
    return 0;
  }
  return rows.length;
}

/**
 * Trigger queue processing via edge function.
 */
export async function triggerSync(): Promise<{ success: boolean; message: string; processed?: number }> {
  const { data, error } = await supabase.functions.invoke("openclaw-sync", {
    body: { action: "process_queue" },
  });
  if (error) return { success: false, message: error.message };
  return data;
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<Record<string, number>> {
  const { data, error } = await supabase.functions.invoke("openclaw-sync", {
    body: { action: "queue_stats" },
  });
  if (error) return { pending: 0, delivered: 0, failed: 0, dlq: 0 };
  return data?.stats || {};
}

/**
 * Reprocess dead-letter queue.
 */
export async function flushDLQ(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("openclaw-sync", {
    body: { action: "flush_dlq" },
  });
  return !error && data?.success;
}

/**
 * Trigger business snapshot collection.
 */
export async function triggerBusinessSnapshot(): Promise<any> {
  const { data, error } = await supabase.functions.invoke("openclaw-data-sync", {
    body: { action: "business_snapshot" },
  });
  if (error) return { success: false, message: error.message };
  return data;
}

/**
 * Trigger data catalog discovery.
 */
export async function triggerCatalogDiscovery(): Promise<any> {
  const { data, error } = await supabase.functions.invoke("openclaw-data-sync", {
    body: { action: "discover_catalog" },
  });
  if (error) return { success: false, message: error.message };
  return data;
}

/**
 * Trigger executive summary generation.
 */
export async function triggerExecutiveSummary(): Promise<any> {
  const { data, error } = await supabase.functions.invoke("openclaw-data-sync", {
    body: { action: "executive_summary" },
  });
  if (error) return { success: false, message: error.message };
  return data;
}

/**
 * Trigger data quality check.
 */
export async function triggerDataQuality(): Promise<any> {
  const { data, error } = await supabase.functions.invoke("openclaw-data-sync", {
    body: { action: "data_quality" },
  });
  if (error) return { success: false, message: error.message };
  return data;
}

// ── Domain-aware event creators ──

export function createSalesEvent(type: string, data: Record<string, unknown>, priority: EventPriority = "medium") {
  return enqueueEvent({ event_type: `sales.${type}`, priority, domain: "sales", tags: ["sales"], data });
}

export function createOpsEvent(type: string, data: Record<string, unknown>, priority: EventPriority = "medium") {
  return enqueueEvent({ event_type: `ops.${type}`, priority, domain: "ops", tags: ["ops"], data });
}

export function createFinanceEvent(type: string, data: Record<string, unknown>, priority: EventPriority = "medium") {
  return enqueueEvent({ event_type: `finance.${type}`, priority, domain: "finance", tags: ["finance"], data });
}

export function createBusinessEvent(type: string, data: Record<string, unknown>, priority: EventPriority = "medium") {
  return enqueueEvent({ event_type: `business.${type}`, priority, domain: "general", tags: ["business"], data });
}

export function createAlertEvent(title: string, details: Record<string, unknown>, domain: EventDomain = "general") {
  return enqueueEvent({
    event_type: "alert",
    priority: "critical",
    domain,
    tags: ["alert", "immediate"],
    data: { title, ...details },
  });
}

export function createMetricsEvent(metrics: Record<string, unknown>) {
  return enqueueEvent({
    event_type: "metrics.snapshot",
    priority: "low",
    domain: "general",
    tags: ["metrics"],
    data: metrics,
  });
}

// ── Retry individual event ──

export async function retryEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from("openclaw_event_queue" as any)
    .update({ status: "pending", attempts: 0, last_error: null, next_retry_at: null } as any)
    .eq("id", eventId);
  if (error) {
    console.error("[OpenClawEvents] Retry failed:", error.message);
    return false;
  }
  return true;
}

// ── PII sanitization ──

const PII_FIELDS = ["senha", "password", "cpf", "rg", "token", "api_key", "secret"];

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
