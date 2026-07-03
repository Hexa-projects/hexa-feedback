// rd-oauth-start: initiates OAuth flow for RD Station CRM
import { corsHeaders, jsonResponse, RD_AUTH_DIALOG_URL, requireAdmin, serviceRoleClient, getOAuthCredentials } from "../_shared/rd-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (auth instanceof Response) return auth;

    const svc = serviceRoleClient();

    let creds;
    try {
      creds = await getOAuthCredentials(svc);
    } catch (e) {
      return jsonResponse({ error: (e as Error).message }, 500);
    }
    const clientId = creds.client_id;
    const callbackUrl = creds.redirect_uri;

    const state = crypto.randomUUID() + "." + crypto.randomUUID();
    const callbackUrl = redirectUri();

    // Ensure integration row exists, then update
    const { error: upsertError } = await svc.from("crm_integrations").upsert(
      {
        provider: "rd_station",
        pending_state: state,
        client_id: clientId,
        status: "pending",
        last_error: null,
      },
      { onConflict: "provider" },
    );
    if (upsertError) {
      console.error("rd-oauth-start state save failed:", upsertError.message);
      return jsonResponse({ error: "rd_oauth_state_save_failed", detail: upsertError.message }, 500);
    }

    const url = new URL(RD_AUTH_DIALOG_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("state", state);
    return jsonResponse({ url: url.toString() });
  } catch (err) {
    console.error("rd-oauth-start error:", err);
    return jsonResponse({ error: (err as Error).message ?? String(err) }, 500);
  }
});
