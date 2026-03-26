import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-openclaw-token",
};

const OPENCLAW_SERVICE_EMAIL = "focusai@hexamedical.internal";
const OPENCLAW_SERVICE_PASSWORD = "HexaFocusAI#2026!svc";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Validate OpenClaw token
  const token =
    req.headers.get("x-openclaw-token") ||
    req.headers.get("authorization")?.replace("Bearer ", "");

  const { data: cfg } = await admin
    .from("focus_ai_config")
    .select("openclaw_api_key, openclaw_ativo")
    .limit(1)
    .single();

  if (!cfg?.openclaw_ativo || !cfg.openclaw_api_key || cfg.openclaw_api_key !== token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Ensure the service account exists (idempotent)
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email === OPENCLAW_SERVICE_EMAIL
    );

    if (!existing) {
      // Create the service account
      const { data: newUser, error: createErr } =
        await admin.auth.admin.createUser({
          email: OPENCLAW_SERVICE_EMAIL,
          password: OPENCLAW_SERVICE_PASSWORD,
          email_confirm: true,
          user_metadata: { nome: "Focus AI (OpenClaw)" },
        });

      if (createErr) {
        return new Response(
          JSON.stringify({ error: "Failed to create service account", detail: createErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Assign admin role
      if (newUser?.user) {
        await admin.from("user_roles").upsert(
          { user_id: newUser.user.id, role: "admin" },
          { onConflict: "user_id,role" }
        );
      }
    }

    // Sign in and return session
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: session, error: signInErr } =
      await anonClient.auth.signInWithPassword({
        email: OPENCLAW_SERVICE_EMAIL,
        password: OPENCLAW_SERVICE_PASSWORD,
      });

    if (signInErr) {
      return new Response(
        JSON.stringify({ error: "Sign-in failed", detail: signInErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        access_token: session.session?.access_token,
        refresh_token: session.session?.refresh_token,
        expires_at: session.session?.expires_at,
        user_id: session.user?.id,
        frontend_url: "https://hexamedical-os.lovable.app",
        instructions: {
          browser_login:
            "Use the access_token to set the session directly via supabase.auth.setSession({ access_token, refresh_token }) — no need to fill the login form.",
          api_usage:
            "Include 'Authorization: Bearer <access_token>' in requests to the Supabase REST API or Edge Functions.",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
