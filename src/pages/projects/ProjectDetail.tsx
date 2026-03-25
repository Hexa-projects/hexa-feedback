import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Plus, Calendar, DollarSign, Trash2, Upload, FileText,
  Image, Clock, User, Edit2, Save, CheckCircle2, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  Planejamento: "bg-muted text-muted-foreground",
  "Em Andamento": "bg-primary/10 text-primary",
  Pausado: "bg-hexa-amber/10 text-hexa-amber",
  Concluído: "bg-hexa-green/10 text-hexa-green",
  Cancelado: "bg-destructive/10 text-destructive",
};

const ETAPAS = [
  { key: "planejamento", label: "Planejamento" },
  { key: "preparacao", label: "Preparação de Site" },
  { key: "instalacao", label: "Instalação" },
  { key: "calibracao", label: "Calibração & Testes" },
  { key: "treinamento", label: "Treinamento" },
  { key: "aceite", label: "Aceite Final" },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    if (!id || !user) return;
    Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("project_tasks").select("*").eq("project_id", id).order("ordem"),
    ]).then(([proj, tks]) => {
      setProject(proj.data);
      setEditForm(proj.data || {});
      setTasks(tks.data || []);
      setLoading(false);
    });
  }, [id, user]);

  const addTask = async () => {
    if (!newTask.trim() || !id) return;
    const { data, error } = await supabase
      .from("project_tasks")
      .insert({ project_id: id, titulo: newTask.trim(), ordem: tasks.length } as any)
      .select()
      .single();
    if (error) toast.error("Erro ao adicionar tarefa");
    else {
      setTasks((prev) => [...prev, data]);
      setNewTask("");
    }
  };

  const toggleTask = async (task: any) => {
    await supabase.from("project_tasks").update({ concluida: !task.concluida } as any).eq("id", task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, concluida: !t.concluida } : t)));
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("project_tasks").delete().eq("id", taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const updateStatus = async (status: string) => {
    await supabase.from("projects").update({ status } as any).eq("id", id);
    setProject((p: any) => ({ ...p, status }));
    toast.success(`Status atualizado para ${status}`);
  };

  const updateEtapa = async (etapa: string) => {
    await supabase.from("projects").update({ etapa_atual: etapa } as any).eq("id", id);
    setProject((p: any) => ({ ...p, etapa_atual: etapa }));
    toast.success(`Etapa atualizada`);
  };

  const saveEdit = async () => {
    const { error } = await supabase.from("projects").update({
      titulo: editForm.titulo,
      cliente: editForm.cliente,
      descricao: editForm.descricao,
      notas: editForm.notas,
      valor_contrato: parseFloat(editForm.valor_contrato) || 0,
      data_prevista: editForm.data_prevista || null,
      prioridade: editForm.prioridade,
    } as any).eq("id", id);
    if (error) toast.error("Erro ao salvar");
    else {
      setProject({ ...project, ...editForm });
      setEditing(false);
      toast.success("Projeto atualizado!");
    }
  };

  if (loading) return <HexaLayout><p className="text-muted-foreground p-8">Carregando...</p></HexaLayout>;
  if (!project) return <HexaLayout><p className="text-destructive p-8">Projeto não encontrado.</p></HexaLayout>;

  const completedCount = tasks.filter((t) => t.concluida).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const etapaIdx = ETAPAS.findIndex(e => e.key === (project.etapa_atual || "planejamento"));
  const etapaProgress = Math.round(((etapaIdx + 1) / ETAPAS.length) * 100);

  const daysRemaining = project.data_prevista
    ? differenceInDays(new Date(project.data_prevista), new Date())
    : null;

  return (
    <HexaLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
        <Button variant="ghost" onClick={() => navigate("/projects")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{project.titulo}</h1>
            {project.cliente && <p className="text-muted-foreground">{project.cliente}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[project.status] || "bg-muted"}>{project.status}</Badge>
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Progresso</p>
              <p className="text-lg font-bold text-primary">{progress}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Tarefas</p>
              <p className="text-lg font-bold">{completedCount}/{tasks.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Etapa</p>
              <p className="text-sm font-bold">{ETAPAS[etapaIdx]?.label || "—"}</p>
            </CardContent>
          </Card>
          {project.data_prevista && (
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Calendar className="w-3 h-3" /> Prazo</p>
                <p className={`text-sm font-bold ${daysRemaining !== null && daysRemaining < 0 ? "text-destructive" : daysRemaining !== null && daysRemaining <= 7 ? "text-hexa-amber" : ""}`}>
                  {daysRemaining !== null ? (daysRemaining < 0 ? `${Math.abs(daysRemaining)}d atrasado` : `${daysRemaining}d restantes`) : format(new Date(project.data_prevista), "dd/MM/yy")}
                </p>
              </CardContent>
            </Card>
          )}
          {project.valor_contrato > 0 && (
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><DollarSign className="w-3 h-3" /> Contrato</p>
                <p className="text-sm font-bold">R$ {Number(project.valor_contrato).toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Status actions */}
        <div className="flex gap-2 flex-wrap">
          {["Planejamento", "Em Andamento", "Pausado", "Concluído"].map((s) => (
            <Button key={s} size="sm" variant={project.status === s ? "default" : "outline"} onClick={() => updateStatus(s)}>
              {s}
            </Button>
          ))}
        </div>

        <Tabs defaultValue="checklist" className="space-y-4">
          <TabsList>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          </TabsList>

          {/* Checklist Tab */}
          <TabsContent value="checklist" className="space-y-4">
            <Progress value={progress} className="h-2" />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Checklist Técnico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group">
                    <Checkbox checked={t.concluida} onCheckedChange={() => toggleTask(t)} />
                    <span className={`flex-1 text-sm ${t.concluida ? "line-through text-muted-foreground" : ""}`}>{t.titulo}</span>
                    {t.concluida && <CheckCircle2 className="w-3.5 h-3.5 text-hexa-green" />}
                    <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Input placeholder="Nova tarefa..." value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} />
                  <Button onClick={addTask} size="icon" variant="outline"><Plus className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cronograma Tab */}
          <TabsContent value="cronograma" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Etapas de Implantação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {ETAPAS.map((etapa, i) => {
                    const isCurrent = etapa.key === (project.etapa_atual || "planejamento");
                    const isPast = i < etapaIdx;
                    return (
                      <button
                        key={etapa.key}
                        onClick={() => updateEtapa(etapa.key)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
                          isCurrent ? "bg-primary/10 text-primary font-semibold border border-primary/20" :
                          isPast ? "bg-hexa-green/5 text-hexa-green" : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          isPast ? "bg-hexa-green text-white" : isCurrent ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          {isPast ? "✓" : i + 1}
                        </div>
                        <span>{etapa.label}</span>
                      </button>
                    );
                  })}
                </div>
                <Progress value={etapaProgress} className="h-2 mt-4" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detalhes/Edit Tab */}
          <TabsContent value="detalhes" className="space-y-4">
            {editing ? (
              <Card>
                <CardHeader><CardTitle className="text-lg">Editar Projeto</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input value={editForm.titulo || ""} onChange={e => setEditForm({ ...editForm, titulo: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Input value={editForm.cliente || ""} onChange={e => setEditForm({ ...editForm, cliente: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor do Contrato (R$)</Label>
                      <Input type="number" value={editForm.valor_contrato || ""} onChange={e => setEditForm({ ...editForm, valor_contrato: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Previsão de Conclusão</Label>
                      <Input type="date" value={editForm.data_prevista ? editForm.data_prevista.split("T")[0] : ""} onChange={e => setEditForm({ ...editForm, data_prevista: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.prioridade || "Média"} onChange={e => setEditForm({ ...editForm, prioridade: e.target.value })}>
                        {["Baixa", "Média", "Alta", "Crítica"].map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea value={editForm.descricao || ""} onChange={e => setEditForm({ ...editForm, descricao: e.target.value })} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea value={editForm.notas || ""} onChange={e => setEditForm({ ...editForm, notas: e.target.value })} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveEdit} className="gap-2"><Save className="w-4 h-4" /> Salvar</Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-5 space-y-3">
                  {project.descricao && <div><p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p><p className="text-sm">{project.descricao}</p></div>}
                  {project.notas && <div><p className="text-xs font-medium text-muted-foreground mb-1">Notas</p><p className="text-sm">{project.notas}</p></div>}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div><p className="text-xs text-muted-foreground">Prioridade</p><p className="text-sm font-medium">{project.prioridade || "Média"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Criado em</p><p className="text-sm font-medium">{project.created_at ? format(new Date(project.created_at), "dd/MM/yyyy") : "—"}</p></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
