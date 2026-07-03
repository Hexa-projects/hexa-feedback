// DEPRECATED: RD Station CRM v1 (Private Token) does not expose webhook management via API.
// Configure webhooks manually inside RD Station CRM UI (Configurações → Webhooks) pointing at rd-webhook.
import { corsHeaders } from "../_shared/rd-client.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "not_supported",
      message: "Cadastre os webhooks manualmente no RD CRM apontando para a função rd-webhook.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
