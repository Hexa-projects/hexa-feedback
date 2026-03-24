import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Hash, Send, Users, Loader2, Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Channel {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  is_ai: boolean;
  created_at: string;
  parent_id: string | null;
  profiles?: { nome: string } | null;
}

export default function CorporateChannels() {
  const { user, profile } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (activeChannel) loadMessages(activeChannel);
  }, [activeChannel]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!activeChannel) return;
    const sub = supabase
      .channel(`ch-${activeChannel}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "channel_messages",
        filter: `channel_id=eq.${activeChannel}`,
      }, (payload) => {
        const msg = payload.new as any;
        // Add profile name for current user messages
        if (msg.user_id === user?.id) {
          msg.profiles = { nome: profile?.nome || "Você" };
        }
        setMessages(prev => [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeChannel, user?.id]);

  const loadChannels = async () => {
    const { data } = await supabase.from("corporate_channels" as any).select("id, nome, slug, descricao").eq("ativo", true).order("nome");
    const ch = (data || []) as unknown as Channel[];
    setChannels(ch);
    if (ch.length > 0 && !activeChannel) setActiveChannel(ch[0].id);
  };

  const loadMessages = async (channelId: string) => {
    const { data } = await supabase
      .from("channel_messages" as any)
      .select("id, channel_id, user_id, content, is_ai, created_at, parent_id")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(100);
    
    // Fetch profile names for all unique user_ids
    const msgs = (data || []) as unknown as Message[];
    const userIds = [...new Set(msgs.map(m => m.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, nome").in("id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p.nome]));
      msgs.forEach(m => {
        m.profiles = { nome: profileMap.get(m.user_id) || "Usuário" };
      });
    }
    setMessages(msgs);
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("channel_messages" as any).insert({
      channel_id: activeChannel,
      user_id: user.id,
      content: input.trim(),
    } as any);
    if (error) toast.error("Erro ao enviar mensagem");
    setInput("");
    setSending(false);
  };

  const activeChannelData = channels.find(c => c.id === activeChannel);

  return (
    <HexaLayout>
      <div className="flex h-[calc(100vh-7rem)] gap-4 animate-slide-up">
        {/* Channel list */}
        <div className="w-56 shrink-0 hidden md:flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Canais</h2>
          </div>
          <div className="space-y-0.5 flex-1 overflow-y-auto">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeChannel === ch.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Hash className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{ch.nome.replace("#", "")}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Channel header */}
          <div className="border-b px-4 py-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{activeChannelData?.nome.replace("#", "") || "Selecione um canal"}</span>
            {activeChannelData?.descricao && (
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">— {activeChannelData.descricao}</span>
            )}
            {/* Mobile channel selector */}
            <div className="ml-auto md:hidden">
              <select
                className="text-sm border rounded px-2 py-1 bg-background"
                value={activeChannel || ""}
                onChange={e => setActiveChannel(e.target.value)}
              >
                {channels.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma mensagem ainda. Comece a conversa!</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3 group">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
                  m.is_ai ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {m.is_ai ? "IA" : (m.profiles?.nome || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{m.is_ai ? "Focus AI" : (m.profiles?.nome || "Usuário")}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap mt-0.5">{m.content}</p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`Mensagem em ${activeChannelData?.nome || "canal"}...`}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
              />
              <Button onClick={sendMessage} disabled={sending || !input.trim()} size="icon" className="shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </HexaLayout>
  );
}
