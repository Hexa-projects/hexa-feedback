import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { fileImportId, fileContent, fileName, fileType } = await req.json();

    if (!fileImportId || !fileContent) {
      return new Response(JSON.stringify({ error: "fileImportId e fileContent são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome, setor, funcao")
      .eq("id", user.id)
      .single();

    const systemPrompt = `Você é um analista de processos corporativos da Hexamedical. Sua tarefa é analisar arquivos Excel/CSV/PowerBI que os colaboradores usam no dia a dia e entender:

1. PROPÓSITO: Qual é o objetivo principal deste arquivo/planilha?
2. ESTRUTURA: Quais são as colunas/métricas/KPIs que ele controla?
3. PROCESSO: Qual processo de negócio ele suporta?
4. SUBSTITUIÇÃO: O HexaOS pode absorver essa funcionalidade? Se sim, em quais módulos?
5. RECOMENDAÇÕES: Como melhorar o processo usando o HexaOS em vez dessa planilha?

Módulos disponíveis no HexaOS:
- CRM & Vendas (leads, funil, propostas)
- Ordens de Serviço (manutenção, agenda técnica)
- Laboratório de Peças (reparo, estoque)
- Financeiro (receita, custos, fluxo de caixa)
- Projetos & Implantação (cronograma, checklist)
- Relatórios & BI (dashboards, KPIs)
- Focus AI (análises autônomas, insights)

CONTEXTO DO USUÁRIO:
- Nome: ${profile?.nome || "N/A"}
- Setor: ${profile?.setor || "N/A"}
- Função: ${profile?.funcao || "N/A"}

Responda em JSON com a seguinte estrutura:
{
  "proposito": "string - descrição clara do propósito do arquivo",
  "estrutura": { "colunas": ["lista de colunas/campos principais"], "metricas": ["KPIs identificados"], "tipo_dados": "string" },
  "recomendacoes": "string - como o HexaOS pode substituir/melhorar isso",
  "pode_substituir": true/false,
  "modulos_hexaos": ["lista de módulos do HexaOS que atendem"],
  "resumo_executivo": "string - resumo em 2-3 frases para o colaborador"
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Analise este arquivo "${fileName}" (tipo: ${fileType}).\n\nConteúdo extraído:\n\`\`\`\n${fileContent.slice(0, 15000)}\n\`\`\``,
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      throw new Error("Erro na análise IA");
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    // Try to parse JSON from response
    let analysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { resumo_executivo: text };
    } catch {
      analysis = { resumo_executivo: text, proposito: text };
    }

    // Update file_imports with analysis
    await supabase.from("file_imports").update({
      status: "analyzed",
      analise_proposito: analysis.proposito || analysis.resumo_executivo,
      analise_estrutura: analysis.estrutura || null,
      analise_recomendacoes: analysis.recomendacoes || analysis.resumo_executivo,
      analise_pode_substituir: analysis.pode_substituir ?? false,
      analise_modulos_hexaos: analysis.modulos_hexaos || [],
    }).eq("id", fileImportId);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-file error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
