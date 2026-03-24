import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Agent {
  id: string;
  nome: string;
  domain: string;
  descricao: string;
  ativo: boolean;
}

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

async function streamChat({
  messages,
  agentId,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  agentId?: string;
  onDelta: (t: string) => void;
  onDone: () => void;
  onError: (e: string) => void;
}) {
  const session = (await supabase.auth.getSession()).data.session;
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, agentId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Erro de conexão" }));
    onError(err.error || "Erro desconhecido");
    return;
  }
  if (!resp.body) { onError("Sem resposta"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { /* partial */ }
    }
  }
  onDone();
}

const DOMAIN_COLORS: Record<string, string> = {
  executive: "bg-amber-500/10 text-amber-600",
  sales: "bg-blue-500/10 text-blue-600",
  finance: "bg-green-500/10 text-green-600",
  ops: "bg-orange-500/10 text-orange-600",
  hr: "bg-pink-500/10 text-pink-600",
  support: "bg-purple-500/10 text-purple-600",
  marketing: "bg-cyan-500/10 text-cyan-600",
  data: "bg-indigo-500/10 text-indigo-600",
  lab: "bg-teal-500/10 text-teal-600",
  legal: "bg-slate-500/10 text-slate-600",
  general: "bg-muted text-muted-foreground",
};

export default function AIChat() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("ai_agents").select("id, nome, domain, descricao, ativo").eq("ativo", true).order("nome").then(({ data }) => {
      setAgents((data || []) as Agent[]);
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      messages: [...messages, userMsg],
      agentId: selectedAgent,
      onDelta: upsert,
      onDone: () => setLoading(false),
      onError: (e) => { toast.error(e); setLoading(false); },
    });
  };

  const agentName = agents.find(a => a.id === selectedAgent)?.nome || "Assistente Geral";

  return (
    <HexaLayout>
      <div className="flex flex-col h-[calc(100vh-7rem)] animate-slide-up">
        {/* Agent selector */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2">
          <Button
            size="sm"
            variant={!selectedAgent ? "default" : "outline"}
            onClick={() => { setSelectedAgent(undefined); setMessages([]); }}
            className="shrink-0 gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Geral
          </Button>
          {agents.map(a => (
            <Button
              key={a.id}
              size="sm"
              variant={selectedAgent === a.id ? "default" : "outline"}
              onClick={() => { setSelectedAgent(a.id); setMessages([]); }}
              className="shrink-0 gap-1.5"
            >
              <Bot className="w-3.5 h-3.5" />
              {a.nome.replace(" Agent", "")}
            </Button>
          ))}
        </div>

        {/* Chat area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="w-12 h-12 text-primary/30 mb-3" />
                <h3 className="text-lg font-medium text-muted-foreground">Olá! Sou o {agentName}</h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm mt-1">
                  {agents.find(a => a.id === selectedAgent)?.descricao || "Como posso ajudar você hoje?"}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                }`}>
                  {m.content}
                  {m.role === "assistant" && loading && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse ml-0.5 align-middle rounded" />
                  )}
                </div>
                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="min-h-[44px] max-h-32 resize-none"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
              />
              <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="shrink-0 h-11 w-11">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </HexaLayout>
  );
}
