import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deterministicUuid(seed: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const bytes = new Uint8Array(digest.slice(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  return error || !data?.claims ? null : data.claims;
}

async function listUserIds(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users || [];
    ids.push(...users.map((user) => user.id));
    if (users.length < 1000) break;
    page += 1;
  }

  return ids;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!await authenticate(req)) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const buildId = String(body.build_id || "").trim();
    if (!buildId || buildId.length > 120) return json({ error: "build_id required" }, 400);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: existing, error: existingError } = await admin
      .from("notifications")
      .select("id")
      .eq("metadata->>event_type", "app_release")
      .eq("metadata->>build_id", buildId)
      .limit(1);
    if (existingError) throw existingError;
    if (existing?.length) {
      return json({ announced: false, already_announced: true, build_id: buildId });
    }

    const userIds = await listUserIds(admin);
    if (userIds.length === 0) return json({ announced: false, recipients: 0, build_id: buildId });

    const notifications = await Promise.all(userIds.map(async (userId) => ({
      id: await deterministicUuid(`app-release:${buildId}:${userId}`),
      user_id: userId,
      titulo: "Nova versao do HexaOS disponivel",
      mensagem: "Uma nova versao do sistema foi publicada. Acesse o HexaOS para atualizar.",
      tipo: "sistema",
      lida: false,
      link: "/",
      metadata: {
        event_type: "app_release",
        build_id: buildId,
        source: "pwa-release",
      },
    })));

    const { data: inserted, error: insertError } = await admin
      .from("notifications")
      .insert(notifications, { ignoreDuplicates: true })
      .select("id");
    if (insertError) throw insertError;

    // Deterministic ids make repeated calls for the same build idempotent.
    if (!inserted?.length) {
      return json({ announced: false, already_announced: true, build_id: buildId });
    }

    const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_ids: userIds,
        title: "Nova versao do HexaOS disponivel",
        body: "Abra o HexaOS para atualizar para a versao mais recente.",
        url: "/",
        tag: `hexaos-release-${buildId}`,
        metadata: { event_type: "app_release", build_id: buildId },
      }),
    });
    const pushResult = await pushResponse.json().catch(() => ({}));

    return json({
      announced: true,
      build_id: buildId,
      recipients: userIds.length,
      in_app_inserted: inserted.length,
      push: pushResult,
    });
  } catch (error) {
    console.error("[announce-app-release] error", error);
    return json({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
