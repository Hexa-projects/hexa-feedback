import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WebhookReceiver } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Upsert a participant into meeting_logs.participants JSONB array */
async function upsertParticipant(
  admin: ReturnType<typeof createClient>,
  roomName: string,
  identity: string,
  name: string,
  field: "joined_at" | "left_at"
) {
  const { data: meeting } = await admin
    .from("meeting_logs")
    .select("id, participants")
    .eq("room_name", roomName)
    .maybeSingle();

  if (!meeting) {
    console.log(`Meeting not found for room ${roomName}, skipping participant update.`);
    return;
  }

  const participants: any[] = (meeting.participants as any[]) || [];
  const idx = participants.findIndex((p: any) => p.user_id === identity || p.identity === identity);
  const ts = new Date().toISOString();

  if (idx >= 0) {
    participants[idx][field] = ts;
    if (field === "joined_at" && !participants[idx].name && name) {
      participants[idx].name = name;
    }
  } else if (field === "joined_at") {
    participants.push({ user_id: identity, name: name || "Participante", joined_at: ts });
  }

  await admin.from("meeting_logs").update({ participants }).eq("id", meeting.id);
  console.log(`Participant ${identity} ${field} updated for room ${roomName}`);
}

/** Resolve WhatsApp number for a participant */
async function resolveWhatsApp(
  admin: ReturnType<typeof createClient>,
  identity: string
): Promise<string | null> {
  const { data: mapEntry } = await admin
    .from("meeting_participants_map")
    .select("whatsapp_e164")
    .eq("participant_identity", identity)
    .maybeSingle();

  if (mapEntry?.whatsapp_e164) return mapEntry.whatsapp_e164;

  const { data: profile } = await admin
    .from("profiles")
    .select("whatsapp, whatsapp_consent")
    .eq("id", identity)
    .maybeSingle();

  if (profile?.whatsapp && profile?.whatsapp_consent) {
    return profile.whatsapp.replace(/\D/g, "");
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(supabaseUrl, serviceKey);

  try {
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

    const eventType = event.event;
    const roomName = event.room?.name;
    console.log(`LiveKit webhook: ${eventType} | room: ${roomName || "n/a"}`);

    // ── participant_joined ──
    if (eventType === "participant_joined" && roomName && event.participant) {
      const p = event.participant;
      await upsertParticipant(admin, roomName, p.identity, p.name || p.identity, "joined_at");
      return new Response(JSON.stringify({ ok: true, event: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── participant_left ──
    if (eventType === "participant_left" && roomName && event.participant) {
      const p = event.participant;
      await upsertParticipant(admin, roomName, p.identity, p.name || p.identity, "left_at");
      return new Response(JSON.stringify({ ok: true, event: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── room_finished ──
    if (eventType !== "room_finished") {
      return new Response(JSON.stringify({ ok: true, skipped: eventType }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const duration = Math.floor((Date.now() / 1000) - (event.room?.creationTime || 0));
    await admin.from("meeting_logs").update({
      ended_at: new Date().toISOString(),
      duration_seconds: duration > 0 ? duration : null,
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

    // 2) Enqueue async summary jobs per participant instead of blocking webhook
    const allNames = participants.map((p: any) => p.name || "Participante");
    let enqueued = 0;

    for (const p of participants) {
      const identity = p.user_id || p.identity;
      const name = p.name || "Participante";
      const whatsapp = await resolveWhatsApp(admin, identity);

      if (!whatsapp) {
        console.log(`No WhatsApp for ${name} (${identity}), skipping.`);
        continue;
      }

      // Queue a summary job in openclaw_event_queue
      await admin.from("openclaw_event_queue").insert({
        event_type: "meeting_summary",
        domain: "meetings",
        priority: "high",
        data: {
          meeting_id: meeting.id,
          room_name: roomName,
          participant_identity: identity,
          participant_name: name,
          whatsapp_e164: whatsapp,
          all_participants: allNames,
          transcription_preview: transcription.slice(0, 500),
        },
        tags: ["meeting", "summary", roomName],
      });
      enqueued++;
    }

    // Update meeting summary status
    await admin.from("meeting_logs").update({
      summary: `${enqueued} resumos enfileirados para processamento assíncrono`,
      metadata: { webhook_processed: true, enqueued_summaries: enqueued, total_participants: participants.length },
    }).eq("id", meeting.id);

    console.log(`Enqueued ${enqueued} summary jobs for room ${roomName}`);

    return new Response(JSON.stringify({ ok: true, enqueued }), {
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
