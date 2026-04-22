import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function OnboardingConversationPane({ messages, onSend, thinking, disabled }: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex-1 flex flex-col rounded-2xl border bg-card overflow-hidden min-h-[600px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Maya</p>
          <p className="text-xs text-muted-foreground">Consultora de processos · IA</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4 scrollbar-thin">
        {messages.length === 0 && !thinking && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Iniciando conversa...
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Maya está pensando…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Responda em linguagem natural… (Enter envia, Shift+Enter quebra linha)"
            rows={2}
            disabled={thinking || disabled}
            className="resize-none text-sm"
          />
          <Button onClick={submit} disabled={!draft.trim() || thinking || disabled} size="icon" className="h-10 w-10 shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
