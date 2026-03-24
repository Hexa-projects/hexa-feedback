import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Plus, CheckSquare } from "lucide-react";

const STATUSES = ["Aberto", "Em Atendimento", "Pendente Peça", "Concluído"];

export default function WorkOrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [os, setOs] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [newActivity, setNewActivity] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("work_orders").select("*").eq("id", id).single(),
      supabase.from("work_order_activities").select("*").eq("work_order_id", id).order("created_at"),
    ]).then(([osRes, actRes]) => {
      setOs(osRes.data);
      setActivities(actRes.data || []);
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    if (!os) return;
    setSaving(true);
    const { error } = await supabase.from("work_orders").update({
      numero_os: os.numero_os, cliente: os.cliente, equipamento: os.equipamento,
      descricao: os.descricao, status: os.status, urgencia: os.urgencia,
      tempo_gasto_min: os.tempo_gasto_min, observacoes_ia: os.observacoes_ia,
    }).eq("id", os.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "OS atualizada!" });
    setSaving(false);
  };

  const addActivity = async () => {
    if (!newActivity.trim() || !user || !id) return;
    const { data, error } = await supabase.from("work_order_activities").insert({
      work_order_id: id, descricao: newActivity.trim(), user_id: user.id,
    }).select().single();
    if (!error && data) {
      setActivities(prev => [...prev, data]);
      setNewActivity("");
    }
  };

  const toggleActivity = async (actId: string, current: boolean) => {
    await supabase.from("work_order_activities").update({ concluida: !current }).eq("id", actId);
    setActivities(prev => prev.map(a => a.id === actId ? { ...a, concluida: !current } : a));
  };

  if (loading) return <HexaLayout><p className="text-muted-foreground p-6">Carregando...</p></HexaLayout>;
  if (!os) return <HexaLayout><p className="text-muted-foreground p-6">OS não encontrada</p></HexaLayout>;

  return (
    <HexaLayout>
      <div className="max-w-3xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/os")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <Card>
          <CardHeader><CardTitle>OS: {os.numero_os || os.id.slice(0, 8)}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nº OS</Label>
                <Input value={os.numero_os} onChange={e => setOs({ ...os, numero_os: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input value={os.cliente} onChange={e => setOs({ ...os, cliente: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Equipamento</Label>
                <Input value={os.equipamento} onChange={e => setOs({ ...os, equipamento: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={os.status} onValueChange={v => setOs({ ...os, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Urgência</Label>
                <Select value={os.urgencia} onValueChange={v => setOs({ ...os, urgencia: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Baixa", "Média", "Alta", "Crítica"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tempo Gasto (min)</Label>
                <Input type="number" value={os.tempo_gasto_min} onChange={e => setOs({ ...os, tempo_gasto_min: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={os.descricao} onChange={e => setOs({ ...os, descricao: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Observações da IA</Label>
              <Textarea value={os.observacoes_ia || ""} onChange={e => setOs({ ...os, observacoes_ia: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CheckSquare className="w-5 h-5" /> Checklist de Atividades</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newActivity} onChange={e => setNewActivity(e.target.value)} placeholder="Nova atividade..." className="flex-1"
                onKeyDown={e => e.key === "Enter" && addActivity()} />
              <Button onClick={addActivity} size="icon"><Plus className="w-4 h-4" /></Button>
            </div>
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded border">
                <Checkbox checked={a.concluida} onCheckedChange={() => toggleActivity(a.id, a.concluida)} />
                <span className={`text-sm flex-1 ${a.concluida ? "line-through text-muted-foreground" : ""}`}>{a.descricao}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
