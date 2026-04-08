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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Hash, Send, Users, Loader2, Plus, MessageSquare, Search, User,
  Lock, Globe, Mic, Square, Play, Pause, X, Paperclip, CheckSquare,
  AlertTriangle, Image as ImageIcon, FileText, Download, ListTodo,
  SmilePlus, Reply, BarChart3, Bell, ChevronDown, ChevronRight,
  Target, Wrench, FlaskConical, DollarSign, Heart, Crown, MoreHorizontal,
  Check, Circle, Clock, Flame, AlertCircle, ThumbsUp, Smile, Star
} from "lucide-react";
import { toast } from "sonner";
// MeetingRoom removed — video calls deprecated in favor of MS Teams

const SUPABASE_URL = "https://fevmcjnaeuxydmxmkarw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldm1jam5hZXV4eWRteG1rYXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjM1MDcsImV4cCI6MjA4OTkzOTUwN30.oHTGDmdVb2kXj0HR8GJWjGBeuCjDY0w3x4aJ-qJIT-4";

const QUICK_REACTIONS = ["👍", "✅", "🔥", "⚠️", "❤️", "👀"];

const TEAM_ICONS: Record<string, any> = {
  target: Target, wrench: Wrench, "flask-conical": FlaskConical,
  "dollar-sign": DollarSign, heart: Heart, crown: Crown, users: Users,
};

interface Team { id: string; nome: string; slug: string; descricao: string; icone: string; cor: string; }
interface Channel { id: string; nome: string; slug: string; descricao: string | null; tipo: string; setor: string | null; team_id: string | null; }
interface Message {
  id: string; channel_id: string; user_id: string; content: string; is_ai: boolean;
  created_at: string; parent_id: string | null; tipo: string | null; anexo_url: string | null;
  thread_count: number; profiles?: { nome: string } | null;
  reactions?: { emoji: string; count: number; reacted: boolean }[];
}
interface ChannelTask {
  id: string; titulo: string; descricao: string; status: string; assigned_to: string | null;
  prioridade: string; created_at: string; checklist: { text: string; done: boolean }[];
  channel_id: string; created_by: string;
}
interface ProfileEntry { id: string; nome: string; setor: string; funcao: string | null; }

type ViewMode = "teams" | "diretas" | "tarefas" | "dashboard";
type SidePanel = "none" | "tasks" | "thread";

// ─── Audio Player ───
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
      <audio ref={audioRef} src={src}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => { const a = audioRef.current; if (a) setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0); }}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
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

// ─── Attachment Preview ───
function AttachmentPreview({ url, tipo }: { url: string; tipo?: string | null }) {
  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || tipo === "imagem";
  const isPdf = url.match(/\.pdf$/i) || tipo === "pdf";
  if (isImage) return (
    <div className="mt-1 max-w-xs">
      <img src={url} alt="Anexo" className="rounded-lg border max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(url, "_blank")} />
    </div>
  );
  if (isPdf) return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 max-w-xs hover:bg-muted transition-colors">
      <FileText className="w-5 h-5 text-destructive" /><span className="text-sm truncate flex-1">Documento PDF</span><Download className="w-4 h-4 text-muted-foreground" />
    </a>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 max-w-xs hover:bg-muted transition-colors">
      <Paperclip className="w-4 h-4 text-muted-foreground" /><span className="text-sm truncate flex-1">Arquivo anexo</span><Download className="w-4 h-4 text-muted-foreground" />
    </a>
  );
}

