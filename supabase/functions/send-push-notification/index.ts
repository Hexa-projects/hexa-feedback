// Sends Web Push notifications to a set of users using VAPID.
// Callable from the frontend (authenticated user) or from a server context
// using the service_role key.
//
// Body: { user_ids: string[], title: string, body?: string, url?: string,
//         tag?: string, metadata?: Record<string, unknown> }

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@hexaos.com.br";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.error("[send-push] VAPID setup failed", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: accept either an end-user JWT or the service_role key.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceCall = token === serviceKey;

    if (!isServiceCall) {
      const authed = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data, error } = await authed.auth.getClaims(token);
      if (error || !data?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];
    const title: string = String(body.title || "HexaOS");
    const message: string = String(body.body || "");
    const url: string = String(body.url || "/");
    const tag: string = String(body.tag || "hexaos-generic");
    const metadata = body.metadata || {};
    const notificationId = body.notification_id ?? null;

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
      { auth: { persistSession: false } },
    );

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("enabled", true)
      .in("user_id", userIds);

    if (subsErr) {
      return new Response(JSON.stringify({ error: subsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      tag,
      notification_id: notificationId,
      metadata,
    });

    let sent = 0;
    let disabled = 0;
    const failures: Array<{ id: string; status?: number; error?: string }> = [];

    await Promise.all(
      (subs || []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          const status = err?.statusCode || err?.status;
          failures.push({ id: s.id, status, error: err?.body || err?.message });
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").update({ enabled: false }).eq("id", s.id);
            disabled++;
          }
        }
      }),
    );

    return new Response(
      JSON.stringify({ total: subs?.length || 0, sent, disabled, failures }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[send-push] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
