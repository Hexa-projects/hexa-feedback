import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { ATUALIZACOES_PREVENTIVAS, CAUSA_CATEGORIAS, CLASSIFICACOES, IMPACTO_DIMENSOES, ORIGENS, todayISO } from "./qualityUtils";
import type { QualityActionType } from "./qualityTypes";

interface ActionDraft {
  tipo: QualityActionType;
  descricao: string;
  due_date: string;
  responsavel_nome: string;
  custo: string;
  abrangencia: string;
}

const emptyAction: ActionDraft = { tipo: "corretiva", descricao: "", due_date: "", responsavel_nome: "", custo: "", abrangencia: "" };

export default function QualityCaseForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    tipo: "corretiva",
    metodo: "racp",
    origem: params.get("origem") || "Processo interno",
    prioridade: "media",
    risco_nivel: "medio",
    cliente: "",
    equipamento: "",
    serial_lote: "",
    referencia: "",
    data_ocorrencia: "",
    data_deteccao: "",
    local_deteccao: "",
    detectado_por: "",
    evidencia_inicial: "",
    descricao: "",
    impacto: "",
    contencao_imediata: "",
    contencao_realizada_em: "",
    contencao_responsavel: "",
    causa: "",
    causa_status: "provavel",
    causa_categoria: "",
    causa_evidencias: "",
    causas_descartadas: "",
    objetivo_corretivo: "",
    objetivo_preventivo: "",
    abrangencia_preventiva: "",
    criterio_eficacia: "",
    data_limite: "",
    data_verificacao: "",
    licoes_aprendidas: "",
    documento_relacionado: "",
  });
  const [actions, setActions] = useState<ActionDraft[]>([{ ...emptyAction }]);
  const [classificacao, setClassificacao] = useState<string[]>([]);
  const [impactoDimensoes, setImpactoDimensoes] = useState<string[]>([]);
  const [atualizacoesPreventivas, setAtualizacoesPreventivas] = useState<string[]>([]);
  const [cincoPorques, setCincoPorques] = useState([
    { pergunta: "Por que ocorreu?", resposta: "", evidencia: "" },
  ]);

  useEffect(() => {
    const loadLinkedData = async () => {
      const workOrderId = params.get("work_order_id");
      const labPartId = params.get("lab_part_id");
      const stockProductId = params.get("stock_product_id");
      if (workOrderId) {
        const { data } = await (supabase as any).from("work_orders").select("*").eq("id", workOrderId).maybeSingle();
        if (data) setForm(prev => ({
          ...prev,
          origem: "OS",
          cliente: data.cliente || "",
          equipamento: data.equipamento || "",
          serial_lote: data.equipamento_serial || "",
          referencia: data.numero_os ? `OS ${data.numero_os}` : workOrderId,
          titulo: data.equipamento ? `RACP - ${data.equipamento}` : "RACP vinculada a OS",
          descricao: data.descricao || "",
        }));
      }
      if (labPartId) {
        const { data } = await (supabase as any).from("lab_parts").select("*").eq("id", labPartId).maybeSingle();
        if (data) setForm(prev => ({
          ...prev,
          origem: "Laboratorio",
          equipamento: data.equipamento_origem || "",
          serial_lote: data.serial_number || "",
          referencia: `Lab ${labPartId.slice(0, 8)}`,
          titulo: data.descricao ? `RACP - ${data.descricao}` : "RACP vinculada ao laboratorio",
          descricao: data.notas || data.descricao || "",
        }));
      }
      if (stockProductId) {
        const { data } = await (supabase as any).from("stock_products").select("*").eq("id", stockProductId).maybeSingle();
        if (data) setForm(prev => ({
          ...prev,
          origem: "Estoque",
          equipamento: data.nome || "",
          serial_lote: data.serial_number || data.part_number || "",
          referencia: data.hexa_id || data.part_number || stockProductId.slice(0, 8),
          titulo: data.nome ? `RACP - ${data.nome}` : "RACP vinculada ao estoque",
          descricao: data.notas || data.descricao || "",
        }));
      }
    };
    loadLinkedData();
  }, [params]);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleValue = (value: string, setter: Dispatch<SetStateAction<string[]>>) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  const generateCode = async () => {
    const year = new Date().getFullYear();
    const { count } = await (supabase as any)
      .from("quality_cases")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${year}-01-01`)
      .lt("created_at", `${year + 1}-01-01`);
    return `RACP-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.titulo.trim() || !form.origem || !form.descricao.trim()) {
      toast.error("Preencha titulo, origem e descricao.");
      return;
    }
    const validActions = actions.filter(a => a.descricao.trim());
    setSaving(true);
    const codigo = await generateCode();
    const payload = {
      ...form,
      codigo,
      classificacao,
      impacto_dimensoes: impactoDimensoes,
      atualizacoes_preventivas: atualizacoesPreventivas,
      cinco_porques: cincoPorques.filter(item => item.resposta.trim()),
      owner_id: user.id,
      created_by: user.id,
      updated_by: user.id,
      work_order_id: params.get("work_order_id"),
      lab_part_id: params.get("lab_part_id"),
      stock_product_id: params.get("stock_product_id"),
      commercial_request_id: params.get("commercial_request_id"),
    };
    const { data, error } = await (supabase as any).from("quality_cases").insert(payload).select().single();
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    if (validActions.length) {
      await (supabase as any).from("quality_actions").insert(validActions.map(action => ({
        tipo: action.tipo,
        descricao: action.descricao,
        due_date: action.due_date || null,
        responsavel_nome: action.responsavel_nome || profile?.nome,
        custo: action.custo ? Number(action.custo) : null,
        abrangencia: action.abrangencia || null,
        quality_case_id: data.id,
        responsavel_id: user.id,
        created_by: user.id,
      })));
    }
    await (supabase as any).from("quality_case_events").insert({
      quality_case_id: data.id,
      event_type: "created",
      description: `RACP ${codigo} criada`,
      actor_id: user.id,
      after_state: payload,
    });
    toast.success("RACP criada com sucesso.");
    navigate(`/quality/cases/${data.id}`);
  };

  return (
    <HexaLayout>
      <div className="max-w-5xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/quality/cases")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> Nova RACP</h1>
            <p className="text-sm text-muted-foreground">Formulario compacto para acao corretiva e preventiva</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}</Button>
        </div>

        <Tabs defaultValue="identificacao" className="space-y-4">
          <TabsList>
            <TabsTrigger value="identificacao">Identificacao</TabsTrigger>
            <TabsTrigger value="analise">Analise</TabsTrigger>
            <TabsTrigger value="acoes">Acoes e eficacia</TabsTrigger>
            <TabsTrigger value="padronizacao">Padronizacao</TabsTrigger>
          </TabsList>

          <TabsContent value="identificacao">
            <Card>
              <CardHeader><CardTitle className="text-lg">Fato, risco e causa</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2 space-y-2"><Label>Titulo</Label><Input value={form.titulo} onChange={e => update("titulo", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Tipo</Label><Select value={form.tipo} onValueChange={v => update("tipo", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="corretiva">Corretiva</SelectItem><SelectItem value="preventiva">Preventiva</SelectItem><SelectItem value="ambas">Ambas</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Metodo</Label><Select value={form.metodo} onValueChange={v => update("metodo", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="racp">RACP</SelectItem><SelectItem value="8d">8D</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Origem</Label><Select value={form.origem} onValueChange={v => update("origem", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Prioridade</Label><Select value={form.prioridade} onValueChange={v => update("prioridade", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Critica</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Risco</Label><Select value={form.risco_nivel} onValueChange={v => update("risco_nivel", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixo">Baixo</SelectItem><SelectItem value="medio">Medio</SelectItem><SelectItem value="alto">Alto</SelectItem><SelectItem value="critico">Critico</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={form.data_limite} min={todayISO()} onChange={e => update("data_limite", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Ocorrencia</Label><Input type="date" value={form.data_ocorrencia} onChange={e => update("data_ocorrencia", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Deteccao</Label><Input type="date" value={form.data_deteccao} onChange={e => update("data_deteccao", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Cliente</Label><Input value={form.cliente} onChange={e => update("cliente", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Equipamento/peca</Label><Input value={form.equipamento} onChange={e => update("equipamento", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Serial/lote</Label><Input value={form.serial_lote} onChange={e => update("serial_lote", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Referencia</Label><Input value={form.referencia} onChange={e => update("referencia", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Local de deteccao</Label><Input value={form.local_deteccao} onChange={e => update("local_deteccao", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Detectado por</Label><Input value={form.detectado_por} onChange={e => update("detectado_por", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Documento relacionado</Label><Input value={form.documento_relacionado} onChange={e => update("documento_relacionado", e.target.value)} placeholder="Procedimento, checklist, laudo..." /></div>
                </div>
                <div className="space-y-2">
                  <Label>Classificacao</Label>
                  <div className="flex flex-wrap gap-2">
                    {CLASSIFICACOES.map(option => (
                      <Button key={option} type="button" size="sm" variant={classificacao.includes(option) ? "default" : "outline"} onClick={() => toggleValue(option, setClassificacao)}>
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2"><Label>Descricao do fato, nao conformidade ou risco</Label><Textarea rows={4} value={form.descricao} onChange={e => update("descricao", e.target.value)} /></div>
                <div className="space-y-2"><Label>Evidencia inicial</Label><Textarea rows={2} value={form.evidencia_inicial} onChange={e => update("evidencia_inicial", e.target.value)} placeholder="Foto, OS, relato, medicao, laudo, teste, log..." /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analise">
            <Card>
              <CardHeader><CardTitle className="text-lg">Impacto, contencao e causa</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Dimensoes de impacto</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {IMPACTO_DIMENSOES.map(option => (
                      <label key={option} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <Checkbox checked={impactoDimensoes.includes(option)} onCheckedChange={() => toggleValue(option, setImpactoDimensoes)} />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Impacto atual</Label><Textarea rows={4} value={form.impacto} onChange={e => update("impacto", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Contencao imediata</Label><Textarea rows={4} value={form.contencao_imediata} onChange={e => update("contencao_imediata", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Causa raiz/potencial</Label><Textarea rows={4} value={form.causa} onChange={e => update("causa", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Responsavel contencao</Label><Input value={form.contencao_responsavel} onChange={e => update("contencao_responsavel", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Contencao realizada em</Label><Input type="datetime-local" value={form.contencao_realizada_em} onChange={e => update("contencao_realizada_em", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Status da causa</Label><Select value={form.causa_status} onValueChange={v => update("causa_status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nao_iniciada">Nao iniciada</SelectItem><SelectItem value="provavel">Provavel</SelectItem><SelectItem value="confirmada">Confirmada</SelectItem><SelectItem value="descartada">Descartada</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Categoria da causa</Label><Select value={form.causa_categoria || "none"} onValueChange={v => update("causa_categoria", v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nao classificada</SelectItem>{CAUSA_CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div className="md:col-span-2 space-y-2"><Label>Evidencias da causa</Label><Input value={form.causa_evidencias} onChange={e => update("causa_evidencias", e.target.value)} placeholder="Registros, testes, fotos, historico, auditoria..." /></div>
                </div>
                <div className="space-y-2">
                  <Label>5 Porques opcional</Label>
                  <div className="space-y-2">
                    {cincoPorques.map((why, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_40px] gap-2">
                        <Input value={why.pergunta} onChange={e => setCincoPorques(prev => prev.map((item, i) => i === index ? { ...item, pergunta: e.target.value } : item))} placeholder={`Pergunta ${index + 1}`} />
                        <Input value={why.resposta} onChange={e => setCincoPorques(prev => prev.map((item, i) => i === index ? { ...item, resposta: e.target.value } : item))} placeholder="Resposta" />
                        <Input value={why.evidencia} onChange={e => setCincoPorques(prev => prev.map((item, i) => i === index ? { ...item, evidencia: e.target.value } : item))} placeholder="Evidencia" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setCincoPorques(prev => prev.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setCincoPorques(prev => [...prev, { pergunta: `Por que ${prev.length + 1}?`, resposta: "", evidencia: "" }])}>Adicionar porque</Button>
                  </div>
                </div>
                <div className="space-y-2"><Label>Causas descartadas e motivo</Label><Textarea rows={2} value={form.causas_descartadas} onChange={e => update("causas_descartadas", e.target.value)} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acoes">
            <Card>
              <CardHeader><CardTitle className="text-lg">Plano enxuto e eficacia</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {actions.map((action, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[150px_1fr_160px_160px_120px_40px] gap-2 items-end">
                      <div className="space-y-2"><Label>Tipo</Label><Select value={action.tipo} onValueChange={v => setActions(prev => prev.map((a, i) => i === index ? { ...a, tipo: v as QualityActionType } : a))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contencao">Contencao</SelectItem><SelectItem value="corretiva">Corretiva</SelectItem><SelectItem value="preventiva">Preventiva</SelectItem><SelectItem value="verificacao">Verificacao</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label>Acao</Label><Input value={action.descricao} onChange={e => setActions(prev => prev.map((a, i) => i === index ? { ...a, descricao: e.target.value } : a))} /></div>
                      <div className="space-y-2"><Label>Responsavel</Label><Input value={action.responsavel_nome} onChange={e => setActions(prev => prev.map((a, i) => i === index ? { ...a, responsavel_nome: e.target.value } : a))} placeholder={profile?.nome || ""} /></div>
                      <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={action.due_date} onChange={e => setActions(prev => prev.map((a, i) => i === index ? { ...a, due_date: e.target.value } : a))} /></div>
                      <div className="space-y-2"><Label>Custo</Label><Input type="number" value={action.custo} onChange={e => setActions(prev => prev.map((a, i) => i === index ? { ...a, custo: e.target.value } : a))} /></div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setActions(prev => prev.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button>
                      <div className="md:col-span-6 space-y-2"><Label>Abrangencia</Label><Input value={action.abrangencia} onChange={e => setActions(prev => prev.map((a, i) => i === index ? { ...a, abrangencia: e.target.value } : a))} placeholder="Cliente, equipamento, serie, fornecedor, processo..." /></div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setActions(prev => [...prev, { ...emptyAction }])}><Plus className="w-4 h-4" /> Adicionar acao</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Objetivo corretivo</Label><Textarea rows={3} value={form.objetivo_corretivo} onChange={e => update("objetivo_corretivo", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Objetivo preventivo</Label><Textarea rows={3} value={form.objetivo_preventivo} onChange={e => update("objetivo_preventivo", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Criterio de eficacia</Label><Textarea rows={3} value={form.criterio_eficacia} onChange={e => update("criterio_eficacia", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Data prevista de verificacao</Label><Input type="date" value={form.data_verificacao} onChange={e => update("data_verificacao", e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="padronizacao">
            <Card>
              <CardHeader><CardTitle className="text-lg">Prevencao e aprendizado</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Abrangencia preventiva</Label><Textarea rows={2} value={form.abrangencia_preventiva} onChange={e => update("abrangencia_preventiva", e.target.value)} placeholder="Onde essa prevencao deve ser replicada?" /></div>
                <div className="space-y-2">
                  <Label>Atualizacoes preventivas</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {ATUALIZACOES_PREVENTIVAS.map(option => (
                      <label key={option} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <Checkbox checked={atualizacoesPreventivas.includes(option)} onCheckedChange={() => toggleValue(option, setAtualizacoesPreventivas)} />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2"><Label>Licoes aprendidas</Label><Textarea rows={3} value={form.licoes_aprendidas} onChange={e => update("licoes_aprendidas", e.target.value)} /></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
