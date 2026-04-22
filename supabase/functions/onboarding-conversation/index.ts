import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a **Maya**, consultora sênior de processos da Hexamedical, especializada em ISO 9001.

Sua missão: conduzir uma entrevista CONVERSACIONAL e ACOLHEDORA com um colaborador para mapear:
- Perfil (setor, função, unidade, tempo de casa)
- Rotina e responsabilidades
- Processos críticos (objetivo, entradas, saídas, ferramentas, riscos, controles, melhorias)
- Gargalos e oportunidades de automação

REGRAS DE OURO:
1. Fale como gente — natural, curta, calorosa. Nunca robótica.
2. UMA pergunta por vez. No máximo duas se forem complementares.
3. Comece se apresentando brevemente e perguntando o nome/função.
4. Após cada resposta, valide o que entendeu em uma frase curta antes da próxima pergunta.
5. NUNCA mencione "ISO 9001" ou jargão técnico ao colaborador.
6. Detecte lacunas e faça perguntas de aprofundamento naturais (ex: "E quando isso dá errado, o que costuma acontecer?").
7. Quando identificar um processo, capture: objetivo, frequência, entradas, saídas, ferramentas, riscos, controles, oportunidades de melhoria.
8. A cada 3-4 trocas, faça um mini-resumo: "Deixa eu confirmar o que entendi até aqui...".
9. Quando sentir que mapeou o essencial (perfil + 2-3 processos + gargalos), sinalize completion=true e finalize com um resumo gentil.

