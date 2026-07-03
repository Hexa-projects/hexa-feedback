// rd-save-credentials: stores RD Station OAuth client_id + client_secret in DB (encrypted).
import { corsHeaders, jsonResponse, requireAdmin, serviceRoleClient, encryptSecret, redirectUri } from "../_shared/rd-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (auth instanceof Response) return auth;

    if (req.method === "GET") {
      const svc = serviceRoleClient();
      const { data } = await svc
        .from("crm_integrations")
        .select("client_id, client_secret_enc, redirect_uri")
        .eq("provider", "rd_station")
        .maybeSingle();
      return jsonResponse({
        client_id: data?.client_id ?? "",
        has_client_secret: !!data?.client_secret_enc,
        redirect_uri: data?.redirect_uri ?? redirectUri(),
        default_redirect_uri: redirectUri(),
      });
    }

    const body = await req.json().catch(() => ({}));
    const client_id = String(body.client_id ?? "").trim();
    const client_secret = String(body.client_secret ?? "").trim();
    const custom_redirect = String(body.redirect_uri ?? "").trim();

    if (!client_id) return jsonResponse({ error: "client_id_required" }, 400);

    const svc = serviceRoleClient();
    const update: Record<string, unknown> = {
      provider: "rd_station",
      client_id,
      redirect_uri: custom_redirect || null,
    };
    if (client_secret) update.client_secret_enc = await encryptSecret(client_secret);

    const { error } = await svc.from("crm_integrations").upsert(update, { onConflict: "provider" });
    if (error) return jsonResponse({ error: "save_failed", detail: error.message }, 500);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? String(err) }, 500);
  }
});
