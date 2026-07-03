// rd-oauth-start: initiates OAuth flow for RD Station CRM
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RD_AUTH_DIALOG_URL = "https://api.rd.services/auth/dialog";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");

    let userId: string | null = null;
    try {
      const { data } = await anon.auth.getUser(token);
      userId = data.user?.id ?? null;
    } catch (_) { /* fall through */ }
    if (!userId) return jsonResponse({ error: "unauthorized" }, 401);

    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Role check: admin or gestor
    const { data: roleRow } = await svc.rpc("is_rd_admin", { _user: userId });
    if (!roleRow) {
      // Fallback: check user_roles directly
      const { data: roles } = await svc
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const allowed = (roles ?? []).some((r: { role: string }) =>
        r.role === "admin" || r.role === "gestor"
      );
      if (!allowed) return jsonResponse({ error: "forbidden" }, 403);
    }

    const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
    if (!clientId) return jsonResponse({ error: "RD_STATION_CLIENT_ID not configured" }, 500);

    const state = crypto.randomUUID() + "." + crypto.randomUUID();
    const redirectUri = `${supabaseUrl}/functions/v1/rd-oauth-callback`;

    // Ensure integration row exists, then update
    await svc.from("crm_integrations").upsert(
      {
        provider: "rd_station",
        pending_state: state,
        client_id: clientId,
        status: "pending",
        last_error: null,
      },
      { onConflict: "provider" },
    );

    const url = new URL(RD_AUTH_DIALOG_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return jsonResponse({ url: url.toString() });
  } catch (err) {
    console.error("rd-oauth-start error:", err);
    return jsonResponse({ error: (err as Error).message ?? String(err) }, 500);
  }
});
