import { useEffect, useRef, useState, KeyboardEvent, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2, Mic, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts?: string;
}

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  thinking: boolean;
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "transcribing";

export default function OnboardingConversationPane({ messages, onSend, thinking, disabled }: Props) {
  const [draft, setDraft] = useState("");
  const [recState, setRecState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const submit = () => {
    const text = draft.trim();
    if (!text || thinking || disabled) return;
    onSend(text);
    setDraft("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunksRef.current = [];
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribe(blob);
      };

      mr.start(250);
      setRecState("recording");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      toast.error("Microfone bloqueado. Verifique as permissões do navegador.");
    }
  }, []);

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecState("transcribing");
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.stop();
    chunksRef.current = [];
    setRecState("idle");
    setDuration(0);
  };

  const transcribe = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const { data, error } = await supabase.functions.invoke("elevenlabs-transcribe", {
        body: formData,
      });
      if (error) throw error;
      const text = data?.text?.trim();
      if (!text) {
        toast.error("Não foi possível transcrever o áudio.");
        setRecState("idle");
        return;
      }
      setRecState("idle");
      setDuration(0);
      onSend(text);
    } catch (err: any) {
      toast.error(err.message || "Erro ao transcrever áudio.");
      setRecState("idle");
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex-1 flex flex-col rounded-3xl border border-border/50 bg-gradient-to-b from-card to-card/50 overflow-hidden min-h-[640px] shadow-xl shadow-primary/5 backdrop-blur-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50 bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold tracking-tight">Maya</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span>Consultora de processos · IA</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-7 space-y-5 scrollbar-thin"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.08) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        {messages.length === 0 && !thinking && (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Iniciando conversa…</p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex animate-fade-in", m.role === "user" ? "justify-end" : "justify-start gap-2.5")}
          >
            {m.role !== "user" && (
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] whitespace-pre-wrap leading-relaxed shadow-sm",
                m.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-br-sm shadow-primary/20"
                  : "bg-background border border-border/60 text-foreground rounded-tl-sm"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start gap-2.5 animate-fade-in">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div className="bg-background border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="text-xs text-muted-foreground ml-1">Maya está pensando</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 p-4 bg-gradient-to-b from-background/50 to-background">
        {recState === "recording" ? (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 px-4 py-3 animate-fade-in">
            <div className="flex items-center gap-2 flex-1">
              <span className="relative flex w-3 h-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
              </span>
              <span className="text-sm font-medium text-destructive">Gravando…</span>
              <span className="text-sm font-mono tabular-nums text-destructive/80">
                {formatDuration(duration)}
              </span>
              {/* waveform vibe */}
              <div className="flex items-center gap-0.5 ml-2">
                {[3, 5, 7, 4, 6, 3, 5].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-destructive/70 rounded-full animate-pulse"
                    style={{ height: `${h * 3}px`, animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={cancelRecording} variant="ghost" size="icon" className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
            <Button onClick={stopRecording} variant="destructive" size="sm" className="gap-1.5">
              <Square className="w-3 h-3 fill-current" />
              Enviar
            </Button>
          </div>
        ) : recState === "transcribing" ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border bg-muted/40 px-4 py-3.5 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Transcrevendo seu áudio…
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all p-2">
            <Button
              type="button"
              onClick={startRecording}
              disabled={thinking || disabled}
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Gravar áudio"
            >
              <Mic className="w-4 h-4" />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Responda em texto ou áudio…"
              rows={1}
              disabled={thinking || disabled}
              className="resize-none text-sm border-0 focus-visible:ring-0 shadow-none min-h-[40px] max-h-[140px] py-2 px-1 bg-transparent"
            />
            <Button
              onClick={submit}
              disabled={!draft.trim() || thinking || disabled}
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 transition-all"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
          Enter envia · Shift+Enter quebra linha · 🎤 fala natural
        </p>
      </div>
    </div>
  );
}
