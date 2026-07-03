// rd-save-credentials: stores RD Station CRM Private Token in DB (encrypted).
import { corsHeaders, jsonResponse, requireAdmin, serviceRoleClient, encryptSecret, getPrivateToken, rdFetch } from "../_shared/rd-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (auth instanceof Response) return auth;

    const svc = serviceRoleClient();

    if (req.method === "GET") {
      const { data } = await svc
        .from("crm_integrations")
        .select("private_token_enc, status, last_error")
        .eq("provider", "rd_station")
        .maybeSingle();
      return jsonResponse({
        has_private_token: !!data?.private_token_enc,
        status: data?.status ?? "disconnected",
        last_error: data?.last_error ?? null,
      });
    }

    const body = await req.json().catch(() => ({}));
    const private_token = String(body.private_token ?? "").trim();
    if (!private_token) return jsonResponse({ error: "private_token_required" }, 400);

    // Save encrypted token first (upsert)
    const enc = await encryptSecret(private_token);
    const { error: upErr } = await svc.from("crm_integrations").upsert({
      provider: "rd_station",
      private_token_enc: enc,
      status: "pending",
    }, { onConflict: "provider" });
    if (upErr) return jsonResponse({ error: "save_failed", detail: upErr.message }, 500);

    // Validate token with a lightweight call (/deal_pipelines)
    try {
      const res = await rdFetch(svc, "/deal_pipelines?page=1&limit=1");
      if (!res.ok) {
        const text = await res.text();
        await svc.from("crm_integrations").update({
          status: "error",
          last_error: `validation_failed: ${res.status} ${text.slice(0, 200)}`,
        }).eq("provider", "rd_station");
        return jsonResponse({ ok: false, error: "invalid_token", detail: text.slice(0, 200) }, 400);
      }
      await svc.from("crm_integrations").update({ status: "connected", last_error: null })
        .eq("provider", "rd_station");
    } catch (err) {
      await svc.from("crm_integrations").update({
        status: "error",
        last_error: (err as Error).message?.slice(0, 200) ?? "unknown",
      }).eq("provider", "rd_station");
      return jsonResponse({ ok: false, error: "validation_error", detail: (err as Error).message }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? String(err) }, 500);
  }
});
