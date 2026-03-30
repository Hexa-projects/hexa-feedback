import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Send, Check, CheckCheck, Loader2, MessageSquare,
  Info, X, Bot, User, Pause, Play, Phone
} from 'lucide-react';
import { MessageDirection, MessageType, UIConversation, UIMessage, ConversationStatus } from '@/types/sdr';
import { useSDRConversations } from '@/hooks/useSDRConversations';
import { Button } from '@/components/ui/button';
import { HexaLayout } from '@/components/HexaLayout';

export default function WhatsAppChatPage() {
  const { conversations, loading, sendMessage, updateStatus, markAsRead } = useSDRConversations();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const activeChat = conversations.find(c => c.id === selectedChatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first conversation on desktop
  useEffect(() => {
    if (conversations.length > 0 && !selectedChatId && window.innerWidth >= 768) {
      setSelectedChatId(conversations[0].id);
    }
  }, [conversations, selectedChatId]);

  useEffect(() => {
    if (selectedChatId && (activeChat?.unreadCount ?? 0) > 0) {
      markAsRead(selectedChatId);
    }
  }, [selectedChatId, activeChat?.unreadCount, markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeChat) return;
    const content = inputText.trim();
    setInputText('');
    await sendMessage(activeChat.id, content);
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.contactName.toLowerCase().includes(q) || c.contactPhone.includes(q);
  });

  const renderStatusBadge = (status: ConversationStatus) => {
    const cfg = {
      nina: { label: 'Nina IA', icon: Bot, cls: 'bg-primary/20 text-primary border-primary/30' },
      human: { label: 'Humano', icon: User, cls: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' },
      paused: { label: 'Pausado', icon: Pause, cls: 'bg-amber-500/20 text-amber-600 border-amber-500/30' },
    };
    const { label, icon: Icon, cls } = cfg[status];
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${cls}`}>
        <Icon className="w-3 h-3" /> {label}
      </span>
    );
  };

  const renderMessageContent = (msg: UIMessage) => {
    if (msg.type === MessageType.AUDIO) {
      return (
        <div className="flex items-center gap-2 min-w-[180px]">
          <Play className="w-4 h-4" />
          <div className="flex-1 h-1 bg-muted rounded-full">
            <div className="h-full w-0 bg-primary rounded-full" />
          </div>
          <span className="text-[10px] text-muted-foreground">Áudio</span>
        </div>
      );
    }
    if (msg.type === MessageType.IMAGE && msg.mediaUrl) {
      return <img src={msg.mediaUrl} alt="Anexo" className="rounded-lg max-w-full max-h-48 object-cover border border-border" />;
    }
    return <p className="leading-relaxed whitespace-pre-wrap text-sm">{msg.content}</p>;
  };

  if (loading) {
    return (
      <HexaLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-sm text-muted-foreground">Sincronizando conversas...</p>
        </div>
      </HexaLayout>
    );
  }

  return (
    <HexaLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden border border-border rounded-xl bg-card">
        {/* Left: Conversation List */}
        <div className={`w-80 flex-shrink-0 border-r border-border flex flex-col bg-card ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground mb-3">WhatsApp SDR</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <MessageSquare className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">Nenhuma conversa</p>
              </div>
            ) : (
              filteredConversations.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => { setSelectedChatId(chat.id); setMobileView('chat'); }}
                  className={`w-full p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors border-b border-border/50 text-left ${
                    selectedChatId === chat.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <img src={chat.contactAvatar} alt="" className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground truncate">{chat.contactName}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{chat.lastMessageTime}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {renderStatusBadge(chat.status)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{chat.lastMessage}</p>
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {chat.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Chat Area */}
        <div className={`flex-1 flex flex-col ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
          {!activeChat ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm mt-1">Escolha um contato para iniciar o atendimento</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <button className="md:hidden mr-2" onClick={() => setMobileView('list')}>
                    <X className="w-5 h-5" />
                  </button>
                  <img src={activeChat.contactAvatar} alt="" className="w-9 h-9 rounded-full" />
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{activeChat.contactName}</h3>
                    <p className="text-xs text-muted-foreground">{activeChat.contactPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status toggles */}
                  <Button size="sm" variant={activeChat.status === 'nina' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => updateStatus(activeChat.id, 'nina')}>
                    <Bot className="w-3 h-3 mr-1" /> Nina
                  </Button>
                  <Button size="sm" variant={activeChat.status === 'human' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => updateStatus(activeChat.id, 'human')}>
                    <User className="w-3 h-3 mr-1" /> Humano
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowProfile(!showProfile)}>
                    <Info className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
                  {activeChat.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === MessageDirection.OUTGOING ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                        msg.direction === MessageDirection.OUTGOING
                          ? msg.fromType === 'nina'
                            ? 'bg-primary/80 text-primary-foreground'
                            : 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-foreground'
                      }`}>
                        {msg.fromType === 'nina' && msg.direction === MessageDirection.OUTGOING && (
                          <span className="text-[9px] font-medium opacity-70 flex items-center gap-1 mb-1">
                            <Bot className="w-2.5 h-2.5" /> Nina IA
                          </span>
                        )}
                        {renderMessageContent(msg)}
                        <div className={`flex items-center gap-1 mt-1 ${
                          msg.direction === MessageDirection.OUTGOING ? 'justify-end' : 'justify-start'
                        }`}>
                          <span className="text-[10px] opacity-60">{msg.timestamp}</span>
                          {msg.direction === MessageDirection.OUTGOING && (
                            msg.status === 'read' ? <CheckCheck className="w-3 h-3 text-sky-300" /> : <Check className="w-3 h-3 opacity-60" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Profile Panel */}
                {showProfile && (
                  <div className="w-72 border-l border-border bg-card p-4 overflow-y-auto hidden lg:block">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-sm text-foreground">Perfil</h4>
                      <button onClick={() => setShowProfile(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>
                    <div className="flex flex-col items-center mb-4">
                      <img src={activeChat.contactAvatar} alt="" className="w-16 h-16 rounded-full mb-2" />
                      <h5 className="font-bold text-foreground">{activeChat.contactName}</h5>
                      <p className="text-xs text-muted-foreground">{activeChat.contactPhone}</p>
                    </div>

                    {activeChat.empresa && (
                      <div className="mb-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Empresa</p>
                        <p className="text-sm text-foreground">{activeChat.empresa}</p>
                      </div>
                    )}

                    {activeChat.linhaNegocio && (
                      <div className="mb-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Linha de Negócio</p>
                        <p className="text-sm text-foreground">{activeChat.linhaNegocio}</p>
                      </div>
                    )}

                    {activeChat.clientMemory.lead_profile.qualification_score > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Score</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${activeChat.clientMemory.lead_profile.qualification_score}%` }} />
                          </div>
                          <span className="text-xs font-bold text-foreground">{activeChat.clientMemory.lead_profile.qualification_score}%</span>
                        </div>
                      </div>
                    )}

                    {activeChat.tags.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Tags</p>
                        <div className="flex flex-wrap gap-1">
                          {activeChat.tags.map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeChat.resumoVivo && (
                      <div className="mb-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Resumo Vivo</p>
                        <p className="text-xs text-foreground mt-1">{activeChat.resumoVivo}</p>
                      </div>
                    )}

                    {activeChat.clientMemory.sales_intelligence.pain_points.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pain Points</p>
                        <ul className="list-disc list-inside text-xs text-foreground mt-1">
                          {activeChat.clientMemory.sales_intelligence.pain_points.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input Area */}
              <form onSubmit={handleSend} className="p-3 border-t border-border bg-card flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Digitar mensagem..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
                <Button type="submit" size="sm" disabled={!inputText.trim()} className="h-10 w-10 p-0 rounded-xl">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </HexaLayout>
  );
}