// ─── MAIN COMPONENT ───
export default function CorporateChannels() {
  const { user, profile, role } = useAuth();
  const canManage = role === "admin" || role === "gestor";
  const isAdmin = role === "admin";

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [allProfiles, setAllProfiles] = useState<ProfileEntry[]>([]);
  const [dmTargetId, setDmTargetId] = useState<string | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({ nome: "", descricao: "", tipo: "publico", setor: "", team_id: "" });
  const [creating, setCreating] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  
  // Audio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Tasks & panels
  const [sidePanel, setSidePanel] = useState<SidePanel>("none");
  const [tasks, setTasks] = useState<ChannelTask[]>([]);
  const [allTasks, setAllTasks] = useState<ChannelTask[]>([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskFromMsg, setTaskFromMsg] = useState<Message | null>(null);
  const [newTask, setNewTask] = useState({ titulo: "", descricao: "", assigned_to: "", prioridade: "media" });

  // Thread
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadInput, setThreadInput] = useState("");

  // Reactions
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);

  // ── Load data ──
  useEffect(() => { loadTeams(); loadChannels(); loadProfiles(); loadAllTasks(); }, []);

  useEffect(() => {
    if (activeChannel) { loadMessages(activeChannel); loadTasks(activeChannel); }
  }, [activeChannel]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Realtime
  useEffect(() => {
    if (!activeChannel) return;
    const sub = supabase
      .channel(`ch-${activeChannel}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "channel_messages",
        filter: `channel_id=eq.${activeChannel}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.parent_id) return; // thread messages handled separately
        if (msg.user_id === user?.id) msg.profiles = { nome: profile?.nome || "Você" };
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, { ...msg, reactions: [] }]);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [activeChannel, user?.id]);

  const loadTeams = async () => {
    const { data } = await supabase.from("teams" as any).select("id, nome, slug, descricao, icone, cor").eq("ativo", true).order("nome");
    const t = (data || []) as unknown as Team[];
    setTeams(t);
    // Expand all teams initially
    const exp: Record<string, boolean> = {};
    t.forEach(team => { exp[team.id] = true; });
    setExpandedTeams(exp);
  };

  const loadChannels = async () => {
    const { data } = await supabase.from("corporate_channels" as any)
      .select("id, nome, slug, descricao, tipo, setor, team_id")
      .eq("ativo", true).order("nome");
    const ch = (data || []) as unknown as Channel[];
    setChannels(ch);
    if (ch.length > 0 && !activeChannel) setActiveChannel(ch[0].id);
  };

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, nome, setor, funcao");
    setAllProfiles((data || []) as ProfileEntry[]);
  };

  const loadMessages = async (channelId: string) => {
    const { data } = await supabase.from("channel_messages" as any)
      .select("id, channel_id, user_id, content, is_ai, created_at, parent_id, tipo, anexo_url, thread_count")
      .eq("channel_id", channelId).is("parent_id", null)
      .order("created_at", { ascending: true }).limit(200);
    const msgs = (data || []) as unknown as Message[];
    await enrichProfiles(msgs);
    await enrichReactions(msgs);
    setMessages(msgs);
  };

  const loadTasks = async (channelId: string) => {
    const { data } = await supabase.from("channel_tasks" as any)
      .select("id, titulo, descricao, status, assigned_to, prioridade, created_at, checklist, channel_id, created_by")
      .eq("channel_id", channelId).order("created_at", { ascending: false }).limit(50);
    setTasks((data || []) as unknown as ChannelTask[]);
  };

  const loadAllTasks = async () => {
    if (!user) return;
    const { data } = await supabase.from("channel_tasks" as any)
      .select("id, titulo, descricao, status, assigned_to, prioridade, created_at, checklist, channel_id, created_by")
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(100);
    setAllTasks((data || []) as unknown as ChannelTask[]);
  };

  const enrichProfiles = async (msgs: Message[]) => {
    const ids = [...new Set(msgs.map(m => m.user_id))];
    if (!ids.length) return;
    const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
    const map = new Map((profs || []).map(p => [p.id, p.nome]));
    msgs.forEach(m => { m.profiles = { nome: map.get(m.user_id) || "Usuário" }; });
  };

  const enrichReactions = async (msgs: Message[]) => {
    if (!msgs.length || !user) return;
    const ids = msgs.map(m => m.id);
    const { data } = await supabase.from("message_reactions" as any)
      .select("message_id, emoji, user_id").in("message_id", ids);
    const reactions = (data || []) as { message_id: string; emoji: string; user_id: string }[];
    const grouped: Record<string, Record<string, { count: number; reacted: boolean }>> = {};
    reactions.forEach(r => {
      if (!grouped[r.message_id]) grouped[r.message_id] = {};
      if (!grouped[r.message_id][r.emoji]) grouped[r.message_id][r.emoji] = { count: 0, reacted: false };
      grouped[r.message_id][r.emoji].count++;
      if (r.user_id === user.id) grouped[r.message_id][r.emoji].reacted = true;
    });
    msgs.forEach(m => {
      const g = grouped[m.id];
      m.reactions = g ? Object.entries(g).map(([emoji, v]) => ({ emoji, ...v })) : [];
    });
  };

  // ── Open DM ──
  const openDirectMessage = async (targetId: string) => {
    if (!user) return;
    setDmTargetId(targetId);
    // Generate a deterministic DM slug from sorted user IDs
    const ids = [user.id, targetId].sort();
    const dmSlug = `dm-${ids[0].slice(0, 8)}-${ids[1].slice(0, 8)}`;
    // Check if DM channel already exists
    const { data: existing } = await supabase.from("corporate_channels" as any)
      .select("id").eq("slug", dmSlug).single();
    if (existing) {
      setActiveChannel((existing as any).id);
      return;
    }
    // Create DM channel
    const targetProfile = allProfiles.find(p => p.id === targetId);
    const { data: created, error } = await supabase.from("corporate_channels" as any).insert({
      nome: `DM: ${profile?.nome || "Eu"} ↔ ${targetProfile?.nome || "Usuário"}`,
      slug: dmSlug, tipo: "privado", criado_por: user.id,
      descricao: "Conversa direta",
    } as any).select("id").single();
    if (error) { toast.error("Erro ao abrir conversa"); return; }
    setActiveChannel((created as any).id);
    loadChannels();
  };

  // ── Actions ──
  const sendMessage = async () => {
    if (!input.trim() || !activeChannel || !user || sending) return;
    setSending(true);
    const channelId = activeChannel;
    await supabase.from("channel_messages" as any).insert({
      channel_id: channelId, user_id: user.id, content: input.trim(), tipo: "texto",
    } as any);
    setInput("");
    setSending(false);
    loadMessages(channelId);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === messageId);
    const existing = msg?.reactions?.find(r => r.emoji === emoji && r.reacted);
    if (existing) {
      await supabase.from("message_reactions" as any).delete()
        .eq("message_id", messageId).eq("user_id", user.id).eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions" as any).insert({
        message_id: messageId, user_id: user.id, emoji,
      } as any);
    }
    setShowReactionPicker(null);
    if (activeChannel) loadMessages(activeChannel);
  };

  // Thread
  const openThread = async (msg: Message) => {
    setThreadParent(msg);
    setSidePanel("thread");
    const { data } = await supabase.from("channel_messages" as any)
      .select("id, channel_id, user_id, content, is_ai, created_at, parent_id, tipo, anexo_url, thread_count")
      .eq("parent_id", msg.id).order("created_at", { ascending: true });
    const msgs = (data || []) as unknown as Message[];
    await enrichProfiles(msgs);
    setThreadMessages(msgs);
  };

  const sendThreadReply = async () => {
    if (!threadInput.trim() || !threadParent || !user) return;
    await supabase.from("channel_messages" as any).insert({
      channel_id: threadParent.channel_id, user_id: user.id,
      content: threadInput.trim(), tipo: "texto", parent_id: threadParent.id,
    } as any);
    setThreadInput("");
    // Update thread count
    await supabase.from("channel_messages" as any)
      .update({ thread_count: (threadParent.thread_count || 0) + 1 } as any)
      .eq("id", threadParent.id);
    openThread(threadParent);
    if (activeChannel) loadMessages(activeChannel);
  };

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannel || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `channels/${activeChannel}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(uploadData.path);
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      await supabase.from("channel_messages" as any).insert({
        channel_id: activeChannel, user_id: user.id,
        content: isImage ? `📷 ${file.name}` : `📎 ${file.name}`,
        tipo: isImage ? "imagem" : isPdf ? "pdf" : "arquivo", anexo_url: urlData.publicUrl,
      } as any);
      toast.success("Arquivo enviado!");
    } catch (err: any) { toast.error("Erro ao enviar arquivo"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  // Audio
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); if (recTimerRef.current) clearInterval(recTimerRef.current); sendAudioMessage(new Blob(audioChunksRef.current, { type: "audio/webm" })); };
      mr.start(250);
      setIsRecording(true); setRecordingDuration(0);
      recTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch { toast.error("Não foi possível acessar o microfone."); }
  }, [activeChannel, user]);

  const stopRecording = useCallback(() => { mediaRecorderRef.current?.stop(); setIsRecording(false); }, []);
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); mediaRecorderRef.current.stop(); }
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    audioChunksRef.current = []; setIsRecording(false); setRecordingDuration(0);
  }, []);

  const sendAudioMessage = async (blob: Blob) => {
    if (!activeChannel || !user) return;
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const transcribeRes = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-transcribe`, {
        method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, body: formData,
      });
      let transcription = "";
      if (transcribeRes.ok) { const data = await transcribeRes.json(); transcription = data.text || ""; }
      const fileName = `channels/${activeChannel}/${Date.now()}.webm`;
      const { data: uploadData } = await supabase.storage.from("audio-messages").upload(fileName, blob, { contentType: "audio/webm" });
      let audioUrl = "";
      if (uploadData?.path) { const { data: urlData } = supabase.storage.from("audio-messages").getPublicUrl(uploadData.path); audioUrl = urlData.publicUrl; }
      const content = transcription ? `🎤 Áudio: ${transcription}` : "🎤 Mensagem de áudio";
      await supabase.from("channel_messages" as any).insert({ channel_id: activeChannel, user_id: user.id, content, tipo: "audio", anexo_url: audioUrl || null } as any);
      toast.success("Áudio enviado!");
    } catch (err: any) { toast.error("Erro ao processar áudio"); }
    finally { setTranscribing(false); }
  };

  // Tasks
  const openCreateTaskFromMsg = (msg: Message) => {
    setTaskFromMsg(msg);
    setNewTask({ titulo: msg.content.slice(0, 100), descricao: msg.content, assigned_to: "", prioridade: "media" });
    setShowCreateTask(true);
  };

  const createTask = async () => {
    if (!newTask.titulo.trim() || !activeChannel || !user) return;
    setCreating(true);
    const { error } = await supabase.from("channel_tasks" as any).insert({
      channel_id: activeChannel, created_by: user.id, message_id: taskFromMsg?.id || null,
      titulo: newTask.titulo.trim(), descricao: newTask.descricao,
      assigned_to: newTask.assigned_to || null, prioridade: newTask.prioridade,
    } as any);
    if (error) toast.error("Erro ao criar tarefa");
    else { toast.success("Tarefa criada!"); setShowCreateTask(false); setTaskFromMsg(null); setNewTask({ titulo: "", descricao: "", assigned_to: "", prioridade: "media" }); loadTasks(activeChannel!); loadAllTasks(); }
    setCreating(false);
  };

  const toggleTaskStatus = async (task: ChannelTask) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    await supabase.from("channel_tasks" as any).update({ status: newStatus } as any).eq("id", task.id);
    if (activeChannel) loadTasks(activeChannel);
    loadAllTasks();
  };

  const createChannel = async () => {
    if (!newChannel.nome.trim() || !user) return;
    setCreating(true);
    const slug = newChannel.nome.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const { error } = await supabase.from("corporate_channels" as any).insert({
      nome: newChannel.nome.trim(), slug, descricao: newChannel.descricao.trim() || null,
      tipo: newChannel.tipo, setor: newChannel.setor || null, criado_por: user.id,
      team_id: newChannel.team_id || null,
    } as any);
    if (error) toast.error("Erro ao criar canal");
    else { toast.success("Canal criado!"); setShowCreateChannel(false); setNewChannel({ nome: "", descricao: "", tipo: "publico", setor: "", team_id: "" }); loadChannels(); }
    setCreating(false);
  };

  // Global search
  const handleGlobalSearch = async () => {
    if (!globalSearch.trim()) return;
    setSearching(true);
    const { data } = await supabase.from("channel_messages" as any)
      .select("id, channel_id, user_id, content, is_ai, created_at, parent_id, tipo, anexo_url, thread_count")
      .ilike("content", `%${globalSearch}%`).order("created_at", { ascending: false }).limit(50);
    const msgs = (data || []) as unknown as Message[];
    await enrichProfiles(msgs);
    setSearchResults(msgs);
    setSearching(false);
  };

  // ── Helpers ──
  const fmtDur = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const getInitials = (name: string) => { const p = name.split(" "); return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase(); };
  const getAvatarColor = (id: string) => {
    const colors = ["bg-primary/20 text-primary", "bg-hexa-green/20 text-hexa-green", "bg-hexa-purple/20 text-hexa-purple", "bg-hexa-blue/20 text-hexa-blue", "bg-hexa-teal/20 text-hexa-teal", "bg-hexa-amber/20 text-hexa-amber-dark"];
    return colors[id.charCodeAt(0) % colors.length];
  };
  const getProfileName = (id: string | null) => allProfiles.find(p => p.id === id)?.nome || "—";

  const activeChannelData = channels.find(c => c.id === activeChannel);
  const otherProfiles = allProfiles.filter(p => p.id !== user?.id);
  const filteredProfiles = otherProfiles.filter(p => p.nome.toLowerCase().includes(searchQuery.toLowerCase()));
  const pendingTasks = tasks.filter(t => t.status !== "concluida").length;
  const channelsByTeam = useMemo(() => {
    const map: Record<string, Channel[]> = { unassigned: [] };
    teams.forEach(t => { map[t.id] = []; });
    channels.forEach(ch => {
      if (ch.team_id && map[ch.team_id]) map[ch.team_id].push(ch);
      else map.unassigned.push(ch);
    });
    return map;
  }, [channels, teams]);

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let lastDate = "";
    messages.forEach(m => {
      const d = new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      if (d !== lastDate) { groups.push({ date: d, messages: [m] }); lastDate = d; }
      else groups[groups.length - 1].messages.push(m);
    });
    return groups;
  }, [messages]);

  // ── Dashboard stats ──
  const dashboardStats = useMemo(() => ({
    totalChannels: channels.length,
    totalMessages: messages.length,
    myPendingTasks: allTasks.filter(t => t.status !== "concluida" && t.assigned_to === user?.id).length,
    totalPendingTasks: allTasks.filter(t => t.status !== "concluida").length,
    topChannels: channels.slice(0, 5),
  }), [channels, messages, allTasks, user?.id]);

  // ═══════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════

  return (
    <HexaLayout>
      <div className="flex h-[calc(100vh-7rem)] gap-0 animate-slide-up">
        {/* ───── LEFT SIDEBAR ───── */}
        <div className="w-72 shrink-0 hidden md:flex flex-col bg-card border-r rounded-l-xl overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Teams
              </h2>
              <div className="flex items-center gap-1">
                {canManage && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowCreateChannel(true)} title="Novo canal">
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar..." className="pl-8 h-8 text-sm bg-muted/50 border-0" />
            </div>
          </div>

          {/* View mode tabs */}
          <div className="flex border-b text-[11px]">
            {([
              { key: "teams" as ViewMode, icon: Hash, label: "Times" },
              { key: "diretas" as ViewMode, icon: User, label: "Diretas" },
              { key: "tarefas" as ViewMode, icon: CheckSquare, label: "Tarefas" },
              { key: "dashboard" as ViewMode, icon: BarChart3, label: "Painel" },
            ]).map(t => (
              <button key={t.key} onClick={() => setViewMode(t.key)}
                className={`flex-1 py-2.5 font-medium transition-colors relative ${viewMode === t.key ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <div className="flex items-center justify-center gap-1">
                  <t.icon className="w-3 h-3" />
                  {t.label}
                </div>
                {viewMode === t.key && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
              </button>
            ))}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {/* Teams view */}
            {viewMode === "teams" && (
              <div className="p-2 space-y-1">
                {teams.map(team => {
                  const teamChannels = (channelsByTeam[team.id] || []).filter(c =>
                    c.nome.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  const TeamIcon = TEAM_ICONS[team.icone] || Users;
                  const isExpanded = expandedTeams[team.id] ?? true;
                  return (
                    <div key={team.id}>
                      <button onClick={() => setExpandedTeams(prev => ({ ...prev, [team.id]: !prev[team.id] }))}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-semibold hover:bg-muted/60 transition-colors">
                        {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: team.cor + "22", color: team.cor }}>
                          <TeamIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="flex-1 text-left truncate">{team.nome}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">{teamChannels.length}</Badge>
                      </button>
                      {isExpanded && teamChannels.map(ch => (
                        <button key={ch.id} onClick={() => { setActiveChannel(ch.id); setDmTargetId(null); setViewMode("teams"); }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 ml-5 rounded-lg text-xs transition-all ${
                            activeChannel === ch.id ? "bg-primary/8 text-foreground font-medium border border-primary/15" : "text-muted-foreground hover:bg-muted/50"
                          }`}>
                          {ch.tipo === "privado" ? <Lock className="w-3 h-3" /> :
                           ch.slug === "alertas-ia" ? <AlertTriangle className="w-3 h-3 text-hexa-amber" /> :
                           <Hash className="w-3 h-3" />}
                          <span className="truncate">{ch.nome}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
                {/* Unassigned channels */}
                {channelsByTeam.unassigned.filter(c => c.nome.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
                  <div>
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Geral</div>
                    {channelsByTeam.unassigned.filter(c => c.nome.toLowerCase().includes(searchQuery.toLowerCase())).map(ch => (
                      <button key={ch.id} onClick={() => { setActiveChannel(ch.id); setDmTargetId(null); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                          activeChannel === ch.id ? "bg-primary/8 text-foreground font-medium border border-primary/15" : "text-muted-foreground hover:bg-muted/50"
                        }`}>
                        <Hash className="w-3 h-3" />
                        <span className="truncate">{ch.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Direct messages */}
            {viewMode === "diretas" && (
              <div className="p-2 space-y-0.5">
                {filteredProfiles.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">Nenhum colaborador</p>}
                {filteredProfiles.map(p => (
                  <button key={p.id} onClick={() => openDirectMessage(p.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                      dmTargetId === p.id ? "bg-primary/8 text-foreground font-medium border border-primary/15" : "text-muted-foreground hover:bg-muted/50"
                    }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${getAvatarColor(p.id)}`}>
                      {getInitials(p.nome)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs truncate font-medium">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.funcao || p.setor}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-hexa-green shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* My Tasks view */}
            {viewMode === "tarefas" && (
              <div className="p-3 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Minhas Tarefas</h3>
                {allTasks.filter(t => t.assigned_to === user?.id || t.created_by === user?.id).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>
                )}
                {allTasks.filter(t => t.assigned_to === user?.id || t.created_by === user?.id).map(task => (
                  <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <button onClick={() => toggleTaskStatus(task)} className="mt-0.5 shrink-0">
                      {task.status === "concluida" ? <Check className="w-4 h-4 text-hexa-green" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${task.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>{task.titulo}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant={task.prioridade === "alta" ? "destructive" : "secondary"} className="text-[9px] h-4 px-1">
                          {task.prioridade}
                        </Badge>
                        {task.assigned_to && (
                          <span className="text-[10px] text-muted-foreground">→ {getProfileName(task.assigned_to)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dashboard view */}
            {viewMode === "dashboard" && (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold text-primary">{dashboardStats.totalChannels}</p>
                    <p className="text-[10px] text-muted-foreground">Canais</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold text-hexa-amber">{dashboardStats.totalPendingTasks}</p>
                    <p className="text-[10px] text-muted-foreground">Tarefas Abertas</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold text-hexa-green">{teams.length}</p>
                    <p className="text-[10px] text-muted-foreground">Times</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-lg font-bold text-destructive">{dashboardStats.myPendingTasks}</p>
                    <p className="text-[10px] text-muted-foreground">Minhas Tarefas</p>
                  </Card>
                </div>
                <div>
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Busca Global</h4>
                  <div className="flex gap-1">
                    <Input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Buscar mensagens, tarefas..." className="h-8 text-xs" onKeyDown={e => { if (e.key === "Enter") handleGlobalSearch(); }} />
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleGlobalSearch} disabled={searching}>
                      {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    </Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
                      {searchResults.map(r => (
                        <button key={r.id} onClick={() => { setActiveChannel(r.channel_id); setViewMode("teams"); }}
                          className="w-full text-left p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                          <p className="text-[10px] text-muted-foreground">{r.profiles?.nome}</p>
                          <p className="text-xs truncate">{r.content}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Online indicator */}
          <div className="p-3 border-t bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-hexa-green" />
              <span>{allProfiles.length} colaboradores</span>
            </div>
          </div>
        </div>

        {/* ───── CENTER: CHAT ───── */}
        <div className="flex-1 flex flex-col bg-card overflow-hidden border border-l-0 md:border-l-0">
          {/* Chat header */}
          {activeChannel && activeChannelData ? (
            <div className="border-b px-5 py-3 flex items-center gap-3 bg-card">
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
                <MeetingRoom channelId={activeChannel!} channelName={activeChannelData.nome} />
                <Button variant={sidePanel === "tasks" ? "default" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs"
                  onClick={() => setSidePanel(sidePanel === "tasks" ? "none" : "tasks")}>
                  <ListTodo className="w-3.5 h-3.5" />Tarefas
                  {pendingTasks > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{pendingTasks}</Badge>}
                </Button>
                <Badge variant="secondary" className="text-[10px] gap-1"><Users className="w-3 h-3" />{allProfiles.length}</Badge>
              </div>
            </div>
          ) : (
            <div className="border-b px-5 py-3.5 bg-card">
              <h3 className="text-sm font-semibold text-muted-foreground">Selecione um canal ou conversa</h3>
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
                <p className="text-xs text-muted-foreground/70">Seja o primeiro a enviar uma mensagem</p>
              </div>
            ) : (
              groupedMessages.map((group, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-border" /><span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">{group.date}</span><div className="flex-1 h-px bg-border" />
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
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold ${m.is_ai ? "hexa-gradient-brand text-white" : getAvatarColor(m.user_id)}`}>
                                {m.is_ai ? "AI" : getInitials(m.profiles?.nome || "?")}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {!compact && (
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className={`text-sm font-semibold ${isMe ? "text-primary" : ""}`}>{m.is_ai ? "Focus AI" : (m.profiles?.nome || "Usuário")}</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            )}
                            {/* Content */}
                            {m.tipo === "audio" && m.anexo_url ? (
                              <div className="space-y-1"><AudioPlayer src={m.anexo_url} />{m.content && !m.content.startsWith("🎤 Mensagem de áudio") && <p className="text-xs text-muted-foreground italic pl-1">{m.content.replace("🎤 Áudio: ", "")}</p>}</div>
                            ) : m.anexo_url && (m.tipo === "imagem" || m.tipo === "pdf" || m.tipo === "arquivo") ? (
                              <div><p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{m.content}</p><AttachmentPreview url={m.anexo_url} tipo={m.tipo} /></div>
                            ) : (
                              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                            )}
                            {/* Reactions */}
                            {m.reactions && m.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.reactions.map(r => (
                                  <button key={r.emoji} onClick={() => toggleReaction(m.id, r.emoji)}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                      r.reacted ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/50 border-border hover:bg-muted"
                                    }`}>
                                    <span>{r.emoji}</span><span className="text-[10px]">{r.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Thread indicator */}
                            {(m.thread_count || 0) > 0 && (
                              <button onClick={() => openThread(m)} className="flex items-center gap-1.5 mt-1 text-xs text-primary hover:underline">
                                <Reply className="w-3 h-3" />{m.thread_count} {m.thread_count === 1 ? "resposta" : "respostas"}
                              </button>
                            )}
                          </div>
                          {/* Action buttons */}
                          <div className="hidden group-hover:flex items-start gap-0.5 shrink-0 mt-1">
                            <div className="relative">
                              <Button variant="ghost" size="icon" className="h-6 w-6" title="Reagir"
                                onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}>
                                <SmilePlus className="w-3 h-3" />
                              </Button>
                              {showReactionPicker === m.id && (
                                <div className="absolute right-0 top-7 z-50 bg-popover border rounded-lg shadow-lg p-1.5 flex gap-1">
                                  {QUICK_REACTIONS.map(e => (
                                    <button key={e} onClick={() => toggleReaction(m.id, e)} className="hover:bg-muted rounded p-1 text-sm">{e}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6" title="Responder em thread" onClick={() => openThread(m)}>
                              <Reply className="w-3 h-3" />
                            </Button>
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
          {activeChannel && (
            <div className="border-t p-4 bg-card">
              {transcribing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 px-1">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /><span>Transcrevendo e enviando áudio...</span>
                </div>
              )}
              {isRecording ? (
                <div className="flex items-center gap-3 bg-destructive/8 rounded-xl border border-destructive/20 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />Gravando {fmtDur(recordingDuration)}
                  </span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={cancelRecording}><X className="w-3.5 h-3.5" /> Cancelar</Button>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={stopRecording}><Square className="w-3 h-3" /> Enviar</Button>
                </div>
              ) : (
                <div className="relative flex items-end gap-2 bg-muted/40 rounded-xl border px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  <Input value={input} onChange={e => setInput(e.target.value)}
                    placeholder={`Escreva em #${activeChannelData?.nome || "canal"}...`}
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-9 text-sm"
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={transcribing || uploading} />
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt" onChange={handleFileUpload} />
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Gravar áudio" onClick={startRecording} disabled={transcribing || uploading}><Mic className="w-4 h-4" /></Button>
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
              <h3 className="text-sm font-semibold flex items-center gap-2"><ListTodo className="w-4 h-4" /> Tarefas do Canal</h3>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setTaskFromMsg(null); setNewTask({ titulo: "", descricao: "", assigned_to: "", prioridade: "media" }); setShowCreateTask(true); }}><Plus className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSidePanel("none")}><X className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-3">
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma tarefa neste canal</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => (
                    <Card key={task.id} className={`p-3 ${task.status === "concluida" ? "opacity-60" : ""}`}>
                      <div className="flex items-start gap-2">
                        <button onClick={() => toggleTaskStatus(task)} className="mt-0.5 shrink-0">
                          {task.status === "concluida" ? <Check className="w-4 h-4 text-hexa-green" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${task.status === "concluida" ? "line-through" : ""}`}>{task.titulo}</p>
                          {task.descricao && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{task.descricao}</p>}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant={task.prioridade === "alta" ? "destructive" : task.prioridade === "urgente" ? "destructive" : "secondary"} className="text-[9px] h-4 px-1">{task.prioridade}</Badge>
                            {task.assigned_to && <span className="text-[10px] text-muted-foreground">→ {getProfileName(task.assigned_to)}</span>}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* ───── RIGHT PANEL: THREAD ───── */}
        {sidePanel === "thread" && threadParent && (
          <div className="w-80 shrink-0 hidden lg:flex flex-col bg-card border-l rounded-r-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Reply className="w-4 h-4" /> Thread</h3>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSidePanel("none"); setThreadParent(null); }}><X className="w-3.5 h-3.5" /></Button>
            </div>
            {/* Parent message */}
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold ${getAvatarColor(threadParent.user_id)}`}>
                  {getInitials(threadParent.profiles?.nome || "?")}
                </div>
                <span className="text-xs font-semibold">{threadParent.profiles?.nome}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(threadParent.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="text-xs text-foreground/90">{threadParent.content}</p>
            </div>
            {/* Thread replies */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {threadMessages.map(m => (
                  <div key={m.id} className="flex gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 ${getAvatarColor(m.user_id)}`}>
                      {getInitials(m.profiles?.nome || "?")}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-semibold">{m.profiles?.nome}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-xs text-foreground/90 mt-0.5">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {/* Thread input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Input value={threadInput} onChange={e => setThreadInput(e.target.value)} placeholder="Responder..." className="h-8 text-xs"
                  onKeyDown={e => { if (e.key === "Enter") sendThreadReply(); }} />
                <Button size="icon" className="h-8 w-8 shrink-0" onClick={sendThreadReply} disabled={!threadInput.trim()}>
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ───── DIALOGS ───── */}
      {/* Create Channel */}
      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Canal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={newChannel.nome} onChange={e => setNewChannel(p => ({ ...p, nome: e.target.value }))} placeholder="ex: alertas-vendas" /></div>
            <div><Label>Descrição</Label><Textarea value={newChannel.descricao} onChange={e => setNewChannel(p => ({ ...p, descricao: e.target.value }))} placeholder="Propósito do canal..." rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={newChannel.tipo} onValueChange={v => setNewChannel(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publico">Público</SelectItem>
                    <SelectItem value="privado">Privado</SelectItem>
                    <SelectItem value="projeto">Projeto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Time</Label>
                <Select value={newChannel.team_id} onValueChange={v => setNewChannel(p => ({ ...p, team_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateChannel(false)}>Cancelar</Button>
            <Button onClick={createChannel} disabled={creating || !newChannel.nome.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Criar Canal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent>
          <DialogHeader><DialogTitle>{taskFromMsg ? "Criar Tarefa da Mensagem" : "Nova Tarefa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={newTask.titulo} onChange={e => setNewTask(p => ({ ...p, titulo: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={newTask.descricao} onChange={e => setNewTask(p => ({ ...p, descricao: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Select value={newTask.assigned_to} onValueChange={v => setNewTask(p => ({ ...p, assigned_to: v }))}>
                  <SelectTrigger><SelectValue placeholder="Atribuir..." /></SelectTrigger>
                  <SelectContent>{allProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={newTask.prioridade} onValueChange={v => setNewTask(p => ({ ...p, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTask(false)}>Cancelar</Button>
            <Button onClick={createTask} disabled={creating || !newTask.titulo.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HexaLayout>
  );
}
