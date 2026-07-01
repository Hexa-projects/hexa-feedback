import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, CheckCircle2, FileUp, Save, ShieldCheck } from "lucide-react";
import type { QualityEvidence, QualityRnc, QualityRncEvent } from "./qualityTypes";
import { formatDate, priorityBadgeClass, RNC_STATUS_LABELS, rncStatusBadgeClass } from "./qualityUtils";

export default function QualityRncDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<QualityRnc | null>(null);
  const [events, setEvents] = useState<QualityRncEvent[]>([]);
  const [evidence, setEvidence] = useState<QualityEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDescription, setUploadDescription] = useState("");

  const loadData = async () => {
    if (!id) return;
    const [rncRes, eventRes, evidenceRes] = await Promise.all([
      (supabase as any).from("quality_rncs").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("quality_rnc_events").select("*").eq("rnc_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("quality_evidence").select("*").eq("rnc_id", id).order("created_at", { ascending: false }),
    ]);
    setItem(rncRes.data);
    setEvents(eventRes.data || []);
    setEvidence(evidenceRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const addEvent = async (event_type: string, description: string, after_state?: Record<string, unknown>) => {
    if (!id || !user) return;
    await (supabase as any).from("quality_rnc_events").insert({ rnc_id: id, event_type, description, actor_id: user.id, after_state });
  };

  const updateRnc = async (patch: Partial<QualityRnc>, message = "RNC atualizada") => {
    if (!item || !user) return;
    const { data, error } = await (supabase as any).from("quality_rncs").update({ ...patch, updated_by: user.id }).eq("id", item.id).select().single();
    if (error) toast.error(error.message);
    else {
      setItem(data);
      await addEvent("updated", message, patch as Record<string, unknown>);
      toast.success(message);
      loadData();
    }
  };

  const createRacp = async () => {
    if (!item || !user) return;
    const year = new Date().getFullYear();
    const { count } = await (supabase as any).from("quality_cases").select("id", { count: "exact", head: true }).gte("created_at", `${year}-01-01`).lt("created_at", `${year + 1}-01-01`);
    const codigo = `RACP-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
    const { data, error } = await (supabase as any).from("quality_cases").insert({
      codigo,
      titulo: `RACP vinculada a ${item.codigo}`,
      tipo: "corretiva",
      origem: "RNC",
      classificacao: ["Nao conformidade real"],
      prioridade: item.prioridade,
      risco_nivel: item.prioridade === "critica" ? "critico" : item.prioridade === "alta" ? "alto" : "medio",
      cliente: item.cliente_fornecedor,
      equipamento: item.descricao_item,
      serial_lote: item.lote_serial,
      referencia: item.codigo,
      descricao: item.descricao_nao_conformidade,
      impacto: item.impacto,
      evidencia_inicial: item.evidencia_inicial,
      rnc_id: item.id,
      owner_id: user.id,
      created_by: user.id,
      updated_by: user.id,
    }).select().single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await (supabase as any).from("quality_rncs").update({ racp_id: data.id, requer_racp: true, status: "aguardando_racp" }).eq("id", item.id);
    await addEvent("racp_created", `RACP ${codigo} criada a partir da RNC`, { racp_id: data.id });
    toast.success("RACP criada e vinculada.");
    navigate(`/quality/cases/${data.id}`);
  };

  const uploadEvidence = async (file?: File) => {
    if (!file || !item || !user) return;
    const storagePath = `rnc/${item.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("quality-evidence").upload(storagePath, file);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data: signed } = await supabase.storage.from("quality-evidence").createSignedUrl(storagePath, 60 * 60);
    await (supabase as any).from("quality_evidence").insert({
      rnc_id: item.id,
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

  if (loading) return <HexaLayout><p className="text-muted-foreground p-6">Carregando...</p></HexaLayout>;
  if (!item) return <HexaLayout><p className="text-muted-foreground p-6">RNC nao encontrada</p></HexaLayout>;

  return (
    <HexaLayout>
      <div className="max-w-6xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/quality/rnc")}><ArrowLeft className="w-4 h-4" /> Voltar</Button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><AlertCircle className="w-6 h-6 text-primary" /> {item.codigo}</h1>
            <p className="text-sm text-muted-foreground">{item.descricao_item || item.cliente_fornecedor || "Relatorio de nao conformidade"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={rncStatusBadgeClass(item.status)}>{RNC_STATUS_LABELS[item.status]}</Badge>
            <Badge className={priorityBadgeClass(item.prioridade)}>{item.prioridade}</Badge>
            {item.racp_id ? <Link to={`/quality/cases/${item.racp_id}`}><Button variant="outline" size="sm">Abrir RACP</Button></Link> : <Button variant="outline" size="sm" className="gap-1" onClick={createRacp}><ShieldCheck className="w-4 h-4" /> Gerar RACP</Button>}
            <Button size="sm" className="gap-1" onClick={() => updateRnc({ status: "encerrada", closed_at: new Date().toISOString(), closed_by: user?.id } as any, "RNC encerrada")}><CheckCircle2 className="w-4 h-4" /> Encerrar</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Origem</p><p className="font-semibold">{item.origem}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Emissao</p><p className="font-semibold">{formatDate(item.data_emissao)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Disposicao</p><p className="font-semibold">{item.disposicao || "-"}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Reinspecao</p><p className="font-semibold">{item.reinspecao_resultado || "-"}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="disposicao">Disposicao</TabsTrigger>
            <TabsTrigger value="reinspecao">Reinspecao</TabsTrigger>
            <TabsTrigger value="evidencias">Evidencias</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <Card><CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Info label="Emitente" value={item.emitente} />
                <Info label="Cliente/fornecedor" value={item.cliente_fornecedor} />
                <Info label="Pedido compra" value={item.pedido_compra} />
                <Info label="Nota fiscal" value={item.nota_fiscal} />
                <Info label="Ordem producao" value={item.ordem_producao} />
                <Info label="Item" value={item.descricao_item} />
                <Info label="Codigo item" value={item.codigo_item} />
                <Info label="Lote/serial" value={item.lote_serial} />
                <Info label="Quantidade" value={item.quantidade_afetada ? `${item.quantidade_afetada} ${item.unidade || ""}` : "-"} />
                <Info label="Tipo" value={item.tipo_nao_conformidade} />
                <Info label="Area detectada" value={item.area_detectada} />
                <Info label="Detectado por" value={item.detectado_por} />
              </div>
              <TextBlock label="Descricao da nao conformidade" value={item.descricao_nao_conformidade} />
              <TextBlock label="Requisito descumprido" value={item.requisito_descumprido} />
              <TextBlock label="Evidencia inicial" value={item.evidencia_inicial} />
              <TextBlock label="Impacto" value={item.impacto} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="disposicao">
            <Card><CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Info label="Disposicao" value={item.disposicao} />
                <Info label="Responsavel 1" value={item.disposicao_responsavel_1} />
                <Info label="Data 1" value={formatDate(item.disposicao_data_1)} />
                <Info label="Responsavel 2" value={item.disposicao_responsavel_2} />
                <Info label="Data 2" value={formatDate(item.disposicao_data_2)} />
                <Info label="Total de horas" value={item.total_horas ? String(item.total_horas) : "-"} />
                <Info label="Responsavel retrabalho" value={item.retrabalho_responsavel} />
              </div>
              <TextBlock label="Observacao da disposicao" value={item.disposicao_observacao} />
              <TextBlock label="Metodo de retrabalho" value={item.metodo_retrabalho} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="reinspecao">
            <Card><CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2"><Label>Resultado</Label><Select value={item.reinspecao_resultado || "none"} onValueChange={v => setItem({ ...item, reinspecao_resultado: v === "none" ? null : v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nao realizada</SelectItem><SelectItem value="aprovado">Aprovado</SelectItem><SelectItem value="reprovado">Reprovado</SelectItem><SelectItem value="aprovado_com_restricao">Aprovado com restricao</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Responsavel</Label><Input value={item.reinspecao_responsavel || ""} onChange={e => setItem({ ...item, reinspecao_responsavel: e.target.value })} /></div>
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={item.reinspecao_data || ""} onChange={e => setItem({ ...item, reinspecao_data: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Observacao</Label><Textarea rows={4} value={item.reinspecao_observacao || ""} onChange={e => setItem({ ...item, reinspecao_observacao: e.target.value })} /></div>
              <Button className="gap-1" onClick={() => updateRnc({
                status: item.reinspecao_resultado ? "encerrada" : "em_reinspecao",
                reinspecao_resultado: item.reinspecao_resultado,
                reinspecao_responsavel: item.reinspecao_responsavel,
                reinspecao_data: item.reinspecao_data,
                reinspecao_observacao: item.reinspecao_observacao,
                closed_at: item.reinspecao_resultado === "aprovado" ? new Date().toISOString() : item.closed_at,
              } as any, "Reinspecao atualizada")}><Save className="w-4 h-4" /> Salvar reinspecao</Button>
            </CardContent></Card>
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
              {evidence.map(file => (
                <div key={file.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div><p className="text-sm font-medium">{file.file_name}</p><p className="text-xs text-muted-foreground">{file.description || "Sem descricao"} • {formatDate(file.created_at)}</p></div>
                  {file.file_url && <a href={file.file_url} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Abrir</Button></a>}
                </div>
              ))}
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
