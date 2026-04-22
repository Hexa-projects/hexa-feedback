import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FINALIZE_PROMPT = `Você é uma analista sênior de processos. Com base no perfil e processos mapeados abaixo, gere um JSON com:
- summary: resumo executivo de 3-5 frases sobre o colaborador e como ele opera
- key_bottlenecks: array de 3-7 gargalos principais (cada item: {titulo, descricao, impacto})
- key_risks: array de 2-5 riscos operacionais (cada item: {titulo, descricao, severidade: "baixa|media|alta"})
- automation_opportunities: array de 3-7 oportunidades de automação (cada item: {titulo, descricao, esforco: "baixo|medio|alto", impacto_estimado})
- standardization_opportunities: array de 2-5 oportunidades de padronização (cada item: {titulo, descricao})
- ai_confidence: número 0-1 indicando sua confiança no mapeamento

Retorne APENAS JSON válido, sem markdown.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session } = await supabaseAdmin
      .from("onboarding_sessions").select("*").eq("id", session_id).single();
    if (!session || session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("onboarding_profiles").select("*").eq("session_id", session_id).maybeSingle();
    const { data: processes } = await supabaseAdmin
      .from("onboarding_process_maps").select("*").eq("session_id", session_id);

    const userPrompt = `PERFIL:\n${JSON.stringify(profile, null, 2)}\n\nPROCESSOS MAPEADOS:\n${JSON.stringify(processes, null, 2)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: FINALIZE_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const t = await aiResponse.text();
      console.error("OpenAI finalize error:", aiResponse.status, t);
      throw new Error("Erro no provedor de IA");
    }

    const aiJson = await aiResponse.json();
    const insightsRaw = aiJson.choices?.[0]?.message?.content || "{}";
    const insights = JSON.parse(insightsRaw);

    // Insert insights
    await supabaseAdmin.from("onboarding_insights").insert({
      session_id,
      user_id: user.id,
      summary: insights.summary || null,
      key_bottlenecks: insights.key_bottlenecks ?? [],
      key_risks: insights.key_risks ?? [],
      automation_opportunities: insights.automation_opportunities ?? [],
      standardization_opportunities: insights.standardization_opportunities ?? [],
      ai_confidence: insights.ai_confidence ?? null,
    });

    // Mark session complete
    await supabaseAdmin
      .from("onboarding_sessions")
      .update({
        status: "completed",
        current_stage: "completo",
        completion_percentage: 100,
        completed_at: new Date().toISOString(),
      })
      .eq("id", session_id);

    // Mark profile onboarding_completo (legacy compatibility)
    await supabaseAdmin
      .from("profiles")
      .update({ onboarding_completo: true })
      .eq("id", user.id);

    return new Response(
      JSON.stringify({ ok: true, insights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("onboarding-finalize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
