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

async function countRows(client: any, table: string) {
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
  return { table, count: error ? null : count, error: error?.message ?? null };
}

function buildPrompt(contextPackage: Record<string, unknown>) {
  return [
    "Voce e o Focus AI, nucleo cognitivo operacional do HexaOS.",
    "Assimile este snapshot como mapa atual do sistema e devolva um resumo operacional para memoria.",
    "Organize por setores, riscos, automacoes existentes, pontos de dados e proximas lacunas de integracao.",
    "Use linguagem curta e pratica. Nao copie payloads longos; condense.",
    "",
    JSON.stringify(contextPackage, null, 2),
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getJwtUser(req);
    if (!user) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: profile } = await admin.from("profiles").select("id, nome, setor, funcao").eq("id", user.id).maybeSingle();
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roleRows || []).some((r: any) => r.role === "admin");
    if (!isAdmin) return json({ error: "admin_required" }, 403);

    const tables = [
      "profiles",
      "leads",
      "companies",
      "clientes",
      "work_orders",
      "service_orders",
      "lab_parts",
      "stock_products",
      "quality_cases",
      "quality_rncs",
      "ai_agents",
      "ai_action_requests",
      "knowledge_chunks",
      "omie_payables",
      "omie_receivables",
      "rd_contacts",
      "rd_deals",
    ];

    const counts = await Promise.all(tables.map((table) => countRows(admin, table)));
    const [{ data: agents }, { data: knowledge }, { data: latestJobs }] = await Promise.all([
      admin.from("ai_agents").select("nome, domain, descricao, ativo").limit(30),
      admin.from("knowledge_chunks").select("title, doc_type, equipment_brand, equipment_model, tags, status, created_at").order("created_at", { ascending: false }).limit(50),
      admin.from("focus_ai_codex_jobs").select("id, job_type, title, status, scope, created_at").order("created_at", { ascending: false }).limit(10),
    ]);

    const contextPackage = {
      generated_at: new Date().toISOString(),
      project: {
        name: "HexaOS",
        company: "Hexamedical",
        supabase_url: SUPABASE_URL,
        focus: "operacao corporativa, comercial, tecnico, laboratorio, estoque, qualidade, financeiro e BI",
      },
      requested_by: profile || { id: user.id },
      table_counts: counts,
      ai_agents: agents || [],
      knowledge_index: knowledge || [],
      recent_focus_jobs: latestJobs || [],
      operating_rules: [
        "Focus AI deve propor acoes com nivel de risco e aprovacao humana quando necessario.",
        "Dados sensiveis ficam no Supabase; a VPS recebe apenas o pacote autorizado para cada job.",
        "Respostas devem priorizar economia de tokens, resumo executivo e plano acionavel.",
      ],
      sectors: ["Comercial", "Area Tecnica", "Qualidade", "Laboratorio", "Estoque", "Financeiro", "BI", "Configuracoes"],
    };

    const shareToken = randomToken();
    const shareTokenHash = await sha256(shareToken);
    const codexPrompt = buildPrompt(contextPackage);

    const { data: job, error: jobError } = await admin
      .from("focus_ai_codex_jobs")
      .insert({
        user_id: user.id,
        job_type: "system_sync",
        title: "Sincronizacao de contexto operacional HexaOS",
        status: "pending",
        scope: "system",
        user_message: "Assimile o snapshot operacional atual do HexaOS.",
        codex_prompt: codexPrompt,
        context_package: contextPackage,
        share_token_hash: shareTokenHash,
      })
      .select("id, title, job_type, status, scope, created_at")
      .single();
    if (jobError) throw jobError;

    await admin.from("focus_ai_context_snapshots").insert({
      created_by: user.id,
      title: "HexaOS operational context",
      summary: "Snapshot gerado para assimilacao do Focus AI na VPS.",
      payload: contextPackage,
      codex_job_id: job.id,
    });

    return json({ ok: true, job, share_token: shareToken, dispatch_payload: { job_id: job.id, share_token: shareToken } });
  } catch (e) {
    console.error("focus-ai-sync-system error", e);
    return json({ error: e instanceof Error ? e.message : "unknown error" }, 500);
  }
});
