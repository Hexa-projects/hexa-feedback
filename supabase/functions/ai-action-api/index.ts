import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, actionId, ...params } = await req.json();

    switch (action) {
      // ── List pending actions ──
      case "list_pending": {
        const { data } = await supabase
          .from("ai_action_requests")
          .select("*")
          .in("status", ["pending", "approved"])
          .order("created_at", { ascending: false })
          .limit(50);
        return jsonRes({ actions: data || [] });
      }

      // ── Propose action (from Focus AI) ──
      case "propose": {
        const { data: rules } = await supabase
          .from("autonomy_rules")
          .select("*")
          .eq("domain", params.domain)
          .eq("acao", params.action_type)
          .eq("ativo", true)
          .single();

        const requiresApproval = !rules?.permitido || rules?.requer_aprovacao || params.risk_level === "critical";
        const autonomyLevel = rules?.nivel || "A";

        const { data: inserted, error } = await supabase.from("ai_action_requests").insert({
          action_type: params.action_type,
          domain: params.domain,
          title: params.title,
          description: params.description,
          reason: params.reason,
          evidence: params.evidence || {},
          estimated_impact: params.estimated_impact,
          risk_level: params.risk_level || "low",
          requires_approval: requiresApproval,
          autonomy_level: autonomyLevel,
          policy_applied: rules ? `rule:${rules.id}` : "default:require_approval",
          status: requiresApproval ? "pending" : "approved",
        }).select().single();

        if (error) throw error;

        // Audit
        await supabase.from("ai_audit_trail").insert({
          event_type: "action_proposed",
          actor_id: "focus_ai",
          actor_type: "ai",
          entity_type: "action_request",
          entity_id: inserted.id,
          action: params.action_type,
          details: { domain: params.domain, risk: params.risk_level, auto_approved: !requiresApproval },
          policy_applied: inserted.policy_applied,
          outcome: requiresApproval ? "awaiting_approval" : "auto_approved",
        });

        // If auto-approved, execute immediately
        if (!requiresApproval) {
          await executeAction(supabase, inserted);
        }

        return jsonRes({ success: true, action: inserted, auto_executed: !requiresApproval });
      }

      // ── Approve action (human) ──
      case "approve": {
        const { error } = await supabase
          .from("ai_action_requests")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("id", actionId)
          .eq("status", "pending");

        if (error) throw error;

        const { data: act } = await supabase.from("ai_action_requests").select("*").eq("id", actionId).single();
        if (act) await executeAction(supabase, act);

        await supabase.from("ai_audit_trail").insert({
          event_type: "action_approved",
          actor_type: "human",
          entity_type: "action_request",
          entity_id: actionId,
          action: "approve",
          outcome: "approved",
        });

        return jsonRes({ success: true, message: "Ação aprovada e executada." });
      }

      // ── Reject action ──
      case "reject": {
        await supabase.from("ai_action_requests")
          .update({ status: "rejected" })
          .eq("id", actionId);

        await supabase.from("ai_audit_trail").insert({
          event_type: "action_rejected",
          actor_type: "human",
          entity_type: "action_request",
          entity_id: actionId,
          action: "reject",
          details: { reason: params.reason },
          outcome: "rejected",
        });

        return jsonRes({ success: true, message: "Ação rejeitada." });
      }

      // ── Submit feedback ──
      case "feedback": {
        const { error } = await supabase.from("ai_learning_feedback").insert({
          action_request_id: actionId,
          insight_id: params.insight_id || null,
          recommendation_type: params.type,
          decision: params.decision,
          actual_outcome: params.outcome,
          kpi_before: params.kpi_before || {},
          kpi_after: params.kpi_after || {},
          effectiveness_score: params.score,
          feedback_notes: params.notes,
        });

        if (error) throw error;

        await supabase.from("ai_audit_trail").insert({
          event_type: "feedback_submitted",
          actor_type: "human",
          entity_type: "learning_feedback",
          entity_id: actionId,
          action: "feedback",
          details: { decision: params.decision, score: params.score },
          outcome: "recorded",
        });

        return jsonRes({ success: true });
      }

      // ── Learning stats ──
      case "learning_stats": {
        const { data: feedback } = await supabase.from("ai_learning_feedback").select("*");
        const items = feedback || [];
        const total = items.length;
        const accepted = items.filter((f: any) => f.decision === "accepted").length;
        const avgScore = items.reduce((s: number, f: any) => s + (f.effectiveness_score || 0), 0) / (total || 1);

        return jsonRes({
          total_feedback: total,
          acceptance_rate: total > 0 ? (accepted / total * 100).toFixed(1) : "0",
          avg_effectiveness: avgScore.toFixed(2),
          by_decision: {
            accepted,
            rejected: items.filter((f: any) => f.decision === "rejected").length,
            modified: items.filter((f: any) => f.decision === "modified").length,
            ignored: items.filter((f: any) => f.decision === "ignored").length,
          },
        });
      }

      // ── Pipeline stats ──
      case "pipeline_stats": {
        const [webhookRes, queueRes, actionsRes, auditRes] = await Promise.all([
          supabase.from("webhook_events").select("status", { count: "exact" }),
          supabase.from("openclaw_event_queue").select("status", { count: "exact" }),
          supabase.from("ai_action_requests").select("status", { count: "exact" }),
          supabase.from("ai_audit_trail").select("id", { count: "exact", head: true }),
        ]);

        const whEvents = (webhookRes.data || []) as any[];
        const qEvents = (queueRes.data || []) as any[];
        const actions = (actionsRes.data || []) as any[];

        return jsonRes({
          webhook_events: {
            total: whEvents.length,
            received: whEvents.filter((e: any) => e.status === "received").length,
            delivered: whEvents.filter((e: any) => e.status === "delivered").length,
            failed: whEvents.filter((e: any) => e.status === "failed").length,
            dlq: whEvents.filter((e: any) => e.status === "dlq").length,
          },
          event_queue: {
            total: qEvents.length,
            pending: qEvents.filter((e: any) => e.status === "pending").length,
            delivered: qEvents.filter((e: any) => e.status === "delivered").length,
            failed: qEvents.filter((e: any) => e.status === "failed").length,
          },
          actions: {
            total: actions.length,
            pending: actions.filter((a: any) => a.status === "pending").length,
            approved: actions.filter((a: any) => a.status === "approved").length,
            completed: actions.filter((a: any) => a.status === "completed").length,
            rejected: actions.filter((a: any) => a.status === "rejected").length,
          },
          audit_count: auditRes.count || 0,
        });
      }

      default:
        return jsonRes({ error: "unknown_action", message: `Ação '${action}' não reconhecida.` }, 400);
    }
  } catch (error: unknown) {
    console.error("[ActionAPI]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jsonRes({ error: "action_failed", message: msg }, 500);
  }
});

async function executeAction(supabase: any, action: any) {
  try {
    await supabase.from("ai_action_requests")
      .update({ status: "executing", executed_at: new Date().toISOString() })
      .eq("id", action.id);

    // Execute based on domain and action type
    // For now, mark as completed — real execution hooks to be added per domain
    const result = { executed: true, timestamp: new Date().toISOString(), action_type: action.action_type };

    await supabase.from("ai_action_requests")
      .update({ status: "completed", result })
      .eq("id", action.id);

    await supabase.from("ai_audit_trail").insert({
      event_type: "action_executed",
      actor_id: "focus_ai",
      actor_type: "ai",
      entity_type: "action_request",
      entity_id: action.id,
      action: action.action_type,
      details: result,
      policy_applied: action.policy_applied,
      outcome: "completed",
    });
  } catch (err) {
    await supabase.from("ai_action_requests")
      .update({ status: "failed", result: { error: String(err) } })
      .eq("id", action.id);
  }
}

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}
