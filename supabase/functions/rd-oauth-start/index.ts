// DEPRECATED: RD Station CRM now uses Private Token auth (see rd-save-credentials).
import { corsHeaders } from "../_shared/rd-client.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "deprecated", message: "OAuth removido. Use Private Token em rd-save-credentials." }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
