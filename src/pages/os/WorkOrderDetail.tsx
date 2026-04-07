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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Plus, CheckSquare, Clock, AlertTriangle,
  Wrench, Package, Camera, FileText, User, Brain, BookOpen, Loader2, RefreshCw
} from "lucide-react";
import { format, differenceInHours } from "date-fns";

const STATUSES = ["Aberto", "Em Atendimento", "Pendente Peça", "Concluído"];
const TIPOS = ["corretiva", "preventiva", "instalacao", "calibracao"];

interface PecaUsada {
  nome: string;
  quantidade: number;
  serial?: string;
}

export default function WorkOrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [os, setOs] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [newActivity, setNewActivity] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Peças usadas
  const [pecas, setPecas] = useState<PecaUsada[]>([]);
  const [newPeca, setNewPeca] = useState({ nome: "", quantidade: 1, serial: "" });

  // Copiloto Técnico
  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("work_orders").select("*").eq("id", id).single(),
      supabase.from("work_order_activities").select("*").eq("work_order_id", id).order("created_at"),
    ]).then(([osRes, actRes]) => {
      setOs(osRes.data);
      setPecas(osRes.data?.pecas_utilizadas || []);
      setActivities(actRes.data || []);
      setLoading(false);

      // Auto-load Copiloto Técnico docs based on equipment
      if (osRes.data?.equipamento) {
        loadKnowledgeDocs(osRes.data.equipamento, osRes.data.equipamento_serial);
      }
    });
  }, [id]);

  const loadKnowledgeDocs = async (equipment: string, serial?: string) => {
    setLoadingKnowledge(true);
    try {
      // Parse model/brand from equipment field (e.g., "Siemens Artis Zee")
      const parts = equipment.trim().split(/\s+/);
      const brand = parts[0] || "";
      const model = parts.slice(1).join(" ") || equipment;

      const { data, error } = await supabase.functions.invoke("knowledge-search", {
        body: { action: "search_by_equipment", model, brand, limit: 20 },
      });

      if (!error && data?.results) {
        setKnowledgeDocs(data.results);
      } else {
        // Fallback: text search
        const { data: fallback } = await supabase.functions.invoke("knowledge-search", {
          body: { action: "search_text", query: equipment, limit: 10 },
        });
        setKnowledgeDocs(fallback?.results || []);
      }
    } catch (err) {
      console.error("Knowledge search error:", err);
    }
    setLoadingKnowledge(false);
  };

  const handleSave = async () => {
    if (!os) return;
    setSaving(true);
    const { error } = await supabase.from("work_orders").update({
      numero_os: os.numero_os, cliente: os.cliente, equipamento: os.equipamento,
      descricao: os.descricao, status: os.status, urgencia: os.urgencia,
      tempo_gasto_min: os.tempo_gasto_min, observacoes_ia: os.observacoes_ia,
      tipo_manutencao: os.tipo_manutencao, localizacao: os.localizacao,
      equipamento_serial: os.equipamento_serial, pecas_utilizadas: pecas,
      data_conclusao: os.status === "Concluído" ? new Date().toISOString() : null,
    } as any).eq("id", os.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("OS atualizada!");

      // Trigger stock automation when OS is completed
      if (os.status === "Concluído" && pecas.length > 0) {
        try {
          await supabase.functions.invoke("stock-automation", {
            body: {
              action: "on_os_completed",
              work_order_id: os.id,
              pecas_utilizadas: pecas,
              user_id: user?.id,
            },
          });
          toast.success("Baixa de estoque realizada automaticamente!");
        } catch (stockErr) {
          console.error("Stock automation error:", stockErr);
          // Queue for retry
          await supabase.from("openclaw_event_queue").insert({
            event_type: "stock_deduction_retry",
            data: { work_order_id: os.id, pecas_utilizadas: pecas },
            status: "pending",
            domain: "stock",
            priority: "high",
          } as any);
          toast.info("Baixa de estoque enfileirada para processamento.");
        }
      }
    }
    setSaving(false);
  };

  const addActivity = async () => {
    if (!newActivity.trim() || !user || !id) return;
    const { data, error } = await supabase.from("work_order_activities").insert({
      work_order_id: id, descricao: newActivity.trim(), user_id: user.id,
    } as any).select().single();
    if (!error && data) {
      setActivities(prev => [...prev, data]);
      setNewActivity("");
    }
  };

  const toggleActivity = async (actId: string, current: boolean) => {
    await supabase.from("work_order_activities").update({ concluida: !current } as any).eq("id", actId);
    setActivities(prev => prev.map(a => a.id === actId ? { ...a, concluida: !current } : a));
  };

  const addPeca = () => {
    if (!newPeca.nome.trim()) return;
    setPecas(prev => [...prev, { ...newPeca }]);
    setNewPeca({ nome: "", quantidade: 1, serial: "" });
  };

  const removePeca = (i: number) => setPecas(prev => prev.filter((_, idx) => idx !== i));

  if (loading) return <HexaLayout><p className="text-muted-foreground p-6">Carregando...</p></HexaLayout>;
  if (!os) return <HexaLayout><p className="text-muted-foreground p-6">OS não encontrada</p></HexaLayout>;

  const hours = differenceInHours(new Date(), new Date(os.created_at));
  const slaHours = os.sla_horas || 48;
  const remaining = slaHours - hours;
  const slaPercent = Math.min(100, Math.max(0, (hours / slaHours) * 100));
  const completedActs = activities.filter(a => a.concluida).length;
  const actProgress = activities.length > 0 ? Math.round((completedActs / activities.length) * 100) : 0;

  return (
    <HexaLayout>
      <div className="max-w-4xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/os")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">OS: {os.numero_os || os.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">{os.cliente} • {os.equipamento}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={os.status === "Concluído" ? "bg-hexa-green/10 text-hexa-green" : os.status === "Pendente Peça" ? "bg-hexa-amber/10 text-hexa-amber" : "bg-primary/10 text-primary"}>
              {os.status}
            </Badge>
            <Badge variant="outline" className="capitalize">{os.tipo_manutencao || "corretiva"}</Badge>
          </div>
        </div>

        {/* SLA + KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> SLA</p>
              <p className={`text-sm font-bold ${remaining <= 0 ? "text-destructive" : remaining <= 8 ? "text-hexa-amber" : "text-hexa-green"}`}>
                {os.status === "Concluído" ? "✓ Concluído" : remaining <= 0 ? `${Math.abs(remaining)}h atrasado` : `${remaining}h restantes`}
              </p>
              <Progress value={slaPercent} className={`h-1 mt-1 ${slaPercent > 90 ? "[&>div]:bg-destructive" : slaPercent > 75 ? "[&>div]:bg-hexa-amber" : ""}`} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Checklist</p>
              <p className="text-sm font-bold">{completedActs}/{activities.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Peças Usadas</p>
              <p className="text-sm font-bold">{pecas.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Tempo Gasto</p>
              <p className="text-sm font-bold">{os.tempo_gasto_min || 0} min</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dados" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dados">Dados da OS</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="pecas">Peças Utilizadas</TabsTrigger>
            <TabsTrigger value="copiloto" className="gap-1">
              <Brain className="w-3 h-3" /> Copiloto Técnico
              {knowledgeDocs.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1">{knowledgeDocs.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dados Tab */}
          <TabsContent value="dados">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nº OS</Label>
                    <Input value={os.numero_os || ""} onChange={e => setOs({ ...os, numero_os: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Input value={os.cliente || ""} onChange={e => setOs({ ...os, cliente: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Equipamento</Label>
                    <Input value={os.equipamento || ""} onChange={e => setOs({ ...os, equipamento: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nº Série Equipamento</Label>
                    <Input value={os.equipamento_serial || ""} onChange={e => setOs({ ...os, equipamento_serial: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={os.status} onValueChange={v => setOs({ ...os, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Manutenção</Label>
                    <Select value={os.tipo_manutencao || "corretiva"} onValueChange={v => setOs({ ...os, tipo_manutencao: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Urgência</Label>
                    <Select value={os.urgencia || "Média"} onValueChange={v => setOs({ ...os, urgencia: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Baixa", "Média", "Alta", "Crítica"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo Gasto (min)</Label>
                    <Input type="number" value={os.tempo_gasto_min || 0} onChange={e => setOs({ ...os, tempo_gasto_min: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Localização</Label>
                    <Input value={os.localizacao || ""} onChange={e => setOs({ ...os, localizacao: e.target.value })} placeholder="Ex: Hospital São Paulo, Sala RM-01" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição do Problema</Label>
                  <Textarea value={os.descricao || ""} onChange={e => setOs({ ...os, descricao: e.target.value })} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Observações da IA</Label>
                  <Textarea value={os.observacoes_ia || ""} onChange={e => setOs({ ...os, observacoes_ia: e.target.value })} rows={2} className="bg-hexa-amber/5 border-hexa-amber/20" />
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar OS"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CheckSquare className="w-5 h-5" /> Checklist de Atividades</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Progress value={actProgress} className="h-2" />
                <div className="flex gap-2">
                  <Input value={newActivity} onChange={e => setNewActivity(e.target.value)} placeholder="Nova atividade..." className="flex-1"
                    onKeyDown={e => e.key === "Enter" && addActivity()} />
                  <Button onClick={addActivity} size="icon"><Plus className="w-4 h-4" /></Button>
                </div>
                {activities.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/30">
                    <Checkbox checked={a.concluida} onCheckedChange={() => toggleActivity(a.id, a.concluida)} />
                    <span className={`text-sm flex-1 ${a.concluida ? "line-through text-muted-foreground" : ""}`}>{a.descricao}</span>
                    {a.concluida && <Badge variant="outline" className="text-hexa-green border-hexa-green/20 text-[10px]">✓</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Peças Tab */}
          <TabsContent value="pecas">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" /> Peças Utilizadas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input value={newPeca.nome} onChange={e => setNewPeca({ ...newPeca, nome: e.target.value })} placeholder="Nome da peça" />
                  <Input type="number" value={newPeca.quantidade} onChange={e => setNewPeca({ ...newPeca, quantidade: parseInt(e.target.value) || 1 })} placeholder="Qtd" />
                  <div className="flex gap-2">
                    <Input value={newPeca.serial} onChange={e => setNewPeca({ ...newPeca, serial: e.target.value })} placeholder="Serial (opcional)" />
                    <Button onClick={addPeca} size="icon"><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
                {pecas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma peça registrada</p>
                ) : (
                  <div className="space-y-2">
                    {pecas.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg border">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium flex-1">{p.nome}</span>
                        <Badge variant="outline">{p.quantidade}x</Badge>
                        {p.serial && <span className="text-xs text-muted-foreground font-mono">{p.serial}</span>}
                        <button onClick={() => removePeca(i)} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Lembre-se de salvar a OS após alterar as peças.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Copiloto Técnico Tab */}
          <TabsContent value="copiloto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" /> Copiloto Técnico
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manuais, diagramas e procedimentos para <strong>{os.equipamento}</strong>
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingKnowledge ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Buscando documentação técnica...</span>
                  </div>
                ) : knowledgeDocs.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum documento técnico encontrado para "{os.equipamento}".
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Faça upload de manuais na seção de Conhecimento para ativar o copiloto.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1"
                      onClick={() => os.equipamento && loadKnowledgeDocs(os.equipamento)}
                    >
                      <RefreshCw className="w-3 h-3" /> Buscar novamente
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {knowledgeDocs.map((doc: any) => (
                      <Card key={doc.id} className="border-primary/20">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-0.5">
                              {doc.doc_type === "diagrama" ? (
                                <FileText className="w-5 h-5 text-primary" />
                              ) : doc.doc_type === "procedimento" ? (
                                <CheckSquare className="w-5 h-5 text-hexa-green" />
                              ) : (
                                <BookOpen className="w-5 h-5 text-hexa-amber" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium truncate">{doc.title}</p>
                                <Badge variant="outline" className="text-[10px] shrink-0">{doc.doc_type}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                                {doc.content?.slice(0, 300)}{doc.content?.length > 300 ? "..." : ""}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                {doc.equipment_brand && (
                                  <Badge variant="secondary" className="text-[10px]">{doc.equipment_brand}</Badge>
                                )}
                                {doc.equipment_model && (
                                  <Badge variant="secondary" className="text-[10px]">{doc.equipment_model}</Badge>
                                )}
                                {doc.source_file && (
                                  <span className="text-[10px] text-muted-foreground">📄 {doc.source_file}</span>
                                )}
                              </div>
                              {doc.source_url && (
                                <a href={doc.source_url} target="_blank" rel="noreferrer"
                                  className="text-xs text-primary underline mt-1 inline-block">
                                  Abrir documento completo →
                                </a>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
