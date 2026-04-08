import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Brain, Shield, CheckCircle2, XCircle, Send,
  AlertTriangle, Lightbulb, Terminal, Eye,
  TrendingUp, Clock, Zap, Activity,
  Target, Wrench, Package, DollarSign, Bot
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogEntry {
  id: string;
  tipo: string;
  mensagem: string;
  created_at: string;
  detalhes?: any;
}

interface ActionRequest {
  id: string;
  action_type: string;
  domain: string;
  title: string;
  description: string | null;
  reason: string;
  risk_level: string | null;
  status: string | null;
  created_at: string | null;
  estimated_impact: string | null;
  autonomy_level: string | null;
}

interface Insight {
  id: string;
  tipo: string | null;
  titulo: string;
  descricao: string | null;
  status: string | null;
  prioridade: string | null;
  domain: string | null;
  acao_recomendada: string | null;
  impacto_estimado: string | null;
  created_at: string | null;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string | null;
  metadata: any;
}

// Agent definitions
const AGENTS = [
  { key: "focus", name: "Focus AI", role: "Orquestrador & Estratégia", icon: Brain, color: "from-purple-500 to-violet-600", pulse: "bg-purple-400", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { key: "hunter", name: "Hunter", role: "Comercial & CRM", icon: Target, color: "from-orange-500 to-amber-600", pulse: "bg-orange-400", badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { key: "gear", name: "Gear", role: "Operações & SLA", icon: Wrench, color: "from-blue-500 to-cyan-600", pulse: "bg-blue-400", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { key: "tracker", name: "Tracker", role: "Estoque & Laboratório", icon: Package, color: "from-emerald-500 to-green-600", pulse: "bg-emerald-400", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { key: "ledger", name: "Ledger", role: "Financeiro & Rentabilidade", icon: DollarSign, color: "from-yellow-500 to-amber-500", pulse: "bg-yellow-400", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
];

export default function FocusAI() {
  const { user, role } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [actions, setActions] = useState<ActionRequest[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || role !== "admin") return;
    loadAll();
    const interval = setInterval(loadLogs, 8000);
    return () => clearInterval(interval);
  }, [user, role]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = 0;
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadLogs(), loadActions(), loadInsights(), loadMessages()]);
    setLoading(false);
  };

  const loadLogs = async () => {
    const { data } = await supabase.from("focus_ai_logs").select("*").order("created_at", { ascending: false }).limit(80);
    if (data) setLogs(data as any);
  };

  const loadActions = async () => {
    const { data } = await supabase.from("ai_action_requests").select("*").in("status", ["pending", "pending_approval"]).order("created_at", { ascending: false }).limit(20);
    if (data) setActions(data as any);
  };

  const loadInsights = async () => {
    const { data } = await supabase.from("focus_ai_insights").select("*").order("created_at", { ascending: false }).limit(30);
    if (data) setInsights(data as any);
  };

  const loadMessages = async () => {
    if (!user) return;
    const { data } = await supabase.from("ai_chat_messages").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(50);
    if (data) setMessages(data as any);
  };

  const handleApprove = async (id: string) => {
    await supabase.from("ai_action_requests").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
    toast.success("Ação aprovada — o agente executará em breve.");
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const handleReject = async (id: string) => {
    await supabase.from("ai_action_requests").update({ status: "rejected" }).eq("id", id);
    toast.info("Ação rejeitada.");
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const sendCommand = async () => {
    if (!chatInput.trim() || !user) return;
    setSending(true);
    const content = chatInput.trim();
    setChatInput("");

    const userMsg = { id: crypto.randomUUID(), role: "user", content, created_at: new Date().toISOString(), metadata: {} };
    setMessages(prev => [...prev, userMsg as any]);

    await supabase.from("ai_chat_messages").insert({ user_id: user.id, role: "user", content, metadata: { source: "focus_command" } });

    const ackMsg = {
      id: crypto.randomUUID(), role: "assistant",
      content: "📡 Comando recebido. O agente processará sua solicitação.",
      created_at: new Date().toISOString(),
      metadata: { actor_id: "focus_ai" },
    };
    setMessages(prev => [...prev, ackMsg as any]);
    await supabase.from("ai_chat_messages").insert({ user_id: user.id, role: "assistant", content: ackMsg.content, metadata: ackMsg.metadata });
    setSending(false);
  };

  const logTypeColor = (tipo: string) => {
    switch (tipo) {
      case "erro": return "text-red-400";
      case "sucesso": return "text-emerald-400";
      case "alerta": return "text-amber-400";
      default: return "text-cyan-400";
    }
  };

  const logTypePrefix = (tipo: string) => {
    switch (tipo) {
      case "erro": return "[ERR]";
      case "sucesso": return "[OK!]";
      case "alerta": return "[WRN]";
      default: return "[SYS]";
    }
  };

  const riskColor = (risk: string | null) => {
    switch (risk) {
      case "critical": return "bg-red-500/20 text-red-300 border-red-500/30";
      case "high": return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      case "medium": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default: return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
    }
  };

  const priorityIcon = (p: string | null) => {
    switch (p) {
      case "Alta": case "Crítica": return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "Média": return <TrendingUp className="w-4 h-4 text-amber-400" />;
      default: return <Lightbulb className="w-4 h-4 text-cyan-400" />;
    }
  };

  if (role !== "admin") {
    return (
      <HexaLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md"><CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground text-sm">Centro de Comando exclusivo para Diretoria.</p>
          </CardContent></Card>
        </div>
      </HexaLayout>
    );
  }

  return (
    <HexaLayout>
      <div className="hermes-shell animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                THE SWARM <span className="text-xs font-normal text-cyan-400 tracking-widest">COMMAND CENTER</span>
              </h1>
              <p className="text-xs text-slate-400">Ecossistema Multi-Agentes • Monitoramento 24/7</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {AGENTS.map(agent => (
            <Card key={agent.key} className="bg-slate-900/60 border-slate-700/50 hover:border-slate-600 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center`}>
                    <agent.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{agent.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{agent.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${agent.pulse} animate-pulse`} />
                  <span className="text-[10px] text-slate-400">Monitorando</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 4-panel grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-380px)] min-h-[500px]">

          {/* 1. ACTIVITY FEED */}
          <div className="hermes-panel flex flex-col">
            <div className="hermes-panel-header">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Activity Feed (Logs)</span>
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse ml-auto" />
            </div>
            <div ref={terminalRef} className="hermes-terminal flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-slate-500 text-xs p-4">Carregando logs...</p>
              ) : logs.length === 0 ? (
                <p className="text-slate-500 text-xs p-4">Nenhuma atividade registrada.</p>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="hermes-log-line group">
                    <span className="text-slate-600 text-[10px] shrink-0 w-14 font-mono">
                      {format(new Date(log.created_at), "HH:mm:ss")}
                    </span>
                    <span className={`text-[10px] font-mono font-bold shrink-0 w-8 ${logTypeColor(log.tipo)}`}>
                      {logTypePrefix(log.tipo)}
                    </span>
                    <span className="text-slate-300 text-xs font-mono truncate group-hover:whitespace-normal">
                      {log.mensagem}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. FILA DE APROVAÇÕES */}
          <div className="hermes-panel flex flex-col">
            <div className="hermes-panel-header">
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Fila de Aprovações</span>
              {actions.length > 0 && (
                <Badge className="ml-auto bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                  {actions.length} pendente{actions.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {actions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/30 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">Nenhuma ação pendente</p>
                  </div>
                ) : (
                  actions.map(action => (
                    <div key={action.id} className={`rounded-lg border p-3 space-y-2 ${riskColor(action.risk_level)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{action.title}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{action.domain} • {action.action_type}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 border-slate-600 text-slate-400">
                          {action.risk_level || "low"}
                        </Badge>
                      </div>
                      {action.description && <p className="text-xs text-slate-300 line-clamp-2">{action.description}</p>}
                      <p className="text-xs text-slate-400 italic">Razão: {action.reason}</p>
                      {action.estimated_impact && <p className="text-[10px] text-cyan-300">⚡ Impacto: {action.estimated_impact}</p>}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={() => handleApprove(action.id)}
                          className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> APROVAR
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(action.id)}
                          className="flex-1 h-8 border-red-500/40 text-red-400 hover:bg-red-500/20 text-xs font-bold gap-1">
                          <XCircle className="w-3.5 h-3.5" /> REJEITAR
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* 3. INSIGHTS & GARGALOS */}
          <div className="hermes-panel flex flex-col">
            <div className="hermes-panel-header">
              <Lightbulb className="w-4 h-4 text-purple-400" />
              <span>Insights & Gargalos</span>
              <span className="ml-auto text-[10px] text-slate-500">{insights.length} registros</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {insights.length === 0 ? (
                  <div className="text-center py-12">
                    <Lightbulb className="w-8 h-8 text-purple-500/20 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">Nenhum insight publicado ainda.</p>
                  </div>
                ) : (
                  insights.map(ins => (
                    <div key={ins.id} className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3 hover:bg-slate-800/70 transition-colors">
                      <div className="flex items-start gap-2">
                        {priorityIcon(ins.prioridade)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{ins.titulo}</p>
                            {ins.status && (
                              <Badge variant="outline" className="text-[10px] shrink-0 border-slate-600 text-slate-400">{ins.status}</Badge>
                            )}
                          </div>
                          {ins.descricao && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ins.descricao}</p>}
                          {ins.acao_recomendada && (
                            <p className="text-[10px] text-cyan-400 mt-1 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> {ins.acao_recomendada}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            {ins.domain && <span className="text-[10px] text-slate-500 uppercase">{ins.domain}</span>}
                            {ins.created_at && (
                              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(ins.created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* 4. CHAT DE COMANDO */}
          <div className="hermes-panel flex flex-col">
            <div className="hermes-panel-header">
              <Send className="w-4 h-4 text-blue-400" />
              <span>Chat de Comando</span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <Send className="w-8 h-8 text-blue-500/20 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">Envie uma ordem ao sistema.</p>
                    <p className="text-slate-600 text-[10px] mt-1">Ex: "Resumo das OS de hoje" ou "Analise o onboarding do João"</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      msg.role === "user"
                        ? "bg-blue-600/30 text-blue-100 border border-blue-500/20"
                        : "bg-slate-800 text-slate-300 border border-slate-700/50"
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.created_at && (
                        <p className="text-[10px] text-slate-500 mt-1 text-right">{format(new Date(msg.created_at), "HH:mm")}</p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-slate-700/50">
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCommand(); } }}
                  placeholder="Envie uma ordem..."
                  className="hermes-input min-h-[36px] max-h-[80px] resize-none text-xs"
                  rows={1}
                />
                <Button
                  onClick={sendCommand}
                  disabled={sending || !chatInput.trim()}
                  size="icon"
                  className="shrink-0 h-9 w-9 bg-blue-600 hover:bg-blue-500"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HexaLayout>
  );
}
