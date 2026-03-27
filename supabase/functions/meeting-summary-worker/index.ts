import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * meeting-summary-worker
 * Processes queued meeting_summary events from openclaw_event_queue.
 * For each: fetches full transcription, generates personalized summary via OpenAI,
 * sends via WhatsApp, and marks the job as delivered.
 *
 * Invoked via cron or manually: POST /functions/v1/meeting-summary-worker
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Fetch pending meeting_summary jobs (batch of 10)
    const { data: jobs, error: fetchErr } = await admin
      .from("openclaw_event_queue")
      .select("*")
      .eq("event_type", "meeting_summary")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const job of jobs) {
      const jobData = job.data as any;
      const { meeting_id, room_name, participant_name, whatsapp_e164, all_participants } = jobData;

      try {
        // Mark as processing
        await admin.from("openclaw_event_queue")
          .update({ status: "processing", attempts: job.attempts + 1 })
          .eq("id", job.id);

        // Fetch full transcription
        const { data: meeting } = await admin
          .from("meeting_logs")
          .select("transcription")
          .eq("id", meeting_id)
          .single();

        const transcription = meeting?.transcription || "";
        if (!transcription || transcription.trim().length < 20) {
          await admin.from("openclaw_event_queue")
            .update({ status: "failed", last_error: "No transcription available" })
            .eq("id", job.id);
          results.push({ id: job.id, status: "no_transcription" });
          continue;
        }

        // Generate personalized summary
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
                content: `Você é o Focus AI do HexaOS. Gere um resumo personalizado de reunião para o colaborador "${participant_name}". 
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
                content: `Transcrição da reunião (sala: ${room_name}):\n\n${transcription.slice(0, 12000)}\n\nParticipantes: ${(all_participants || []).join(", ")}\n\nGere o resumo personalizado para: ${participant_name}`,
              },
            ],
          }),
        });

        const aiData = await res.json();
        const summary = aiData.choices?.[0]?.message?.content || "Resumo indisponível.";

        // Send via WhatsApp
        const { error: sendErr } = await admin.functions.invoke("whatsapp-service", {
          body: {
            action: "sendText",
            number: whatsapp_e164,
            text: summary,
            evento: "meeting_summary",
          },
        });

        if (sendErr) {
          await admin.from("openclaw_event_queue")
            .update({ status: "failed", last_error: `WhatsApp send error: ${sendErr.message}` })
            .eq("id", job.id);
          results.push({ id: job.id, status: "send_failed" });
        } else {
          await admin.from("openclaw_event_queue")
            .update({ status: "delivered", delivered_at: new Date().toISOString() })
            .eq("id", job.id);
          results.push({ id: job.id, status: "delivered", participant: participant_name });
        }
      } catch (jobErr) {
        console.error(`Job ${job.id} error:`, jobErr);
        await admin.from("openclaw_event_queue")
          .update({
            status: job.attempts + 1 >= job.max_attempts ? "failed" : "pending",
            last_error: String(jobErr),
            next_retry_at: new Date(Date.now() + 60000 * Math.pow(2, job.attempts)).toISOString(),
          })
          .eq("id", job.id);
        results.push({ id: job.id, status: "error" });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("meeting-summary-worker error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
