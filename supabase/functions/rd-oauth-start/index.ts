// rd-oauth-start: initiates OAuth flow for RD Station CRM
import { corsHeaders, jsonResponse, requireAdmin, serviceRoleClient, redirectUri, RD_AUTH_DIALOG_URL } from "../_shared/rd-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
  if (!clientId) return jsonResponse({ error: "RD_STATION_CLIENT_ID not configured" }, 500);

  const state = crypto.randomUUID() + "." + crypto.randomUUID();
  const svc = serviceRoleClient();
  await svc.from("crm_integrations").update({
    pending_state: state,
    client_id: clientId,
    status: "pending",
    last_error: null,
  }).eq("provider", "rd_station");

  const url = new URL(RD_AUTH_DIALOG_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  return jsonResponse({ url: url.toString() });
});
