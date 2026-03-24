import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { tipo, conteudo, contexto } = await req.json();

    const systemPrompts: Record<string, string> = {
      gargalo: `Você é um analista de processos da Hexamedical. O colaborador reportou um gargalo/problema. Gere exatamente 3 perguntas objetivas e curtas (máximo 1 frase cada) para esclarecer a causa raiz, o impacto real e possíveis soluções. Foque em dados concretos: frequência, tempo perdido, custo, pessoas afetadas. Responda APENAS com um JSON array de 3 strings.`,
      processo: `Você é um analista de processos da Hexamedical. O colaborador descreveu um processo repetitivo. Gere exatamente 3 perguntas objetivas e curtas para entender melhor: qual parte é mais manual, quais erros acontecem, e qual seria o ganho com automação. Responda APENAS com um JSON array de 3 strings.`,
      sugestao: `Você é um analista de processos da Hexamedical. O colaborador fez uma sugestão de melhoria. Gere exatamente 3 perguntas objetivas e curtas para aprofundar: viabilidade, escopo do impacto, e prioridade. Responda APENAS com um JSON array de 3 strings.`,
    };

    const systemPrompt = systemPrompts[tipo];
    if (!systemPrompt) throw new Error("Tipo inválido: " + tipo);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Conteúdo reportado:\n${conteudo}\n\n${contexto ? `Contexto adicional: ${contexto}` : ""}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido, tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    let perguntas: string[];
    try {
      perguntas = JSON.parse(content);
      if (!Array.isArray(perguntas)) throw new Error("Not array");
    } catch {
      // Try to extract from markdown code block
      const match = content.match(/\[[\s\S]*\]/);
      perguntas = match ? JSON.parse(match[0]) : [content];
    }

    return new Response(JSON.stringify({ perguntas: perguntas.slice(0, 3) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-lapidacao error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
