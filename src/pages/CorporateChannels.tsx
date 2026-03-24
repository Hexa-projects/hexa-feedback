import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Hash, Send, Users, Loader2, Plus, MessageSquare, Search, User,
  Lock, Globe, Mic, Square, Play, Pause, X, Paperclip, CheckSquare,
  AlertTriangle, Image as ImageIcon, FileText, Download, ListTodo
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = "https://fevmcjnaeuxydmxmkarw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldm1jam5hZXV4eWRteG1rYXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjM1MDcsImV4cCI6MjA4OTkzOTUwN30.oHTGDmdVb2kXj0HR8GJWjGBeuCjDY0w3x4aJ-qJIT-4";

interface Channel {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  tipo: string;
  setor: string | null;
}

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  is_ai: boolean;
  created_at: string;
  parent_id: string | null;
  tipo: string | null;
  anexo_url: string | null;
  profiles?: { nome: string } | null;
}

interface ChannelTask {
  id: string;
  titulo: string;
  status: string;
  assigned_to: string | null;
  prioridade: string;
  created_at: string;
}

interface ProfileEntry {
  id: string;
  nome: string;
  setor: string;
  funcao: string | null;
}

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 max-w-xs">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a) setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={toggle}>
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </Button>
      <div className="flex-1 min-w-[80px]">
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{fmt(duration)}</span>
    </div>
  );
}

function AttachmentPreview({ url, tipo }: { url: string; tipo?: string | null }) {
  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || tipo === "imagem";
  const isPdf = url.match(/\.pdf$/i) || tipo === "pdf";

  if (isImage) {
    return (
      <div className="mt-1 max-w-xs">
        <img src={url} alt="Anexo" className="rounded-lg border max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, "_blank")} />
      </div>
    );
  }
  if (isPdf) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 max-w-xs hover:bg-muted transition-colors">
        <FileText className="w-5 h-5 text-destructive" />
        <span className="text-sm truncate flex-1">Documento PDF</span>
        <Download className="w-4 h-4 text-muted-foreground" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 max-w-xs hover:bg-muted transition-colors">
      <Paperclip className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm truncate flex-1">Arquivo anexo</span>
      <Download className="w-4 h-4 text-muted-foreground" />
    </a>
  );
}

type Tab = "canais" | "diretas";
type SidePanel = "none" | "tasks";

