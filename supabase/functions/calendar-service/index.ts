import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case "create_event": {
        const { data, error } = await supabase.from("hex_calendar_events").insert({
          calendar_id: params.calendar_id,
          titulo: params.titulo,
          descricao: params.descricao || "",
          local: params.local || "",
          tipo: params.tipo || "reuniao",
          data_inicio: params.data_inicio,
          data_fim: params.data_fim,
          dia_inteiro: params.dia_inteiro || false,
          prioridade: params.prioridade || "media",
          criado_por: params.criado_por,
        }).select().single();
        if (error) throw error;

        // Add participants
        if (params.participantes?.length) {
          await supabase.from("hex_calendar_participants").insert(
            params.participantes.map((uid: string) => ({ event_id: data.id, user_id: uid }))
          );
        }

        return json({ success: true, event: data });
      }

      case "update_event": {
        const { error } = await supabase.from("hex_calendar_events")
          .update({
            titulo: params.titulo,
            descricao: params.descricao,
            local: params.local,
            tipo: params.tipo,
            data_inicio: params.data_inicio,
            data_fim: params.data_fim,
            dia_inteiro: params.dia_inteiro,
            prioridade: params.prioridade,
            status: params.status,
          })
          .eq("id", params.event_id);
        if (error) throw error;
        return json({ success: true });
      }

      case "cancel_event": {
        const { error } = await supabase.from("hex_calendar_events")
          .update({ status: "cancelado" })
          .eq("id", params.event_id);
        if (error) throw error;
        return json({ success: true });
      }

      case "availability": {
        const { data: events } = await supabase
          .from("hex_calendar_events")
          .select("data_inicio, data_fim, titulo")
          .eq("status", "confirmado")
          .gte("data_inicio", params.date_start)
          .lte("data_fim", params.date_end);

        // Check participants
        const { data: participations } = await supabase
          .from("hex_calendar_participants")
          .select("event_id, user_id, hex_calendar_events(data_inicio, data_fim)")
          .eq("user_id", params.user_id)
          .eq("status", "confirmado");

        return json({
          busy_slots: events || [],
          participations: participations || [],
          available: (events || []).length === 0,
        });
      }

      case "sync": {
        // Placeholder for Google/Outlook sync
        return json({
          success: false,
          message: "Sync com Google/Outlook requer OAuth configurado. Credenciais pendentes: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ou OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET.",
          pending_config: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET"],
        });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (error: unknown) {
    console.error("[CalendarService]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
