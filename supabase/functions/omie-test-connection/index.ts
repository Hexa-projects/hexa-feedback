import {
  corsHeaders,
  jsonResponse,
  maskKey,
  omieFetch,
  requireFinanceAccess,
  serviceRoleClient,
} from "../_shared/omie-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireFinanceAccess(req);
  if (auth instanceof Response) return auth;

  const svc = serviceRoleClient();
  try {
    await omieFetch("https://app.omie.com.br/api/v1/financas/contapagar/", "ListarContasPagar", {
      pagina: 1,
      registros_por_pagina: 1,
      apenas_importado_api: "N",
    });
    await svc.from("omie_accounts").upsert({
      company_name: "HexaMedical",
      app_key_masked: maskKey(Deno.env.get("OMIE_APP_KEY") ?? ""),
      status: "connected",
      last_test_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      enabled_modules: { finance: true },
    }, { onConflict: "company_name" });
    return jsonResponse({ ok: true, status: "connected" });
  } catch (error) {
    await svc.from("omie_accounts").upsert({
      company_name: "HexaMedical",
      app_key_masked: maskKey(Deno.env.get("OMIE_APP_KEY") ?? ""),
      status: "error",
      last_test_at: new Date().toISOString(),
      last_error: error?.faultstring ?? error?.message ?? "omie_connection_failed",
      enabled_modules: { finance: true },
    }, { onConflict: "company_name" });
    return jsonResponse({
      ok: false,
      faultcode: error?.faultcode ?? "OMIE_CONNECTION_FAILED",
      faultstring: error?.faultstring ?? error?.message ?? "omie_connection_failed",
      cooldown_seconds: error?.cooldownSeconds ?? null,
    }, 502);
  }
});
