import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Calendar, DollarSign, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  Planejamento: "bg-muted text-muted-foreground",
  "Em Andamento": "bg-primary/10 text-primary",
  Pausado: "bg-hexa-amber/10 text-hexa-amber",
  Concluído: "bg-hexa-green/10 text-hexa-green",
  Cancelado: "bg-destructive/10 text-destructive",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("project_tasks").select("*").eq("project_id", id).order("ordem"),
    ]).then(([proj, tks]) => {
      setProject(proj.data);
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

  if (loading) return <HexaLayout><p className="text-muted-foreground p-8">Carregando...</p></HexaLayout>;
  if (!project) return <HexaLayout><p className="text-destructive p-8">Projeto não encontrado.</p></HexaLayout>;

  const completedCount = tasks.filter((t) => t.concluida).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <HexaLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
        <Button variant="ghost" onClick={() => navigate("/projects")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.titulo}</h1>
            {project.cliente && <p className="text-muted-foreground">{project.cliente}</p>}
          </div>
          <Badge className={STATUS_COLORS[project.status] || "bg-muted"}>{project.status}</Badge>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          {project.data_prevista && (
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Calendar className="w-3 h-3" /> Previsão</p>
                <p className="text-sm font-bold">{new Date(project.data_prevista).toLocaleDateString("pt-BR")}</p>
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
            <Button
              key={s}
              size="sm"
              variant={project.status === s ? "default" : "outline"}
              onClick={() => updateStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>

        {/* Description */}
        {project.descricao && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm">{project.descricao}</p>
            </CardContent>
          </Card>
        )}

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>

        {/* Checklist */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Checklist de Tarefas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group">
                <Checkbox checked={t.concluida} onCheckedChange={() => toggleTask(t)} />
                <span className={`flex-1 text-sm ${t.concluida ? "line-through text-muted-foreground" : ""}`}>
                  {t.titulo}
                </span>
                <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Nova tarefa..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <Button onClick={addTask} size="icon" variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
