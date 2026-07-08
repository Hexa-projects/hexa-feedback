import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getJwtUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

function buildFocusPrompt(args: {
  userMessage: string;
  scope: string;
  jobType: string;
  contextPackage: Record<string, unknown>;
}) {
  return [
    "Voce e o Focus AI, o cerebro operacional do HexaOS da Hexamedical.",
    "Responda em portugues brasileiro, com objetividade, rastreabilidade e foco em execucao.",
    "Use as skills instaladas na VPS quando aplicavel: minha-marca, especialista-rm-esaote-completo, careverse-digitaldoc e skills tecnicas do Codex.",
    "Voce pode analisar dados, processos e gargalos, mas nao deve executar acoes destrutivas sem registrar plano, risco e necessidade de aprovacao humana.",
    "Nunca invente dados. Quando faltar informacao, diga exatamente o que falta e proponha como coletar.",
    "Priorize eficiencia de tokens: use o contexto recebido, resuma antes de expandir e evite repetir bases inteiras.",
    "",
    `Tipo do job: ${args.jobType}`,
    `Escopo: ${args.scope}`,
    "",
    "Pedido do usuario:",
    args.userMessage || "Sincronize e assimile o contexto operacional do HexaOS.",
    "",
    "Contexto HexaOS autorizado:",
    JSON.stringify(args.contextPackage, null, 2),
    "",
    "Formato de retorno esperado:",
    JSON.stringify({
      answer: "resposta principal em markdown curto",
      insights: ["insights relevantes"],
      suggested_actions: [
        {
          title: "acao sugerida",
          domain: "sales|ops|finance|quality|stock|lab|general",
          risk_level: "low|medium|high|critical",
          requires_approval: true,
        },
      ],
      memory_updates: ["aprendizados operacionais que devem ser preservados"],
    }, null, 2),
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    if (action === "create_job") {
      const user = await getJwtUser(req);
      if (!user) return json({ error: "unauthenticated" }, 401);

      const contextPackage = body?.context_package && typeof body.context_package === "object" ? body.context_package : {};
      const userMessage = String(body?.message || body?.user_message || "").slice(0, 20000);
      const jobType = String(body?.job_type || "chat");
      const scope = String(body?.scope || "general").slice(0, 80);
      const title = String(body?.title || userMessage || "Focus AI job").slice(0, 160);
      const shareToken = randomToken();
      const shareTokenHash = await sha256(shareToken);
      const codexPrompt = buildFocusPrompt({ userMessage, scope, jobType, contextPackage });

      const { data: job, error } = await admin
        .from("focus_ai_codex_jobs")
        .insert({
          user_id: user.id,
          job_type: jobType,
          title,
          status: "pending",
          scope,
          user_message: userMessage,
          codex_prompt: codexPrompt,
          context_package: contextPackage,
          share_token_hash: shareTokenHash,
        })
        .select("id, user_id, job_type, title, status, scope, user_message, context_package, result, output_text, error, created_at, updated_at")
        .single();

      if (error) throw error;
      return json({ ok: true, job, share_token: shareToken, dispatch_payload: { job_id: job.id, share_token: shareToken } });
    }

    if (action === "get_job" || action === "submit_result") {
      const jobId = String(body?.job_id || "");
      const shareToken = String(body?.share_token || "");
      if (!jobId || !shareToken) return json({ error: "job_id_and_share_token_required" }, 400);

      const { data: job, error: jobError } = await admin
        .from("focus_ai_codex_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (jobError) throw jobError;
      if (!job) return json({ error: "job_not_found" }, 404);
      if (job.share_token_hash !== await sha256(shareToken)) return json({ error: "invalid_share_token" }, 403);

      if (action === "get_job") {
        await admin
          .from("focus_ai_codex_jobs")
          .update({ status: "running", fetched_at: new Date().toISOString() })
          .eq("id", job.id)
          .in("status", ["pending", "running"]);

        return json({
          ok: true,
          job: {
            id: job.id,
            job_type: job.job_type,
            title: job.title,
            status: job.status === "pending" ? "running" : job.status,
            scope: job.scope,
            user_message: job.user_message,
            context_package: job.context_package,
            codex_prompt: job.codex_prompt,
            created_at: job.created_at,
          },
        });
      }

      const requestedStatus = String(body?.status || "completed");
      const safeStatus = requestedStatus === "failed" ? "failed" : "completed";
      const result = body?.result && typeof body.result === "object" ? body.result : {};
      const outputText = String(body?.output_text || body?.answer || result?.answer || "").slice(0, 200000);
      const error = safeStatus === "failed" ? String(body?.error || "Falha reportada pelo Codex VPS") : null;

      await admin
        .from("focus_ai_codex_jobs")
        .update({
          status: safeStatus,
          result,
          output_text: outputText,
          error,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return json({ ok: true, status: safeStatus });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("focus-codex-bridge error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