export default function CorporateChannels() {
  const { user, profile, role } = useAuth();
  const canManage = role === "admin" || role === "gestor";

  const [tab, setTab] = useState<Tab>("canais");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allProfiles, setAllProfiles] = useState<ProfileEntry[]>([]);
  const [dmTargetId, setDmTargetId] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<Message[]>([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({ nome: "", descricao: "", tipo: "publico", setor: "" });
  const [creating, setCreating] = useState(false);
  const [onlineCount] = useState(Math.floor(Math.random() * 8) + 3);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Tasks
  const [sidePanel, setSidePanel] = useState<SidePanel>("none");
  const [tasks, setTasks] = useState<ChannelTask[]>([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskFromMsg, setTaskFromMsg] = useState<Message | null>(null);
  const [newTask, setNewTask] = useState({ titulo: "", descricao: "", assigned_to: "", prioridade: "media" });

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadChannels(); loadProfiles(); }, []);

  useEffect(() => {
    if (tab === "canais" && activeChannel) {
      loadMessages(activeChannel);
      loadTasks(activeChannel);
    }
  }, [activeChannel, tab]);

  useEffect(() => {
    if (tab === "diretas" && dmTargetId && user) loadDMMessages();
  }, [dmTargetId, tab]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, dmMessages]);

  // Realtime for channels
  useEffect(() => {
    if (!activeChannel || tab !== "canais") return;
    const sub = supabase
      .channel(`ch-${activeChannel}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "channel_messages",
        filter: `channel_id=eq.${activeChannel}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.user_id === user?.id) msg.profiles = { nome: profile?.nome || "Você" };
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeChannel, tab, user?.id]);

  const loadChannels = async () => {
    const { data } = await supabase
      .from("corporate_channels" as any)
      .select("id, nome, slug, descricao, tipo, setor")
      .eq("ativo", true)
      .order("tipo").order("nome");
    const ch = (data || []) as unknown as Channel[];
    setChannels(ch);
    if (ch.length > 0 && !activeChannel) setActiveChannel(ch[0].id);
  };

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, nome, setor, funcao");
    setAllProfiles((data || []) as ProfileEntry[]);
  };

  const loadMessages = async (channelId: string) => {
    const { data } = await supabase
      .from("channel_messages" as any)
      .select("id, channel_id, user_id, content, is_ai, created_at, parent_id, tipo, anexo_url")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true }).limit(200);
    const msgs = (data || []) as unknown as Message[];
    await enrichProfiles(msgs);
    setMessages(msgs);
  };

  const loadDMMessages = async () => { setDmMessages([]); };

  const loadTasks = async (channelId: string) => {
    const { data } = await supabase
      .from("channel_tasks" as any)
      .select("id, titulo, status, assigned_to, prioridade, created_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false }).limit(50);
    setTasks((data || []) as unknown as ChannelTask[]);
  };

  const enrichProfiles = async (msgs: Message[]) => {
    const ids = [...new Set(msgs.map(m => m.user_id))];
    if (!ids.length) return;
    const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
    const map = new Map((profs || []).map(p => [p.id, p.nome]));
    msgs.forEach(m => { m.profiles = { nome: map.get(m.user_id) || "Usuário" }; });
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("channel_messages" as any).insert({
      channel_id: activeChannel, user_id: user.id, content: input.trim(), tipo: "texto",
    } as any);
    if (error) toast.error("Erro ao enviar mensagem");
    setInput("");
    setSending(false);
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel || !user) return;
    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `channels/${activeChannel}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attachments").upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(uploadData.path);
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";

      await supabase.from("channel_messages" as any).insert({
        channel_id: activeChannel,
        user_id: user.id,
        content: isImage ? `📷 ${file.name}` : `📎 ${file.name}`,
        tipo: isImage ? "imagem" : isPdf ? "pdf" : "arquivo",
        anexo_url: urlData.publicUrl,
      } as any);

      toast.success("Arquivo enviado!");
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Audio recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      });
      audioChunksRef.current = [];
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        sendAudioMessage(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
      mr.start(250);
      setIsRecording(true);
      setRecordingDuration(0);
      recTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch { toast.error("Não foi possível acessar o microfone."); }
  }, [activeChannel, user]);

  const stopRecording = useCallback(() => { mediaRecorderRef.current?.stop(); setIsRecording(false); }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const sendAudioMessage = async (blob: Blob) => {
    if (!activeChannel || !user) return;
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const transcribeRes = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-transcribe`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: formData,
      });
      let transcription = "";
      if (transcribeRes.ok) {
        const data = await transcribeRes.json();
        transcription = data.text || "";
      }

      const fileName = `channels/${activeChannel}/${Date.now()}.webm`;
      const { data: uploadData } = await supabase.storage.from("audio-messages").upload(fileName, blob, { contentType: "audio/webm" });
      let audioUrl = "";
      if (uploadData?.path) {
        const { data: urlData } = supabase.storage.from("audio-messages").getPublicUrl(uploadData.path);
        audioUrl = urlData.publicUrl;
      }

      const content = transcription ? `🎤 Áudio: ${transcription}` : "🎤 Mensagem de áudio";
      await supabase.from("channel_messages" as any).insert({
        channel_id: activeChannel, user_id: user.id, content, tipo: "audio", anexo_url: audioUrl || null,
      } as any);
      toast.success("Áudio enviado!");
    } catch (err: any) { toast.error("Erro ao processar áudio: " + err.message); }
    finally { setTranscribing(false); }
  };

  // Task creation from message
  const openCreateTaskFromMsg = (msg: Message) => {
    setTaskFromMsg(msg);
    setNewTask({
      titulo: msg.content.slice(0, 100),
      descricao: msg.content,
      assigned_to: "",
      prioridade: "media",
    });
    setShowCreateTask(true);
  };

  const createTask = async () => {
    if (!newTask.titulo.trim() || !activeChannel || !user) return;
    setCreating(true);
    const { error } = await supabase.from("channel_tasks" as any).insert({
      channel_id: activeChannel,
      created_by: user.id,
      message_id: taskFromMsg?.id || null,
      titulo: newTask.titulo.trim(),
      descricao: newTask.descricao,
      assigned_to: newTask.assigned_to || null,
      prioridade: newTask.prioridade,
    } as any);
    if (error) toast.error("Erro ao criar tarefa");
    else {
      toast.success("Tarefa criada!");
      setShowCreateTask(false);
      setTaskFromMsg(null);
      setNewTask({ titulo: "", descricao: "", assigned_to: "", prioridade: "media" });
      if (activeChannel) loadTasks(activeChannel);
    }
    setCreating(false);
  };

  const toggleTaskStatus = async (task: ChannelTask) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    await supabase.from("channel_tasks" as any).update({ status: newStatus } as any).eq("id", task.id);
    if (activeChannel) loadTasks(activeChannel);
  };

  const createChannel = async () => {
    if (!newChannel.nome.trim() || !user) return;
    setCreating(true);
    const slug = newChannel.nome.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const { error } = await supabase.from("corporate_channels" as any).insert({
      nome: newChannel.nome.trim(), slug, descricao: newChannel.descricao.trim() || null,
      tipo: newChannel.tipo, setor: newChannel.setor || null, criado_por: user.id,
    } as any);
    if (error) toast.error("Erro ao criar canal");
    else {
      toast.success("Canal criado!");
      setShowCreateChannel(false);
      setNewChannel({ nome: "", descricao: "", tipo: "publico", setor: "" });
      loadChannels();
    }
    setCreating(false);
  };

  const fmtDur = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const activeChannelData = channels.find(c => c.id === activeChannel);
  const otherProfiles = allProfiles.filter(p => p.id !== user?.id);

  const filteredChannels = channels.filter(c => c.nome.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredProfiles = otherProfiles.filter(p => p.nome.toLowerCase().includes(searchQuery.toLowerCase()));

  const groupedMessages = useMemo(() => {
    const currentMsgs = tab === "canais" ? messages : dmMessages;
    const groups: { date: string; messages: Message[] }[] = [];
    let lastDate = "";
    currentMsgs.forEach(m => {
      const d = new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      if (d !== lastDate) { groups.push({ date: d, messages: [m] }); lastDate = d; }
      else groups[groups.length - 1].messages.push(m);
    });
    return groups;
  }, [messages, dmMessages, tab]);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (id: string) => {
    const colors = [
      "bg-primary/20 text-primary", "bg-hexa-green/20 text-hexa-green",
      "bg-hexa-purple/20 text-hexa-purple", "bg-hexa-blue/20 text-hexa-blue",
      "bg-hexa-teal/20 text-hexa-teal", "bg-hexa-amber/20 text-hexa-amber-dark",
    ];
    return colors[id.charCodeAt(0) % colors.length];
  };

  const dmTarget = otherProfiles.find(p => p.id === dmTargetId);
  const pendingTasks = tasks.filter(t => t.status !== "concluida").length;

  return (
    <HexaLayout>
      <div className="flex h-[calc(100vh-7rem)] gap-0 animate-slide-up">
        {/* ───── LEFT PANEL ───── */}
        <div className="w-72 shrink-0 hidden md:flex flex-col bg-card border-r rounded-l-xl overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Mensagens</h2>
              {canManage && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowCreateChannel(true)} title="Novo canal">
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar conversa..." className="pl-8 h-8 text-sm bg-muted/50 border-0" />
            </div>
          </div>

          <div className="flex border-b">
            {(["canais", "diretas"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <div className="flex items-center justify-center gap-1.5">
                  {t === "canais" ? <Hash className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  {t === "canais" ? "Canais" : "Diretas"}
                </div>
                {tab === t && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "canais" && (
              <div className="p-2 space-y-0.5">
                {filteredChannels.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Nenhum canal encontrado</p>}
                {filteredChannels.map(ch => (
                  <button key={ch.id} onClick={() => { setActiveChannel(ch.id); setDmTargetId(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      activeChannel === ch.id && !dmTargetId
                        ? "bg-primary/8 text-foreground font-medium shadow-sm border border-primary/15"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      ch.tipo === "privado" ? "bg-hexa-amber/15 text-hexa-amber-dark" :
                      ch.slug === "alertas-ia" ? "bg-hexa-purple/15 text-hexa-purple" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {ch.slug === "alertas-ia" ? <AlertTriangle className="w-3.5 h-3.5" /> :
                       ch.tipo === "privado" ? <Lock className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm truncate">{ch.nome}</p>
                      {ch.setor && <p className="text-[10px] text-muted-foreground truncate">{ch.setor}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {tab === "diretas" && (
              <div className="p-2 space-y-0.5">
                {filteredProfiles.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Nenhum colaborador encontrado</p>}
                {filteredProfiles.map(p => (
                  <button key={p.id} onClick={() => { setDmTargetId(p.id); setActiveChannel(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      dmTargetId === p.id ? "bg-primary/8 text-foreground font-medium shadow-sm border border-primary/15" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${getAvatarColor(p.id)}`}>
                      {getInitials(p.nome)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.funcao || p.setor}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-hexa-green shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-hexa-green" />
              <span>{onlineCount} online agora</span>
            </div>
          </div>
        </div>

        {/* ───── CENTER: CHAT AREA ───── */}
        <div className="flex-1 flex flex-col bg-card overflow-hidden border border-l-0 md:border-l-0">
          {/* Chat header */}
          {(activeChannel || dmTargetId) ? (
            <div className="border-b px-5 py-3.5 flex items-center gap-3 bg-card">
              {tab === "canais" && activeChannelData ? (
                <>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    activeChannelData.slug === "alertas-ia" ? "bg-hexa-purple/15 text-hexa-purple" :
                    activeChannelData.tipo === "privado" ? "bg-hexa-amber/15 text-hexa-amber-dark" : "bg-primary/10 text-primary"
                  }`}>
                    {activeChannelData.slug === "alertas-ia" ? <AlertTriangle className="w-4 h-4" /> :
                     activeChannelData.tipo === "privado" ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{activeChannelData.nome}</h3>
                    {activeChannelData.descricao && <p className="text-xs text-muted-foreground truncate">{activeChannelData.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={sidePanel === "tasks" ? "default" : "ghost"}
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setSidePanel(sidePanel === "tasks" ? "none" : "tasks")}
                    >
                      <ListTodo className="w-3.5 h-3.5" />
                      Tarefas
                      {pendingTasks > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{pendingTasks}</Badge>
                      )}
                    </Button>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Users className="w-3 h-3" />{allProfiles.length}
                    </Badge>
                  </div>
                </>
              ) : dmTarget ? (
                <>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(dmTarget.id)}`}>
                    {getInitials(dmTarget.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{dmTarget.nome}</h3>
                    <p className="text-xs text-muted-foreground">{dmTarget.funcao || dmTarget.setor}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-hexa-green" />
                    <span className="text-xs text-muted-foreground">Online</span>
                  </div>
                </>
              ) : null}

              <div className="ml-auto md:hidden">
                <select className="text-xs border rounded px-2 py-1 bg-background" value={activeChannel || ""} onChange={e => setActiveChannel(e.target.value)}>
                  {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.nome}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="border-b px-5 py-3.5 bg-card">
              <h3 className="text-sm font-semibold text-muted-foreground">Selecione uma conversa</h3>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                  <MessageSquare className="w-7 h-7 opacity-40" />
                </div>
                <p className="text-sm font-medium mb-1">Nenhuma mensagem ainda</p>
                <p className="text-xs text-muted-foreground/70">
                  {tab === "diretas" ? "Envie uma mensagem para iniciar" : "Seja o primeiro a enviar uma mensagem"}
                </p>
              </div>
            ) : (
              groupedMessages.map((group, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">{group.date}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-1">
                    {group.messages.map((m, mi) => {
                      const isMe = m.user_id === user?.id;
                      const prevMsg = mi > 0 ? group.messages[mi - 1] : null;
                      const sameUser = prevMsg?.user_id === m.user_id;
                      const timeDiff = prevMsg ? (new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime()) / 60000 : 999;
                      const compact = sameUser && timeDiff < 5;

                      return (
                        <div key={m.id} className={`group flex gap-3 px-2 py-0.5 rounded-lg hover:bg-muted/40 transition-colors ${compact ? "" : "mt-3"}`}>
                          <div className="w-8 shrink-0">
                            {!compact && (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                                m.is_ai ? "hexa-gradient-brand text-white" : getAvatarColor(m.user_id)
                              }`}>
                                {m.is_ai ? "AI" : getInitials(m.profiles?.nome || "?")}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {!compact && (
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className={`text-sm font-semibold ${isMe ? "text-primary" : ""}`}>
                                  {m.is_ai ? "Focus AI" : (m.profiles?.nome || "Usuário")}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            )}
                            {m.tipo === "audio" && m.anexo_url ? (
                              <div className="space-y-1">
                                <AudioPlayer src={m.anexo_url} />
                                {m.content && !m.content.startsWith("🎤 Mensagem de áudio") && (
                                  <p className="text-xs text-muted-foreground italic pl-1">{m.content.replace("🎤 Áudio: ", "")}</p>
                                )}
                              </div>
                            ) : m.anexo_url && (m.tipo === "imagem" || m.tipo === "pdf" || m.tipo === "arquivo") ? (
                              <div>
                                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                <AttachmentPreview url={m.anexo_url} tipo={m.tipo} />
                              </div>
                            ) : (
                              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                            )}
                          </div>

                          {/* Action buttons on hover */}
                          <div className="hidden group-hover:flex items-start gap-0.5 shrink-0 mt-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Criar tarefa" onClick={() => openCreateTaskFromMsg(m)}>
                              <CheckSquare className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Input area */}
          {(activeChannel || dmTargetId) && (
            <div className="border-t p-4 bg-card">
              {transcribing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 px-1">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Transcrevendo e enviando áudio...</span>
                </div>
              )}

              {isRecording ? (
                <div className="flex items-center gap-3 bg-destructive/8 rounded-xl border border-destructive/20 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                    Gravando {fmtDur(recordingDuration)}
                  </span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={cancelRecording}>
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </Button>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={stopRecording}>
                    <Square className="w-3 h-3" /> Enviar
                  </Button>
                </div>
              ) : (
                <div className="relative flex items-end gap-2 bg-muted/40 rounded-xl border px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  <Input
                    value={input} onChange={e => setInput(e.target.value)}
                    placeholder={tab === "diretas" && dmTarget ? `Mensagem para ${dmTarget.nome.split(" ")[0]}...` : `Escreva em ${activeChannelData?.nome || "canal"}...`}
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-9 text-sm"
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={transcribing || uploading}
                  />
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt" onChange={handleFileUpload} />
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Gravar áudio" onClick={startRecording} disabled={transcribing || uploading}>
                      <Mic className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Anexar arquivo" onClick={() => fileInputRef.current?.click()} disabled={transcribing || uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    </Button>
                    <Button onClick={sendMessage} disabled={sending || !input.trim() || transcribing || uploading} size="icon" className="h-8 w-8 rounded-lg">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ───── RIGHT PANEL: TASKS ───── */}
        {sidePanel === "tasks" && (
          <div className="w-80 shrink-0 hidden lg:flex flex-col bg-card border-l rounded-r-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Tarefas do Canal</h3>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setTaskFromMsg(null); setNewTask({ titulo: "", descricao: "", assigned_to: "", prioridade: "media" }); setShowCreateTask(true); }}>
                <Plus className="w-3 h-3" /> Nova
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <CheckSquare className="w-8 h-8 opacity-30 mb-2" />
                  <p className="text-xs">Nenhuma tarefa ainda</p>
                </div>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className={`p-3 rounded-lg border ${t.status === "concluida" ? "bg-muted/30 opacity-60" : "bg-card"} transition-all`}>
                    <div className="flex items-start gap-2">
                      <button onClick={() => toggleTaskStatus(t)} className="mt-0.5 shrink-0">
                        <CheckSquare className={`w-4 h-4 ${t.status === "concluida" ? "text-hexa-green" : "text-muted-foreground"}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${t.status === "concluida" ? "line-through" : "font-medium"}`}>{t.titulo}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] h-4">
                            {t.prioridade === "alta" ? "🔴 Alta" : t.prioridade === "baixa" ? "🟢 Baixa" : "🟡 Média"}
                          </Badge>
                          {t.assigned_to && (
                            <span className="text-[10px] text-muted-foreground">
                              → {allProfiles.find(p => p.id === t.assigned_to)?.nome || "..."}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ───── CREATE CHANNEL DIALOG ───── */}
      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Novo Canal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome do canal</Label>
              <Input value={newChannel.nome} onChange={e => setNewChannel({ ...newChannel, nome: e.target.value })} placeholder="ex: Projetos Q3" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea value={newChannel.descricao} onChange={e => setNewChannel({ ...newChannel, descricao: e.target.value })} placeholder="Do que se trata?" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tipo</Label>
                <Select value={newChannel.tipo} onValueChange={v => setNewChannel({ ...newChannel, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publico"><div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Público</div></SelectItem>
                    <SelectItem value="privado"><div className="flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> Privado</div></SelectItem>
                    <SelectItem value="setor"><div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Setor</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Setor (opcional)</Label>
                <Select value={newChannel.setor} onValueChange={v => setNewChannel({ ...newChannel, setor: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {["Comercial", "Técnico", "Laboratório", "Administrativo", "Financeiro", "Logística", "Diretoria"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateChannel(false)}>Cancelar</Button>
            <Button onClick={createChannel} disabled={creating || !newChannel.nome.trim()}>
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar Canal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───── CREATE TASK DIALOG ───── */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckSquare className="w-5 h-5 text-primary" /> Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Título</Label>
              <Input value={newTask.titulo} onChange={e => setNewTask({ ...newTask, titulo: e.target.value })} placeholder="O que precisa ser feito?" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea value={newTask.descricao} onChange={e => setNewTask({ ...newTask, descricao: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Responsável</Label>
                <Select value={newTask.assigned_to} onValueChange={v => setNewTask({ ...newTask, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {allProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Prioridade</Label>
                <Select value={newTask.prioridade} onValueChange={v => setNewTask({ ...newTask, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">🟢 Baixa</SelectItem>
                    <SelectItem value="media">🟡 Média</SelectItem>
                    <SelectItem value="alta">🔴 Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {taskFromMsg && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Originada da mensagem:</p>
                <p className="truncate italic">"{taskFromMsg.content}"</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTask(false)}>Cancelar</Button>
            <Button onClick={createTask} disabled={creating || !newTask.titulo.trim()}>
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HexaLayout>
  );
}
