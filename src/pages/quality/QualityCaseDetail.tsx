import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Bot, CheckCircle2, FileUp, Plus, Save, ShieldCheck } from "lucide-react";
import type { QualityAction, QualityActionType, QualityCase, QualityEvent, QualityEvidence, QualityStatus } from "./qualityTypes";
import { ACTION_TYPE_LABELS, formatDate, isActionOverdue, isCaseOverdue, priorityBadgeClass, STATUS_LABELS, statusBadgeClass } from "./qualityUtils";

const nextStatus: Record<string, QualityStatus> = {
  aberta: "em_analise",
  em_analise: "em_acao",
  em_acao: "aguardando_eficacia",
  aguardando_eficacia: "eficaz",
  eficaz: "encerrada",
  ineficaz: "em_acao",
};

export default function QualityCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [item, setItem] = useState<QualityCase | null>(null);
  const [actions, setActions] = useState<QualityAction[]>([]);
  const [evidence, setEvidence] = useState<QualityEvidence[]>([]);
  const [events, setEvents] = useState<QualityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAction, setNewAction] = useState({ tipo: "corretiva" as QualityActionType, descricao: "", due_date: "" });
  const [uploadDescription, setUploadDescription] = useState("");

  const loadData = async () => {
    if (!id) return;
    const [caseRes, actionRes, evidenceRes, eventRes] = await Promise.all([
      (supabase as any).from("quality_cases").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("quality_actions").select("*").eq("quality_case_id", id).order("created_at"),
      (supabase as any).from("quality_evidence").select("*").eq("quality_case_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("quality_case_events").select("*").eq("quality_case_id", id).order("created_at", { ascending: false }),
    ]);
    setItem(caseRes.data);
    setActions(actionRes.data || []);
    setEvidence(evidenceRes.data || []);
    setEvents(eventRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const completion = useMemo(() => {
    const done = actions.filter(a => a.status === "concluida").length;
    return actions.length ? Math.round((done / actions.length) * 100) : 0;
  }, [actions]);

  const addEvent = async (event_type: string, description: string, after_state?: Record<string, unknown>) => {
    if (!id || !user) return;
    await (supabase as any).from("quality_case_events").insert({ quality_case_id: id, event_type, description, actor_id: user.id, after_state });
  };

  const updateCase = async (patch: Partial<QualityCase>, description = "RACP atualizada") => {
    if (!item || !user) return;
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("quality_cases")
      .update({ ...patch, updated_by: user.id })
      .eq("id", item.id)
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      setItem(data);
      await addEvent("updated", description, patch as Record<string, unknown>);
      toast.success(description);
      loadData();
    }
    setSaving(false);
  };

  const advanceStatus = async () => {
    if (!item) return;
    const status = nextStatus[item.status];
    if (!status) return;
    if (status === "encerrada" && (!item.causa || !item.criterio_eficacia || !item.resultado_eficacia || !item.resumo_final || actions.filter(a => ["corretiva", "preventiva"].includes(a.tipo)).length === 0)) {
      toast.error("Para encerrar, preencha causa, acao corretiva/preventiva, eficacia e resumo final.");
      return;
    }
    await updateCase({
      status,
      closed_at: status === "encerrada" ? new Date().toISOString() : item.closed_at,
      closed_by: status === "encerrada" ? user?.id : item.closed_by,
    } as any, `Status alterado para ${STATUS_LABELS[status]}`);
  };

  const addAction = async () => {
    if (!item || !user || !newAction.descricao.trim()) return;
    const { error } = await (supabase as any).from("quality_actions").insert({
      ...newAction,
      quality_case_id: item.id,
      responsavel_id: user.id,
      responsavel_nome: profile?.nome,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      setNewAction({ tipo: "corretiva", descricao: "", due_date: "" });
      await addEvent("action_created", "Acao adicionada", newAction);
      toast.success("Acao adicionada.");
      loadData();
    }
  };

  const completeAction = async (action: QualityAction) => {
    const { error } = await (supabase as any).from("quality_actions").update({
      status: "concluida",
      completed_at: new Date().toISOString(),
    }).eq("id", action.id);
    if (error) toast.error(error.message);
    else {
      await addEvent("action_completed", `Acao concluida: ${action.descricao}`);
      toast.success("Acao concluida.");
      loadData();
    }
  };

  const uploadEvidence = async (file?: File) => {
    if (!file || !item || !user) return;
    const storagePath = `${item.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("quality-evidence").upload(storagePath, file);
    if (uploadError) {
      toast.error(uploadError.message);
      return;
    }
    const { data: signed } = await supabase.storage.from("quality-evidence").createSignedUrl(storagePath, 60 * 60);
    await (supabase as any).from("quality_evidence").insert({
      quality_case_id: item.id,
      file_name: file.name,
      file_type: file.type,
      storage_path: storagePath,
      file_url: signed?.signedUrl,
      description: uploadDescription,
      uploaded_by: user.id,
    });
    await addEvent("evidence_uploaded", `Evidencia anexada: ${file.name}`);
    setUploadDescription("");
    toast.success("Evidencia anexada.");
    loadData();
  };

  const requestAiSuggestion = async () => {
    if (!item) return;
    const { error } = await (supabase as any).from("ai_action_requests").insert({
      domain: "quality",
      action_type: "quality_suggestion",
      title: `Sugestao de acao para ${item.codigo}`,
      description: [item.descricao, item.impacto, item.causa].filter(Boolean).join("\n\n"),
      requires_approval: true,
      status: "pending",
      evidence: {
        quality_case_id: item.id,
        codigo: item.codigo,
        tipo: item.tipo,
        origem: item.origem,
        prioridade: item.prioridade,
        descricao: item.descricao,
        causa: item.causa,
        impacto: item.impacto,
      },
    });
    if (error) toast.error(error.message);
    else toast.success("Sugestao enviada para aprovacao da IA.");
  };

  if (loading) return <HexaLayout><p className="text-muted-foreground p-6">Carregando...</p></HexaLayout>;
  if (!item) return <HexaLayout><p className="text-muted-foreground p-6">RACP nao encontrada</p></HexaLayout>;

  return (
    <HexaLayout>
      <div className="max-w-6xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/quality/cases")}><ArrowLeft className="w-4 h-4" /> Voltar</Button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> {item.codigo}</h1>
            <p className="text-sm text-muted-foreground">{item.titulo}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={statusBadgeClass(item.status, isCaseOverdue(item))}>{isCaseOverdue(item) ? "Atrasada" : STATUS_LABELS[item.status]}</Badge>
            <Badge className={priorityBadgeClass(item.prioridade)}>{item.prioridade}</Badge>
            <Button variant="outline" size="sm" className="gap-1" onClick={requestAiSuggestion}><Bot className="w-4 h-4" /> Sugerir com IA</Button>
            <Button size="sm" onClick={advanceStatus} disabled={saving}>{item.status === "eficaz" ? "Encerrar" : "Avancar status"}</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Origem</p><p className="font-semibold">{item.origem}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Tipo</p><p className="font-semibold capitalize">{item.tipo}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Prazo</p><p className="font-semibold">{formatDate(item.data_limite)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Acoes</p><p className="font-semibold">{completion}% concluidas</p></CardContent></Card>
        </div>

        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="acoes">Acoes</TabsTrigger>
            <TabsTrigger value="evidencias">Evidencias</TabsTrigger>
            <TabsTrigger value="eficacia">Eficacia</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <Card><CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info label="Cliente" value={item.cliente} />
                <Info label="Equipamento/peca" value={item.equipamento} />
                <Info label="Serial/lote" value={item.serial_lote} />
                <Info label="Referencia" value={item.referencia} />
                <Info label="Metodo" value={item.metodo.toUpperCase()} />
                <Info label="Risco" value={item.risco_nivel} />
              </div>
              <TextBlock label="Descricao" value={item.descricao} />
              <TextBlock label="Impacto" value={item.impacto} />
              <TextBlock label="Contencao imediata" value={item.contencao_imediata} />
              <TextBlock label="Causa" value={item.causa} />
              <div className="flex flex-wrap gap-2 pt-2">
                {item.work_order_id && <Link to={`/os/${item.work_order_id}`}><Button variant="outline" size="sm">Abrir OS vinculada</Button></Link>}
                {item.lab_part_id && <Link to="/lab"><Button variant="outline" size="sm">Abrir laboratorio</Button></Link>}
                {item.stock_product_id && <Link to="/stock/products"><Button variant="outline" size="sm">Abrir estoque</Button></Link>}
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="acoes">
            <Card>
              <CardHeader><CardTitle className="text-lg">Plano de acao</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_170px_110px] gap-2 items-end">
                  <Select value={newAction.tipo} onValueChange={v => setNewAction(prev => ({ ...prev, tipo: v as QualityActionType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ACTION_TYPE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
                  <Input placeholder="Nova acao..." value={newAction.descricao} onChange={e => setNewAction(prev => ({ ...prev, descricao: e.target.value }))} />
                  <Input type="date" value={newAction.due_date} onChange={e => setNewAction(prev => ({ ...prev, due_date: e.target.value }))} />
                  <Button onClick={addAction} className="gap-1"><Plus className="w-4 h-4" /> Adicionar</Button>
                </div>
                {actions.map(action => (
                  <div key={action.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{ACTION_TYPE_LABELS[action.tipo]}</Badge>
                        {isActionOverdue(action) && <Badge className="bg-red-100 text-red-800">Atrasada</Badge>}
                        {action.status === "concluida" && <Badge className="bg-green-100 text-green-800">Concluida</Badge>}
                      </div>
                      <p className="text-sm font-medium">{action.descricao}</p>
                      <p className="text-xs text-muted-foreground">Prazo: {formatDate(action.due_date)} • Responsavel: {action.responsavel_nome || "-"}</p>
                    </div>
                    {action.status !== "concluida" && <Button variant="outline" size="sm" className="gap-1" onClick={() => completeAction(action)}><CheckCircle2 className="w-4 h-4" /> Concluir</Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidencias">
            <Card><CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-2">
                <Input placeholder="Descricao da evidencia" value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} />
                <Label className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground cursor-pointer gap-2">
                  <FileUp className="w-4 h-4" /> Anexar arquivo
                  <Input type="file" className="hidden" onChange={e => uploadEvidence(e.target.files?.[0])} />
                </Label>
              </div>
              <div className="space-y-2">
                {evidence.map(file => (
                  <div key={file.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="text-sm font-medium">{file.file_name}</p><p className="text-xs text-muted-foreground">{file.description || "Sem descricao"} • {formatDate(file.created_at)}</p></div>
                    {file.file_url && <a href={file.file_url} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Abrir</Button></a>}
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="eficacia">
            <Card><CardContent className="pt-6 space-y-4">
              <div className="space-y-2"><Label>Criterio de eficacia</Label><Textarea rows={3} value={item.criterio_eficacia || ""} onChange={e => setItem({ ...item, criterio_eficacia: e.target.value })} /></div>
              <div className="space-y-2"><Label>Resultado da verificacao</Label><Textarea rows={3} value={item.resultado_eficacia || ""} onChange={e => setItem({ ...item, resultado_eficacia: e.target.value })} /></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(item.corretiva_eficaz)} onCheckedChange={v => setItem({ ...item, corretiva_eficaz: Boolean(v) })} /> Corretiva eficaz</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(item.preventiva_eficaz)} onCheckedChange={v => setItem({ ...item, preventiva_eficaz: Boolean(v) })} /> Preventiva eficaz</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(item.risco_residual_aceito)} onCheckedChange={v => setItem({ ...item, risco_residual_aceito: Boolean(v) })} /> Risco residual aceito</label>
              </div>
              <div className="space-y-2"><Label>Resumo final</Label><Textarea rows={3} value={item.resumo_final || ""} onChange={e => setItem({ ...item, resumo_final: e.target.value })} /></div>
              <div className="flex flex-wrap gap-2">
                <Button className="gap-1" onClick={() => updateCase({
                  criterio_eficacia: item.criterio_eficacia,
                  resultado_eficacia: item.resultado_eficacia,
                  corretiva_eficaz: item.corretiva_eficaz,
                  preventiva_eficaz: item.preventiva_eficaz,
                  risco_residual_aceito: item.risco_residual_aceito,
                  resumo_final: item.resumo_final,
                  status: item.corretiva_eficaz || item.preventiva_eficaz ? "eficaz" : "ineficaz",
                } as any, "Eficacia registrada")}><Save className="w-4 h-4" /> Salvar eficacia</Button>
                <Button variant="outline" onClick={() => updateCase({ status: "ineficaz" } as any, "RACP marcada como ineficaz")}>Marcar ineficaz</Button>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="auditoria">
            <Card><CardContent className="pt-6 space-y-2">
              {events.map(event => (
                <div key={event.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{event.description || event.event_type}</p>
                  <p className="text-xs text-muted-foreground">{event.event_type} • {formatDate(event.created_at)}</p>
                </div>
              ))}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value || "-"}</p></div>;
}

function TextBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <div><p className="text-xs text-muted-foreground mb-1">{label}</p><p className="text-sm whitespace-pre-wrap rounded-lg bg-muted/40 p-3">{value}</p></div>;
}
