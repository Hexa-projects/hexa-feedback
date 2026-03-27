import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * livekit-transcribe
 * 
 * Receives audio from a LiveKit meeting recording and transcribes it
 * using ElevenLabs Scribe v2, then saves to meeting_logs.transcription.
 * 
 * Body: { roomName: string, audioUrl?: string }
 * Or FormData with "audio" file + "roomName" field
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");

  if (!elevenLabsKey) {
    return new Response(
      JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    let roomName: string;
    let audioBlob: Blob | null = null;
    let audioUrl: string | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      roomName = formData.get("roomName") as string;
      const audioFile = formData.get("audio") as File;
      if (audioFile) audioBlob = audioFile;
    } else {
      const body = await req.json();
      roomName = body.roomName;
      audioUrl = body.audioUrl || null;
    }

    if (!roomName) {
      return new Response(
        JSON.stringify({ error: "roomName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If audioUrl provided, download it
    if (audioUrl && !audioBlob) {
      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
      audioBlob = await res.blob();
    }

    if (!audioBlob) {
      return new Response(
        JSON.stringify({ error: "No audio provided (send 'audio' file or 'audioUrl')" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Transcribing audio for room: ${roomName}, size: ${audioBlob.size} bytes`);

    // Call ElevenLabs Scribe v2
    const apiFormData = new FormData();
    apiFormData.append("file", audioBlob, "meeting-audio.webm");
    apiFormData.append("model_id", "scribe_v2");
    apiFormData.append("language_code", "por");
    apiFormData.append("tag_audio_events", "false");
    apiFormData.append("diarize", "true");

    const sttRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": elevenLabsKey },
      body: apiFormData,
    });

    if (!sttRes.ok) {
      const errText = await sttRes.text();
      throw new Error(`ElevenLabs STT error [${sttRes.status}]: ${errText}`);
    }

    const sttResult = await sttRes.json();

    // Build transcription text with speaker labels if available
    let transcriptionText = "";
    if (sttResult.words && Array.isArray(sttResult.words)) {
      let currentSpeaker = "";
      for (const w of sttResult.words) {
        if (w.speaker_id && w.speaker_id !== currentSpeaker) {
          currentSpeaker = w.speaker_id;
          transcriptionText += `\n[${currentSpeaker}]: `;
        }
        transcriptionText += w.text + " ";
      }
      transcriptionText = transcriptionText.trim();
    } else {
      transcriptionText = sttResult.text || JSON.stringify(sttResult);
    }

    console.log(`Transcription complete: ${transcriptionText.length} chars`);

    // Save to meeting_logs
    const { error: updateErr } = await admin
      .from("meeting_logs")
      .update({ transcription: transcriptionText })
      .eq("room_name", roomName);

    if (updateErr) {
      console.error("Failed to save transcription:", updateErr);
      throw new Error(`DB update failed: ${updateErr.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        roomName,
        transcription_length: transcriptionText.length,
        preview: transcriptionText.substring(0, 200),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("livekit-transcribe error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
