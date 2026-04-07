import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENCLAW_BASE_URL = Deno.env.get("OPENCLAW_BASE_URL");
const OPENCLAW_HOOKS_TOKEN = Deno.env.get("OPENCLAW_HOOKS_TOKEN");
const OPENCLAW_AGENT_ID = Deno.env.get("OPENCLAW_AGENT_ID") || "ops-agent";
const OPENCLAW_MODEL = Deno.env.get("OPENCLAW_MODEL") || "gpt-4o-mini";
const OPENCLAW_INGEST_TOKEN = Deno.env.get("OPENCLAW_INGEST_TOKEN");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { event_id, mode = "agent", force = false } = body;

    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch event
    const { data: event, error: evErr } = await supabase
      .from("operational_events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (evErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotent request_id
    const requestId = `${event_id}:${event.created_at}`;

    // Check existing run (idempotency)
    if (!force) {
      const { data: existing } = await supabase
        .from("agent_runs")
        .select("id, status")
        .eq("openclaw_request_id", requestId)
        .maybeSingle();

      if (existing && ["queued", "running", "success"].includes(existing.status)) {
        return new Response(JSON.stringify({
          run_id: existing.id, event_id, status: existing.status, deduplicated: true
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Create agent_run
    const { data: run, error: runErr } = await supabase
      .from("agent_runs")
      .upsert({
        event_id,
        openclaw_request_id: requestId,
        status: "queued",
        started_at: new Date().toISOString(),
      }, { onConflict: "openclaw_request_id" })
      .select("id")
      .single();

    if (runErr) throw new Error(`Failed to create agent_run: ${runErr.message}`);

    // Update event status
    await supabase.from("operational_events").update({ status: "queued" }).eq("id", event_id);

    // Call OpenClaw if configured
    let openclawResponse = null;
    if (OPENCLAW_BASE_URL && OPENCLAW_HOOKS_TOKEN) {
      const callbackUrl = `${SUPABASE_URL}/functions/v1/ingest-openclaw`;
      const message = [
        `[HexaOS Evento Operacional]`,
        `Tipo: ${event.type}`,
        `Entidade: ${event.entity_type || "N/A"} / ${event.entity_id || "N/A"}`,
        `Payload: ${JSON.stringify(event.payload)}`,
        `Source: ${event.source}`,
        ``,
        `[Política de Autonomia]`,
        `- Se a ação requer revisão humana, crie itens com requires_review=true`,
        `- Registre todas as ações executadas no array "actions"`,
        `- Ao finalizar, envie o resultado via callback POST para:`,
        `  ${callbackUrl}`,
        `  Header: Authorization: Bearer <INGEST_TOKEN>`,
        `  Body: { event_id: "${event_id}", openclaw_request_id: "${requestId}", status, summary, actions, kpi_updates, errors }`,
      ].join("\n");

      try {
        const resp = await fetch(`${OPENCLAW_BASE_URL}/hooks/agent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENCLAW_HOOKS_TOKEN}`,
          },
          body: JSON.stringify({
            message,
            agentId: OPENCLAW_AGENT_ID,
            name: "OpsAgent",
            model: OPENCLAW_MODEL,
            timeoutSeconds: 120,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`OpenClaw error [${resp.status}]: ${errText}`);
          await supabase.from("agent_runs").update({
            status: "failed",
            errors: [{ code: resp.status, message: errText }],
            finished_at: new Date().toISOString(),
          }).eq("id", run.id);
          await supabase.from("operational_events").update({ status: "failed" }).eq("id", event_id);
        } else {
          openclawResponse = await resp.json();
          await supabase.from("agent_runs").update({ status: "running" }).eq("id", run.id);
        }
      } catch (fetchErr) {
        console.error("OpenClaw fetch error:", fetchErr);
        await supabase.from("agent_runs").update({
          status: "failed",
          errors: [{ message: String(fetchErr) }],
          finished_at: new Date().toISOString(),
        }).eq("id", run.id);
      }
    } else {
      console.warn("OpenClaw not configured — run created but not dispatched");
    }

    return new Response(JSON.stringify({
      run_id: run.id,
      event_id,
      openclaw_dispatched: !!openclawResponse,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("trigger-openclaw error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
