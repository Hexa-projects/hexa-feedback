import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();

    // Get user profile for personalization
    const { data: profile } = await supabase.from("profiles").select("nome, setor, funcao").eq("id", user.id).single();

    const systemPrompt = `Você é a Assistente IA do HexaOS (Hexamedical), especializada em ajudar colaboradores no dia a dia.

SUAS FUNÇÕES:
- Responder dúvidas sobre processos internos
- Ajudar com preenchimento de formulários e relatórios
- Resumir KPIs e dados visíveis na tela
- Sugerir textos para comunicação interna
- Auxiliar com dúvidas técnicas do setor

REGRAS:
- Sempre responda em português brasileiro
- Seja objetiva, profissional e amigável
- Não execute ações críticas — apenas sugira
- Se não souber algo, indique quem pode ajudar
- Use formatação markdown quando apropriado

${profile ? `CONTEXTO DO USUÁRIO:
- Nome: ${profile.nome}
- Setor: ${profile.setor}
- Função: ${profile.funcao || 'não definida'}` : ''}

${context ? `CONTEXTO DA TELA ATUAL:\n${context}` : ''}`;

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na API Anthropic" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Anthropic SSE to OpenAI-compatible SSE format
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      try {
        const reader = response.body!.getReader();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);

            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;

            try {
              const event = JSON.parse(json);
              if (event.type === "content_block_delta" && event.delta?.text) {
                // Convert to OpenAI SSE format
                const openaiEvent = {
                  choices: [{ delta: { content: event.delta.text } }],
                };
                await writer.write(encoder.encode(`data: ${JSON.stringify(openaiEvent)}\n\n`));
              } else if (event.type === "message_stop") {
                await writer.write(encoder.encode("data: [DONE]\n\n"));
              }
            } catch { /* partial json */ }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("anthropic-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