SEMPRE chame a tool 'update_onboarding_state' a cada mensagem para registrar o que aprendeu.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "update_onboarding_state",
    description: "Registra o estado estruturado do onboarding após interpretar a resposta do colaborador",
    parameters: {
      type: "object",
      properties: {
        assistant_message: {
          type: "string",
          description: "Mensagem natural e calorosa para enviar ao colaborador (em português BR)",
        },
        profile_updates: {
          type: "object",
          description: "Atualizações ao perfil do colaborador",
          properties: {
            setor: { type: "string" },
            funcao: { type: "string" },
            unidade: { type: "string" },
            tempo_casa: { type: "string" },
            responsabilidades: { type: "string" },
            resumo_geral: { type: "string" },
          },
        },
        processes_extracted: {
          type: "array",
          description: "Processos identificados nesta conversa (faça upsert por process_name)",
          items: {
            type: "object",
            properties: {
              process_name: { type: "string" },
              process_category: {
                type: "string",
                enum: ["operacional", "administrativo", "comercial", "suporte", "técnico", "estratégico"],
              },
              objective: { type: "string" },
              frequency: { type: "string" },
              description: { type: "string" },
              inputs: { type: "array", items: { type: "string" } },
              outputs: { type: "array", items: { type: "string" } },
              tools: { type: "array", items: { type: "string" } },
              dependencies: { type: "array", items: { type: "string" } },
              risks: { type: "array", items: { type: "string" } },
              controls: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              indicators: { type: "array", items: { type: "string" } },
              owner_name: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["process_name"],
          },
        },
        missing_fields: {
          type: "array",
          description: "Lacunas que ainda precisam ser preenchidas",
          items: { type: "string" },
        },
        progress_percent: {
          type: "number",
          description: "Percentual de completude do onboarding (0-100)",
          minimum: 0,
          maximum: 100,
        },
        current_stage: {
          type: "string",
          enum: ["intro", "perfil", "rotina", "processos", "gargalos", "revisao", "completo"],
        },
        completion_ready: {
          type: "boolean",
          description: "true quando há informação suficiente para finalizar",
        },
      },
      required: ["assistant_message", "progress_percent", "current_stage", "completion_ready"],
    },
  },
};

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

    const body = await req.json();
    const userMessage: string = (body.message || "").toString().trim();
    let sessionId: string | null = body.session_id || null;

    // Get or create active session
    if (!sessionId) {
      const { data: existing } = await supabaseAdmin
        .from("onboarding_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        sessionId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin
          .from("onboarding_sessions")
          .insert({ user_id: user.id, status: "active", current_stage: "intro", completion_percentage: 0 })
          .select("id")
          .single();
        if (createErr) throw createErr;
        sessionId = created.id;
      }
    }

    // Load history
    const { data: history } = await supabaseAdmin
      .from("onboarding_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(40);

    // Load current structured state
    const { data: profileRow } = await supabaseAdmin
      .from("onboarding_profiles")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    const { data: processRows } = await supabaseAdmin
      .from("onboarding_process_maps")
      .select("process_name, process_category, objective")
      .eq("session_id", sessionId);

    const stateContext = `\n\nESTADO ATUAL DO ONBOARDING:\nPerfil: ${JSON.stringify(profileRow ?? {})}\nProcessos já mapeados: ${JSON.stringify(processRows ?? [])}`;

    // Persist user message (only if not empty — empty means "kickoff")
    if (userMessage) {
      await supabaseAdmin.from("onboarding_messages").insert({
        session_id: sessionId,
        user_id: user.id,
        role: "user",
        content: userMessage,
        message_type: "text",
      });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + stateContext },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];
    if (userMessage) messages.push({ role: "user", content: userMessage });
    else if (!history || history.length === 0) {
      messages.push({ role: "user", content: "[Início da sessão — apresente-se e comece a entrevista]" });
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "update_onboarding_state" } },
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Aguarde um instante." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro no provedor de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResponse.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("IA não retornou tool call estruturado");
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    const assistantMessage: string = extracted.assistant_message || "Pode me contar mais?";

    // Persist assistant message
    await supabaseAdmin.from("onboarding_messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: assistantMessage,
      message_type: extracted.completion_ready ? "summary" : "question",
      extracted_payload: extracted,
    });

    // Upsert profile
    if (extracted.profile_updates && Object.keys(extracted.profile_updates).length > 0) {
      const existingProfile = profileRow || {};
      const merged: Record<string, any> = {
        session_id: sessionId,
        user_id: user.id,
        ...existingProfile,
        ...Object.fromEntries(
          Object.entries(extracted.profile_updates).filter(([_, v]) => v != null && v !== "")
        ),
      };
      delete merged.id;
      delete merged.created_at;
      delete merged.updated_at;

      if (profileRow) {
        await supabaseAdmin.from("onboarding_profiles").update(merged).eq("session_id", sessionId);
      } else {
        await supabaseAdmin.from("onboarding_profiles").insert(merged);
      }
    }

    // Upsert processes (by session_id + process_name)
    if (Array.isArray(extracted.processes_extracted)) {
      for (const proc of extracted.processes_extracted) {
        if (!proc.process_name) continue;
        const { data: existingProc } = await supabaseAdmin
          .from("onboarding_process_maps")
          .select("id")
          .eq("session_id", sessionId)
          .eq("process_name", proc.process_name)
          .maybeSingle();

        const payload = {
          session_id: sessionId,
          user_id: user.id,
          process_name: proc.process_name,
          process_category: proc.process_category ?? null,
          objective: proc.objective ?? null,
          frequency: proc.frequency ?? null,
          description: proc.description ?? null,
          inputs_json: proc.inputs ?? [],
          outputs_json: proc.outputs ?? [],
          tools_json: proc.tools ?? [],
          dependencies_json: proc.dependencies ?? [],
          risks_json: proc.risks ?? [],
          controls_json: proc.controls ?? [],
          improvements_json: proc.improvements ?? [],
          indicators_json: proc.indicators ?? [],
          owner_name: proc.owner_name ?? null,
          confidence: proc.confidence ?? null,
        };

        if (existingProc) {
          await supabaseAdmin.from("onboarding_process_maps").update(payload).eq("id", existingProc.id);
        } else {
          await supabaseAdmin.from("onboarding_process_maps").insert(payload);
        }
      }
    }

    // Update session
    await supabaseAdmin
      .from("onboarding_sessions")
      .update({
        current_stage: extracted.current_stage ?? "perfil",
        completion_percentage: Math.min(100, Math.max(0, extracted.progress_percent ?? 0)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    // Snapshot every ~5 messages
    const msgCount = (history?.length ?? 0) + 2;
    if (msgCount % 5 === 0) {
      await supabaseAdmin.from("onboarding_response_snapshots").insert({
        session_id: sessionId,
        structured_state: { profile: profileRow, processes: processRows, last_extraction: extracted },
      });
    }

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        assistant_message: assistantMessage,
        progress: extracted.progress_percent ?? 0,
        current_stage: extracted.current_stage ?? "perfil",
        missing_fields: extracted.missing_fields ?? [],
        completion_ready: !!extracted.completion_ready,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("onboarding-conversation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
