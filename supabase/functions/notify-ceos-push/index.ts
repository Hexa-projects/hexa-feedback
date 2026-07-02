// Resolves CEO recipients and dispatches a Web Push for a pending commercial
// request. Called from the frontend after a request is created.
//
// Body: { request_id: string, body?: string }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authed.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestId: string | undefined = body.request_id;
    const bodyText: string =
      String(body.body || "Uma nova solicitação comercial aguarda sua aprovação.");
    if (!requestId) {
      return new Response(JSON.stringify({ error: "request_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Resolve CEO user_ids from the existing DB helper.
    const { data: recipients, error: rErr } = await admin.rpc(
      "get_ceo_notification_recipients",
    );
    if (rErr) {
      return new Response(JSON.stringify({ error: rErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userIds = ((recipients as any[]) || [])
      .map((r) => r.user_id)
      .filter((v: string | null) => !!v);

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: "no recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `/crm/requests/${requestId}`;
    const tag = `commercial-request-${requestId}`;

    // Invoke the generic push sender using the service role.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        user_ids: userIds,
        title: "Nova solicitação pendente",
        body: bodyText,
        url,
        tag,
        metadata: {
          event_type: "commercial_request_pending_approval",
          request_id: requestId,
        },
      }),
    });

    const result = await resp.json().catch(() => ({}));
    return new Response(JSON.stringify(result), {
      status: resp.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-ceos-push] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
