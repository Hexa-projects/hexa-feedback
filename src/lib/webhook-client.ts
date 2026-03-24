import { supabase } from "@/integrations/supabase/client";

// ── Webhook Client (send events to gateway) ──

export async function sendWebhookEvent(event: {
  eventType: string;
  source?: string;
  priority?: string;
  domain?: string;
  tags?: string[];
  actor?: { id: string; type: string };
  entity?: { type: string; id: string };
  data: Record<string, unknown>;
}): Promise<{ success: boolean; eventId?: string }> {
  const { data, error } = await supabase.functions.invoke("webhook-gateway", {
    body: {
      eventId: crypto.randomUUID(),
      eventType: event.eventType,
      source: event.source || "hexaos-app",
      occurredAt: new Date().toISOString(),
      priority: event.priority || "medium",
      domain: event.domain || "general",
      tags: event.tags || [],
      actor: event.actor || { type: "system" },
      entity: event.entity || {},
      data: event.data,
    },
  });

  if (error) return { success: false };
  return { success: true, eventId: data?.eventId };
}

// ── Action API Client ──

export async function proposeAction(params: {
  action_type: string;
  domain: string;
  title: string;
  description?: string;
  reason: string;
  evidence?: Record<string, unknown>;
  estimated_impact?: string;
  risk_level?: string;
}): Promise<any> {
  const { data, error } = await supabase.functions.invoke("ai-action-api", {
    body: { action: "propose", ...params },
  });
  if (error) return { success: false, message: error.message };
  return data;
}

export async function approveAction(actionId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("ai-action-api", {
    body: { action: "approve", actionId },
  });
  if (error) return { success: false, message: error.message };
  return data;
}

export async function rejectAction(actionId: string, reason?: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("ai-action-api", {
    body: { action: "reject", actionId, reason },
  });
  if (error) return { success: false, message: error.message };
  return data;
}

export async function listPendingActions(): Promise<any[]> {
  const { data, error } = await supabase.functions.invoke("ai-action-api", {
    body: { action: "list_pending" },
  });
  if (error) return [];
  return data?.actions || [];
}

export async function submitFeedback(params: {
  actionId: string;
  decision: "accepted" | "rejected" | "modified" | "ignored";
  outcome?: string;
  score?: number;
  notes?: string;
}): Promise<any> {
  const { data, error } = await supabase.functions.invoke("ai-action-api", {
    body: { action: "feedback", actionId: params.actionId, ...params },
  });
  if (error) return { success: false };
  return data;
}

export async function getLearningStats(): Promise<any> {
  const { data, error } = await supabase.functions.invoke("ai-action-api", {
    body: { action: "learning_stats" },
  });
  if (error) return {};
  return data;
}

export async function getPipelineStats(): Promise<any> {
  const { data, error } = await supabase.functions.invoke("ai-action-api", {
    body: { action: "pipeline_stats" },
  });
  if (error) return {};
  return data;
}
