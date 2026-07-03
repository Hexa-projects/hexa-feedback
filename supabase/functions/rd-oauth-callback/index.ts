import { corsHeaders, serviceRoleClient, exchangeCode, encryptSecret } from "../_shared/rd-client.ts";

const APP_URL = Deno.env.get("APP_PUBLIC_URL") ?? "https://hexaos-v2.lovable.app";
const RETURN_PATH = "/settings/integrations/rd-station";

function redirect(status: "ok" | "error", detail?: string) {
  const url = new URL(APP_URL + RETURN_PATH);
  url.searchParams.set("connected", status === "ok" ? "1" : "0");
  if (detail) url.searchParams.set("error", detail);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return redirect("error", "missing_code_or_state");

  const svc = serviceRoleClient();
  const { data: integ } = await svc
    .from("crm_integrations")
    .select("pending_state")
    .eq("provider", "rd_station")
    .maybeSingle();
  if (!integ || integ.pending_state !== state) return redirect("error", "invalid_state");

  try {
    const tokens = await exchangeCode(code);
    const access_token_enc = await encryptSecret(tokens.access_token);
    const refresh_token_enc = await encryptSecret(tokens.refresh_token);
    const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await svc.from("crm_external_accounts").upsert({
      provider: "rd_station",
      access_token_enc,
      refresh_token_enc,
      expires_at,
    }, { onConflict: "provider" });

    await svc.from("crm_integrations").update({
      status: "connected",
      pending_state: null,
      last_error: null,
    }).eq("provider", "rd_station");

    return redirect("ok");
  } catch (err) {
    await svc.from("crm_integrations").update({
      status: "error",
      last_error: String((err as Error).message).slice(0, 500),
    }).eq("provider", "rd_station");
    return redirect("error", "token_exchange_failed");
  }
});
