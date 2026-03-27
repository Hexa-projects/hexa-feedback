import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WebhookReceiver } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Validate LiveKit webhook signature
    const body = await req.text();
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    const authHeader = req.headers.get("Authorization") || "";

    let event: any;
    try {
      event = await receiver.receive(body, authHeader);
    } catch (e) {
      console.error("Webhook signature invalid:", e);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("LiveKit webhook event:", event.event);

    // Only process room_finished
    if (event.event !== "room_finished") {
      return new Response(JSON.stringify({ ok: true, skipped: event.event }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roomName = event.room?.name;
    if (!roomName) {
      return new Response(JSON.stringify({ error: "No room name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing room_finished for:", roomName);

    // 1) Fetch meeting log
    const { data: meeting, error: meetErr } = await admin
      .from("meeting_logs")
      .select("*")
      .eq("room_name", roomName)
      .maybeSingle();

    if (meetErr || !meeting) {
      console.error("Meeting not found:", roomName, meetErr);
      return new Response(JSON.stringify({ error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update meeting as ended
    const duration = event.room?.activeRecording
      ? null
      : Math.floor((Date.now() / 1000) - (event.room?.creationTime || 0));

    await admin.from("meeting_logs").update({
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
    }).eq("id", meeting.id);

    const participants = (meeting.participants as any[]) || [];
    const transcription = meeting.transcription || "";

    if (!transcription || transcription.trim().length < 20) {
      console.log("No transcription available, skipping summaries.");
      return new Response(JSON.stringify({ ok: true, reason: "no_transcription" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) For each participant, generate summary and send WhatsApp DM
    const results: any[] = [];

    for (const p of participants) {
      const identity = p.user_id || p.identity;
      const name = p.name || "Participante";

      // Lookup WhatsApp from meeting_participants_map first, then profiles
      let whatsapp: string | null = null;

      const { data: mapEntry } = await admin
        .from("meeting_participants_map")
        .select("whatsapp_e164")
        .eq("participant_identity", identity)
        .maybeSingle();

      if (mapEntry?.whatsapp_e164) {
        whatsapp = mapEntry.whatsapp_e164;
      } else {
        // Fallback: check profiles table
        const { data: profile } = await admin
          .from("profiles")
          .select("whatsapp, whatsapp_consent")
          .eq("id", identity)
          .maybeSingle();

        if (profile?.whatsapp && profile?.whatsapp_consent) {
          whatsapp = profile.whatsapp.replace(/\D/g, "");
        }
      }

      if (!whatsapp) {
        console.log(`No WhatsApp for participant ${name} (${identity}), skipping.`);
        results.push({ identity, name, status: "skipped", reason: "no_whatsapp" });
        continue;
      }

      // 3) Generate personalized summary via OpenAI
      let summary: string;
      try {
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 800,
            messages: [
              {
                role: "system",
                content: `Você é o Focus AI do HexaOS. Gere um resumo personalizado de reunião para o colaborador "${name}". 
O resumo deve ser direto, em português, formatado para WhatsApp (sem markdown pesado, use *negrito* e emojis moderados).
Estrutura:
📋 *Resumo da Reunião*
- O que foi discutido
🎯 *Decisões que envolvem você*
- Decisões específicas para este participante
✅ *Suas ações pendentes*
- Tarefa / responsável / prazo
Se não houver itens específicos para o participante, inclua um resumo geral.`,
              },
              {
                role: "user",
                content: `Transcrição da reunião (sala: ${roomName}):\n\n${transcription}\n\nParticipantes: ${participants.map((pp: any) => pp.name).join(", ")}\n\nGere o resumo personalizado para: ${name}`,
              },
            ],
          }),
        });

        const aiData = await aiRes.json();
        summary = aiData.choices?.[0]?.message?.content || "Resumo indisponível.";
      } catch (aiErr) {
        console.error("AI summary error for", name, aiErr);
        summary = `📋 *Resumo da Reunião (${roomName})*\n\nResumo automático indisponível. Consulte a transcrição completa no HexaOS.`;
      }

      // 4) Send WhatsApp DM via whatsapp-service
      try {
        const { data: sendResult, error: sendErr } = await admin.functions.invoke("whatsapp-service", {
          body: {
            action: "sendText",
            number: whatsapp,
            text: summary,
            evento: "meeting_summary",
          },
        });

        if (sendErr) {
          console.error("WhatsApp send error for", name, sendErr);
          results.push({ identity, name, status: "send_failed", error: sendErr.message });
        } else {
          console.log("WhatsApp sent to", name, whatsapp);
          results.push({ identity, name, status: "sent" });
        }
      } catch (wErr) {
        console.error("WhatsApp invoke error:", wErr);
        results.push({ identity, name, status: "error", error: String(wErr) });
      }
    }

    // Update meeting summary
    await admin.from("meeting_logs").update({
      summary: `Resumos enviados para ${results.filter(r => r.status === "sent").length}/${results.length} participantes`,
      metadata: { webhook_processed: true, summary_results: results },
    }).eq("id", meeting.id);

    console.log("Webhook processing complete:", JSON.stringify(results));

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("livekit-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
