import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const SUPABASE_URL = "https://fevmcjnaeuxydmxmkarw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldm1jam5hZXV4eWRteG1rYXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjM1MDcsImV4cCI6MjA4OTkzOTUwN30.oHTGDmdVb2kXj0HR8GJWjGBeuCjDY0w3x4aJ-qJIT-4";

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  label?: string;
}

type RecorderState = "idle" | "recording" | "transcribing" | "done";

export default function AudioRecorder({ onTranscription, label = "Gravar áudio" }: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [transcription, setTranscription] = useState("");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };

      mediaRecorder.start(250);
      setState("recording");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setState("transcribing");
  }, []);

  const transcribeAudio = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/elevenlabs-transcribe`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro na transcrição");
      }

      const data = await response.json();
      const text = data.text || "";
      setTranscription(text);
      onTranscription(text);
      setState("done");
      toast.success("Áudio transcrito com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao transcrever: " + err.message);
      setState("idle");
    }
  };

  const handleTranscriptionEdit = (text: string) => {
    setTranscription(text);
    onTranscription(text);
  };

  const reset = () => {
    setState("idle");
    setTranscription("");
    setDuration(0);
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {state === "idle" && (
          <Button type="button" variant="outline" size="sm" onClick={startRecording} className="gap-2">
            <Mic className="w-4 h-4 text-destructive" />
            {label}
          </Button>
        )}

        {state === "recording" && (
          <div className="flex items-center gap-3">
            <Button type="button" variant="destructive" size="sm" onClick={stopRecording} className="gap-2 animate-pulse">
              <Square className="w-3 h-3" />
              Parar ({formatDuration(duration)})
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              Gravando...
            </span>
          </div>
        )}

        {state === "transcribing" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Transcrevendo áudio...
          </div>
        )}

        {state === "done" && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-primary">
              <Check className="w-3.5 h-3.5" /> Transcrito
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1 text-xs h-7">
              <RotateCcw className="w-3 h-3" /> Gravar novo
            </Button>
          </div>
        )}
      </div>

      {state === "done" && transcription && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Edite a transcrição se necessário:</p>
          <Textarea
            value={transcription}
            onChange={(e) => handleTranscriptionEdit(e.target.value)}
            rows={3}
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
}
