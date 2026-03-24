import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  try {
    // 1. Load OpenClaw config
    const { data: cfg } = await db.from("focus_ai_config").select("*").limit(1).single();
    if (!cfg || !cfg.openclaw_ativo) {
      return jsonResp({ success: false, error: "disabled", message: "OpenClaw desativado." });
    }

    const baseUrl = (cfg.openclaw_url || "").replace(/\/+$/, "");
    const token = cfg.openclaw_api_key || "";

    if (!baseUrl) {
      return jsonResp({ success: false, error: "no_url", message: "URL do OpenClaw não configurada." });
    }

    // 2. Collect business snapshot
    const [
      leadsRes, proposalsRes, osRes, labRes, bottleRes, sugRes,
      financialRes, projectsRes
    ] = await Promise.all([
      db.from("leads").select("status, valor_estimado, ultimo_contato, nome, empresa", { count: "exact" }),
      db.from("proposals").select("status, valor", { count: "exact" }),
      db.from("work_orders").select("status, urgencia, created_at, sla_horas, numero_os, cliente", { count: "exact" }),
      db.from("lab_parts").select("status", { count: "exact" }),
      db.from("bottlenecks").select("descricao, urgencia, ja_resolveu", { count: "exact" }),
      db.from("suggestions").select("ideia, esforco", { count: "exact" }),
      db.from("financial_records").select("tipo, valor, status, data_vencimento", { count: "exact" }),
      db.from("projects").select("status, prioridade, data_prevista, titulo", { count: "exact" }),
    ]);

    // Build funnel
    const funnel: Record<string, number> = {};
    (leadsRes.data || []).forEach((l: any) => { funnel[l.status] = (funnel[l.status] || 0) + 1; });

    // OS by status
    const osStatus: Record<string, number> = {};
    (osRes.data || []).forEach((o: any) => { osStatus[o.status] = (osStatus[o.status] || 0) + 1; });

    // Financial summary
    const receitas = (financialRes.data || []).filter((f: any) => f.tipo === "receita");
    const despesas = (financialRes.data || []).filter((f: any) => f.tipo === "despesa");
    const totalReceita = receitas.reduce((s: number, f: any) => s + (f.valor || 0), 0);
    const totalDespesa = despesas.reduce((s: number, f: any) => s + (f.valor || 0), 0);
    const inadimplentes = receitas.filter((f: any) => 
      f.status === "pendente" && f.data_vencimento && new Date(f.data_vencimento) < new Date()
    );

    // Pipeline value
    const pipelineValue = (proposalsRes.data || [])
      .filter((p: any) => p.status !== "Cancelado")
      .reduce((s: number, p: any) => s + (p.valor || 0), 0);

    // Stale leads
    const staleLeads = (leadsRes.data || []).filter((l: any) => {
      if (l.status === "Ganho" || l.status === "Perdido") return false;
      if (!l.ultimo_contato) return true;
      return (Date.now() - new Date(l.ultimo_contato).getTime()) > 14 * 86400000;
    }).slice(0, 10);

    // Critical OS
    const criticalOS = (osRes.data || []).filter((o: any) =>
      ["Alta", "Crítica"].includes(o.urgencia) && !["Concluído", "Cancelado"].includes(o.status)
    ).slice(0, 10);

    // Unresolved bottlenecks
    const unresolvedBottlenecks = (bottleRes.data || [])
      .filter((b: any) => !b.ja_resolveu)
      .slice(0, 5);

    // Projects by status
    const projectStatus: Record<string, number> = {};
    (projectsRes.data || []).forEach((p: any) => { projectStatus[p.status] = (projectStatus[p.status] || 0) + 1; });

    // Overdue projects
    const overdueProjects = (projectsRes.data || []).filter((p: any) =>
      p.data_prevista && new Date(p.data_prevista) < new Date() && 
      !["Concluído", "Cancelado"].includes(p.status)
    );

    const businessContext = {
      generated_at: new Date().toISOString(),
      source: "hexaos-auto-analysis",
      kpis: {
        leads_total: leadsRes.count || 0,
        lead_funnel: funnel,
        pipeline_value: pipelineValue,
        proposals_total: proposalsRes.count || 0,
        work_orders_total: osRes.count || 0,
        os_by_status: osStatus,
        critical_os: criticalOS.length,
        lab_parts: labRes.count || 0,
        bottlenecks_open: unresolvedBottlenecks.length,
        suggestions: sugRes.count || 0,
        projects_total: projectsRes.count || 0,
        projects_by_status: projectStatus,
        overdue_projects: overdueProjects.length,
        financeiro: {
          receita_total: totalReceita,
          despesa_total: totalDespesa,
          margem: totalReceita - totalDespesa,
          inadimplentes: inadimplentes.length,
          valor_inadimplente: inadimplentes.reduce((s: number, f: any) => s + (f.valor || 0), 0),
        },
      },
      risks: {
        stale_leads: staleLeads.map((l: any) => ({
          nome: l.nome, empresa: l.empresa, status: l.status,
          days_idle: l.ultimo_contato
            ? Math.round((Date.now() - new Date(l.ultimo_contato).getTime()) / 86400000)
            : "never_contacted",
        })),
        critical_os: criticalOS.map((o: any) => ({
          os: o.numero_os, cliente: o.cliente, urgencia: o.urgencia,
          hours_elapsed: Math.round((Date.now() - new Date(o.created_at).getTime()) / 3600000),
          sla_hours: o.sla_horas,
        })),
        unresolved_bottlenecks: unresolvedBottlenecks.map((b: any) => ({
          descricao: b.descricao, urgencia: b.urgencia,
        })),
        overdue_projects: overdueProjects.map((p: any) => ({
          titulo: p.titulo, data_prevista: p.data_prevista, status: p.status,
        })),
      },
      request: "Analise o contexto de negócio acima. Gere de 3 a 5 insights acionáveis com: titulo, descricao, prioridade (Alta/Média/Baixa), domain (sales/ops/finance/people), acao_recomendada, impacto_estimado. Responda SOMENTE com JSON no formato: { insights: [...] }",
    };

    // 3. Send to OpenClaw for analysis
    console.log("[auto-analysis] Sending business context to OpenClaw...");
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const openclawRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: JSON.stringify(businessContext),
        sessionKey: "hexaos-auto-analysis",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!openclawRes.ok) {
      const errText = await openclawRes.text().catch(() => "");
      console.error(`[auto-analysis] OpenClaw returned ${openclawRes.status}: ${errText.slice(0, 200)}`);
      
      // Still save the snapshot for audit
      await db.from("ai_audit_trail").insert({
        event_type: "auto_analysis",
        action: "analysis_failed",
        actor_type: "system",
        details: { status: openclawRes.status, error: errText.slice(0, 200) },
      });

      return jsonResp({
        success: false,
        error: "openclaw_error",
        message: `OpenClaw retornou ${openclawRes.status}`,
        snapshot_collected: true,
      });
    }

    // 4. Parse OpenClaw response
    const responseText = await openclawRes.text();
    let insights: any[] = [];
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*"insights"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        insights = parsed.insights || [];
      } else {
        // Try direct parse
        const parsed = JSON.parse(responseText);
        if (parsed.response) {
          const innerMatch = parsed.response.match(/\{[\s\S]*"insights"[\s\S]*\}/);
          if (innerMatch) {
            insights = JSON.parse(innerMatch[0]).insights || [];
          }
        }
        if (insights.length === 0 && parsed.insights) {
          insights = parsed.insights;
        }
      }
    } catch (parseErr) {
      console.error("[auto-analysis] Failed to parse insights:", parseErr);
      // Save raw response as a single insight
      insights = [{
        titulo: "Análise do OpenClaw",
        descricao: responseText.slice(0, 1000),
        prioridade: "Média",
        domain: "general",
        acao_recomendada: "Revisar análise manualmente",
        impacto_estimado: "N/A",
      }];
    }

    // 5. Save insights to focus_ai_insights
    const savedInsights: string[] = [];
    for (const insight of insights) {
      const { data: saved, error: saveErr } = await db.from("focus_ai_insights").insert({
        titulo: insight.titulo || "Insight sem título",
        descricao: insight.descricao || "",
        prioridade: insight.prioridade || "Média",
        domain: insight.domain || "general",
        tipo: "auto_analysis",
        acao_recomendada: insight.acao_recomendada || "",
        impacto_estimado: insight.impacto_estimado || "",
        causa_provavel: insight.causa_provavel || "",
        responsavel_sugerido: insight.responsavel_sugerido || "",
        nivel_autonomia: "A",
        status: "pendente",
        evidencia_dados: { source: "auto_analysis", generated_at: new Date().toISOString() },
      }).select("id").single();

      if (saved) savedInsights.push(saved.id);
      if (saveErr) console.error("[auto-analysis] Error saving insight:", saveErr.message);
    }

    // 6. Post summary to corporate channel "geral"
    const { data: geralChannel } = await db.from("corporate_channels")
      .select("id")
      .eq("slug", "geral")
      .limit(1)
      .single();

    if (geralChannel && insights.length > 0) {
      const summaryLines = insights.map((i: any, idx: number) =>
        `${idx + 1}. **[${i.prioridade || "Média"}]** ${i.titulo}\n   ${i.descricao?.slice(0, 150) || ""}\n   → ${i.acao_recomendada || "Sem ação específica"}`
      ).join("\n\n");

      const summaryMessage = `🤖 **Análise Autônoma do Focus AI**\n_${new Date().toLocaleString("pt-BR")}_\n\n${summaryLines}\n\n_${insights.length} insight(s) gerado(s) automaticamente._`;

      // Insert as system/AI message
      await db.from("channel_messages").insert({
        channel_id: geralChannel.id,
        user_id: "00000000-0000-0000-0000-000000000000",
        content: summaryMessage,
        is_ai: true,
        tipo: "texto",
        metadata: { source: "auto_analysis", insights_count: insights.length },
      });
    }

    // 7. Send notifications to all admins
    const { data: adminRoles } = await db.from("user_roles").select("user_id").eq("role", "admin");
    if (adminRoles && adminRoles.length > 0 && insights.length > 0) {
      const notifs = adminRoles.map((r: any) => ({
        user_id: r.user_id,
        titulo: `🤖 ${insights.length} novo(s) insight(s) do Focus AI`,
        mensagem: insights.map((i: any) => `• ${i.titulo}`).join("\n").slice(0, 300),
        tipo: "sistema",
        link: "/focus-ai",
        metadata: { source: "auto_analysis", count: insights.length },
      }));
      await db.from("notifications").insert(notifs);
    }

    // 8. Audit trail
    await db.from("ai_audit_trail").insert({
      event_type: "auto_analysis",
      action: "analysis_completed",
      actor_type: "system",
      details: {
        insights_generated: insights.length,
        insights_saved: savedInsights.length,
        posted_to_channel: !!geralChannel,
        kpis_snapshot: businessContext.kpis,
      },
    });

    console.log(`[auto-analysis] Completed: ${insights.length} insights generated, ${savedInsights.length} saved.`);

    return jsonResp({
      success: true,
      insights_generated: insights.length,
      insights_saved: savedInsights.length,
      posted_to_channel: !!geralChannel,
      insight_ids: savedInsights,
    });

  } catch (err) {
    console.error("[auto-analysis] Error:", err);
    return jsonResp({ success: false, error: "internal", message: "Erro interno na análise autônoma." }, 500);
  }
});
