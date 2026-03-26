import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const EVO_API_URL = Deno.env.get("EVO_API_URL");
  const EVO_GLOBAL_KEY = Deno.env.get("EVO_GLOBAL_KEY");
  const EVO_INSTANCE = Deno.env.get("EVO_INSTANCE");
  const EVO_API_KEY = Deno.env.get("EVO_API_KEY");

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { action } = body;

  try {
    // GET STATUS
    if (action === "status") {
      if (!EVO_API_URL || !EVO_INSTANCE) {
        return new Response(JSON.stringify({
          ok: true,
          connected: false,
          reason: "Credenciais da Evolution API não configuradas",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        const res = await fetch(`${EVO_API_URL}/instance/connectionState/${EVO_INSTANCE}`, {
          headers: { apikey: EVO_API_KEY || EVO_GLOBAL_KEY || "" },
        });
        const data = await res.json();
        return new Response(JSON.stringify({
          ok: true,
          connected: data?.instance?.state === "open",
          state: data?.instance?.state || "unknown",
          raw: data,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({
          ok: true,
          connected: false,
          reason: String(e),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // CONNECT (QR code)
    if (action === "connect") {
      if (!EVO_API_URL || !EVO_INSTANCE) {
        return new Response(JSON.stringify({ error: "Credenciais não configuradas" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${EVO_API_URL}/instance/connect/${EVO_INSTANCE}`, {
        headers: { apikey: EVO_API_KEY || EVO_GLOBAL_KEY || "" },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ ok: true, qr: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEND TEXT
    if (action === "sendText") {
      const { number, text, evento } = body;
      if (!number || !text) {
        return new Response(JSON.stringify({ error: "number e text são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate number format
      const clean = number.replace(/\D/g, "");
      if (clean.length < 12 || clean.length > 13) {
        return new Response(JSON.stringify({ error: "Número inválido. Use DDI+DDD+número (ex: 5511999999999)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!EVO_API_URL || !EVO_INSTANCE) {
        // Log but mark as failed
        await admin.from("whatsapp_logs").insert({
          destinatario: clean,
          mensagem: text,
          tipo: "text",
          evento_origem: evento || null,
          status: "failed",
          erro: "Evolution API não configurada",
        });
        return new Response(JSON.stringify({ error: "Evolution API não configurada" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`, {
        method: "POST",
        headers: {
          apikey: EVO_API_KEY || EVO_GLOBAL_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: clean,
          text,
        }),
      });
      const result = await res.json();

      await admin.from("whatsapp_logs").insert({
        destinatario: clean,
        mensagem: text,
        tipo: "text",
        evento_origem: evento || null,
        status: res.ok ? "sent" : "failed",
        erro: res.ok ? null : JSON.stringify(result),
        metadata: result,
      });

      return new Response(JSON.stringify({ ok: res.ok, result }), {
        status: res.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEND MEDIA
    if (action === "sendMedia") {
      const { number, mediaUrl, caption, evento } = body;
      const clean = number?.replace(/\D/g, "") || "";

      if (!EVO_API_URL || !EVO_INSTANCE) {
        return new Response(JSON.stringify({ error: "Evolution API não configurada" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE}`, {
        method: "POST",
        headers: {
          apikey: EVO_API_KEY || EVO_GLOBAL_KEY || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: clean,
          mediatype: "document",
          media: mediaUrl,
          caption: caption || "",
        }),
      });
      const result = await res.json();

      await admin.from("whatsapp_logs").insert({
        destinatario: clean,
        mensagem: caption || mediaUrl,
        tipo: "media",
        evento_origem: evento || null,
        status: res.ok ? "sent" : "failed",
        erro: res.ok ? null : JSON.stringify(result),
      });

      return new Response(JSON.stringify({ ok: res.ok, result }), {
        status: res.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CONTACTS SYNC
    if (action === "contacts_sync") {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, nome, setor, funcao, whatsapp, whatsapp_consent")
        .eq("whatsapp_consent", true)
        .neq("whatsapp", "");

      return new Response(JSON.stringify({
        ok: true,
        contacts: (profiles || []).map((p: any) => ({
          nome: p.nome,
          whatsapp: p.whatsapp,
          setor: p.setor,
          cargo: p.funcao,
        })),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SEND ALERT (bulk by setor)
    if (action === "sendAlert") {
      const { setor, text, evento } = body;
      if (!text) {
        return new Response(JSON.stringify({ error: "text é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = admin
        .from("profiles")
        .select("nome, whatsapp")
        .eq("whatsapp_consent", true)
        .neq("whatsapp", "");

      if (setor) query = query.eq("setor", setor);

      const { data: contacts } = await query;
      const results: any[] = [];

      for (const c of contacts || []) {
        if (!EVO_API_URL || !EVO_INSTANCE) {
          results.push({ number: c.whatsapp, status: "skipped", reason: "API não configurada" });
          continue;
        }

        try {
          const res = await fetch(`${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`, {
            method: "POST",
            headers: {
              apikey: EVO_API_KEY || EVO_GLOBAL_KEY || "",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ number: c.whatsapp.replace(/\D/g, ""), text }),
          });
          const r = await res.json();
          results.push({ number: c.whatsapp, status: res.ok ? "sent" : "failed" });

          await admin.from("whatsapp_logs").insert({
            destinatario: c.whatsapp,
            destinatario_nome: c.nome,
            mensagem: text,
            tipo: "alert",
            evento_origem: evento || "alert_bulk",
            status: res.ok ? "sent" : "failed",
            erro: res.ok ? null : JSON.stringify(r),
          });
        } catch (e) {
          results.push({ number: c.whatsapp, status: "error", reason: String(e) });
        }
      }

      return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida: " + action }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
