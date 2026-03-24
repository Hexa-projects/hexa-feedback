import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Bot, User, Loader2, Sparkles, Brain, MessageCircle, Zap, FileUp } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import FileImportPanel from "@/components/FileImportPanel";

type Msg = { role: "user" | "assistant"; content: string };
type AIMode = "assistant" | "focus";

interface Agent {
  id: string;
  nome: string;
  domain: string;
  descricao: string;
  ativo: boolean;
}

const ANTHROPIC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/anthropic-chat`;
const FOCUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

// Map sector names to agent domains
const SECTOR_DOMAIN_MAP: Record<string, string[]> = {
  Comercial: ["comercial", "vendas", "marketing", "crm"],
  Técnico: ["operacoes", "tecnico", "suporte"],
  Laboratório: ["laboratorio", "produto", "tecnologia"],
  Administrativo: ["rh", "administrativo", "juridico"],
  Financeiro: ["financeiro", "financas"],
  Logística: ["operacoes", "logistica"],
  Diretoria: [], // sees all
};

async function streamChat({
  url, messages, agentId, context, onDelta, onDone, onError,
}: {
  url: string; messages: Msg[]; agentId?: string; context?: string;
  onDelta: (t: string) => void; onDone: () => void; onError: (e: string) => void;
}) {
  const session = (await supabase.auth.getSession()).data.session;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, agentId, context }),
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

export default function AIChat() {
  const { user, profile, role } = useAuth();
  const [mode, setMode] = useState<AIMode>("assistant");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const endRef = useRef<HTMLDivElement>(null);

  // Fetch agents filtered by user sector
  useEffect(() => {
    supabase.from("ai_agents").select("id, nome, domain, descricao, ativo").eq("ativo", true).order("nome").then(({ data }) => {
      const allAgents = (data || []) as Agent[];

      // Filter by sector unless admin/diretoria
      if (role === "admin" || profile?.setor === "Diretoria") {
        setAgents(allAgents);
      } else {
        const allowedDomains = SECTOR_DOMAIN_MAP[profile?.setor || ""] || [];
        if (allowedDomains.length === 0) {
          setAgents(allAgents);
        } else {
          const filtered = allAgents.filter(a =>
            allowedDomains.some(d => a.domain.toLowerCase().includes(d))
          );
          // Always include at least one general agent
          setAgents(filtered.length > 0 ? filtered : allAgents.slice(0, 1));
        }
      }
    });
  }, [profile?.setor, role]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const switchMode = (newMode: AIMode) => {
    setMode(newMode);
    setMessages([]);
    setSelectedAgent(undefined);
  };

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

    const url = mode === "assistant" ? ANTHROPIC_URL : FOCUS_URL;

    await streamChat({
      url,
      messages: [...messages, userMsg],
      agentId: mode === "focus" ? selectedAgent : undefined,
      onDelta: upsert,
      onDone: () => setLoading(false),
      onError: (e) => { toast.error(e); setLoading(false); },
    });
  };

  const modeConfig = {
    assistant: {
      icon: MessageCircle,
      label: "Assistente IA",
      sublabel: "Claude · Ajuda contextual",
      color: "text-hexa-purple",
      bg: "bg-hexa-purple/10",
      description: "Tire dúvidas, peça resumos e receba sugestões para seu dia a dia.",
    },
    focus: {
      icon: Brain,
      label: "Focus AI",
      sublabel: "OpenClaw · Análise autônoma",
      color: "text-hexa-amber-dark",
      bg: "bg-hexa-amber/10",
      description: "Análises profundas, insights de negócio e automações inteligentes.",
    },
  };

  const currentMode = modeConfig[mode];
  const agentName = mode === "focus"
    ? agents.find(a => a.id === selectedAgent)?.nome || "Focus AI Geral"
    : "Assistente IA";

  return (
    <HexaLayout>
      <div className="flex flex-col h-[calc(100vh-7rem)] animate-slide-up">
        {/* Top bar: Mode selector + tabs */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex bg-muted/60 rounded-xl p-1 gap-1">
              {(["assistant", "focus"] as AIMode[]).map(m => {
                const cfg = modeConfig[m];
                const Icon = cfg.icon;
                const active = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "bg-card shadow-sm border border-border " + cfg.color
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
            <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
              <Zap className="w-3 h-3" />
              {currentMode.sublabel}
            </Badge>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="chat" className="text-xs gap-1.5 px-3">
                <MessageCircle className="w-3 h-3" /> Chat
              </TabsTrigger>
              <TabsTrigger value="import" className="text-xs gap-1.5 px-3">
                <FileUp className="w-3 h-3" /> Importar Arquivo
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Agent selector for Focus mode */}
        {mode === "focus" && activeTab === "chat" && (
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
            <Button size="sm" variant={!selectedAgent ? "default" : "outline"}
              onClick={() => { setSelectedAgent(undefined); setMessages([]); }}
              className="shrink-0 gap-1.5 text-xs">
              <Sparkles className="w-3 h-3" /> Geral
            </Button>
            {agents.map(a => (
              <Button key={a.id} size="sm" variant={selectedAgent === a.id ? "default" : "outline"}
                onClick={() => { setSelectedAgent(a.id); setMessages([]); }}
                className="shrink-0 gap-1.5 text-xs">
                <Bot className="w-3 h-3" />
                {a.nome.replace(" Agent", "")}
              </Button>
            ))}
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum agente disponível para seu setor.</p>
            )}
          </div>
        )}

        {activeTab === "chat" ? (
          /* Chat area */
          <Card className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className={`w-14 h-14 rounded-2xl ${currentMode.bg} flex items-center justify-center mb-4`}>
                    <currentMode.icon className={`w-7 h-7 ${currentMode.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold">{agentName}</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    {mode === "focus" && selectedAgent
                      ? agents.find(a => a.id === selectedAgent)?.descricao
                      : currentMode.description}
                  </p>
                  {profile?.setor && profile.setor !== "Diretoria" && role !== "admin" && (
                    <Badge variant="outline" className="mt-3 text-xs">
                      Setor: {profile.setor}
                    </Badge>
                  )}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && (
                    <div className={`w-8 h-8 rounded-full ${currentMode.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <currentMode.icon className={`w-4 h-4 ${currentMode.color}`} />
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
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
                  placeholder={mode === "assistant"
                    ? "Pergunte algo ao Assistente IA..."
                    : "Consulte o Focus AI sobre dados e operações..."}
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
        ) : (
          /* Import tab */
          <Card className="flex-1 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <h2 className="text-lg font-semibold">Importar Planilhas & Arquivos</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Envie as planilhas e arquivos Excel/CSV que você usa no dia a dia. A IA vai analisar o propósito de cada um e sugerir como o HexaOS pode substituí-los.
                </p>
              </div>
              <FileImportPanel />
            </div>
          </Card>
        )}
      </div>
    </HexaLayout>
  );
}
