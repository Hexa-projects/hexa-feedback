import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-openclaw-token",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  // Authenticate via token
  const token = req.headers.get("x-openclaw-token") || req.headers.get("authorization")?.replace("Bearer ", "");
  const { data: cfg } = await db.from("focus_ai_config").select("openclaw_api_key, openclaw_ativo").limit(1).single();
  
  if (!cfg?.openclaw_ativo || !cfg.openclaw_api_key || cfg.openclaw_api_key !== token) {
    return jsonResp({ success: false, error: "auth_failed", message: "Token inválido ou OpenClaw desativado." }, 401);
  }

  try {
    const body = await req.json();
    const { action, data } = body;

    // ─── push_insight: OpenClaw sends an insight to save ───
    if (action === "push_insight") {
      const { data: saved, error } = await db.from("focus_ai_insights").insert({
        titulo: data.titulo || "Insight do OpenClaw",
        descricao: data.descricao || "",
        prioridade: data.prioridade || "Média",
        domain: data.domain || "general",
        tipo: data.tipo || "openclaw_push",
        acao_recomendada: data.acao_recomendada || "",
        impacto_estimado: data.impacto_estimado || "",
        causa_provavel: data.causa_provavel || "",
        responsavel_sugerido: data.responsavel_sugerido || "",
        nivel_autonomia: data.nivel_autonomia || "A",
        status: "pendente",
        evidencia_dados: data.evidencia_dados || { source: "openclaw_push" },
      }).select("id").single();

      if (error) return jsonResp({ success: false, error: "db_error", message: error.message }, 500);

      await db.from("ai_audit_trail").insert({
        event_type: "inbound_push",
        action: "push_insight",
        actor_type: "openclaw",
        details: { insight_id: saved?.id, titulo: data.titulo },
      });

      return jsonResp({ success: true, insight_id: saved?.id });
    }

    // ─── push_action: OpenClaw proposes an action ───
    if (action === "push_action") {
      const { data: saved, error } = await db.from("ai_action_requests").insert({
        action_type: data.action_type || "recommendation",
        title: data.title || data.titulo || "Ação do OpenClaw",
        description: data.description || data.descricao || "",
        domain: data.domain || "general",
        reason: data.reason || data.motivo || "Recomendação autônoma do OpenClaw",
        risk_level: data.risk_level || "low",
        estimated_impact: data.estimated_impact || "",
        evidence: data.evidence || {},
        requires_approval: data.requires_approval ?? true,
        autonomy_level: data.autonomy_level || "A",
      }).select("id").single();

      if (error) return jsonResp({ success: false, error: "db_error", message: error.message }, 500);

      await db.from("ai_audit_trail").insert({
        event_type: "inbound_push",
        action: "push_action",
        actor_type: "openclaw",
        details: { action_id: saved?.id, title: data.title || data.titulo },
      });

      return jsonResp({ success: true, action_id: saved?.id });
    }

    // ─── push_message: OpenClaw posts to a corporate channel ───
    if (action === "push_message") {
      const channelSlug = data.channel || "geral";
      const { data: channel } = await db.from("corporate_channels")
        .select("id")
        .eq("slug", channelSlug)
        .limit(1)
        .single();

      if (!channel) {
        return jsonResp({ success: false, error: "channel_not_found", message: `Canal '${channelSlug}' não encontrado.` }, 404);
      }

      const { error } = await db.from("channel_messages").insert({
        channel_id: channel.id,
        user_id: null,
        content: data.content || data.message || "",
        is_ai: true,
        tipo: "texto",
        metadata: { source: "openclaw_push", author: "Focus AI (OpenClaw)", ...(data.metadata || {}) },
      });

      if (error) return jsonResp({ success: false, error: "db_error", message: error.message }, 500);

      await db.from("ai_audit_trail").insert({
        event_type: "inbound_push",
        action: "push_message",
        actor_type: "openclaw",
        details: { channel: channelSlug, content_length: (data.content || "").length },
      });

      return jsonResp({ success: true, channel: channelSlug });
    }

    // ─── push_alert: Critical alert ───
    if (action === "push_alert") {
      // Save as high-priority insight
      const { data: saved } = await db.from("focus_ai_insights").insert({
        titulo: `🚨 ${data.titulo || "Alerta Crítico"}`,
        descricao: data.descricao || "",
        prioridade: "Alta",
        domain: data.domain || "general",
        tipo: "alerta",
        acao_recomendada: data.acao_recomendada || "",
        nivel_autonomia: "A",
        status: "pendente",
      }).select("id").single();

      // Also post to geral channel
      const { data: channel } = await db.from("corporate_channels")
        .select("id").eq("slug", "geral").limit(1).single();
      
      if (channel) {
        await db.from("channel_messages").insert({
          channel_id: channel.id,
          user_id: "00000000-0000-0000-0000-000000000000",
          content: `🚨 **ALERTA: ${data.titulo}**\n\n${data.descricao || ""}\n\n→ ${data.acao_recomendada || "Ação imediata requerida"}`,
          is_ai: true,
          tipo: "texto",
          metadata: { source: "openclaw_alert", priority: "critical" },
        });
      }

      await db.from("ai_audit_trail").insert({
        event_type: "inbound_push",
        action: "push_alert",
        actor_type: "openclaw",
        details: { insight_id: saved?.id, titulo: data.titulo },
      });

      return jsonResp({ success: true, insight_id: saved?.id });
    }

    return jsonResp({
      success: false,
      error: "unknown_action",
      message: "Ações disponíveis: push_insight, push_action, push_message, push_alert",
    }, 400);

  } catch (err) {
    console.error("[openclaw-inbound] Error:", err);
    return jsonResp({ success: false, error: "internal", message: "Erro interno." }, 500);
  }
});
