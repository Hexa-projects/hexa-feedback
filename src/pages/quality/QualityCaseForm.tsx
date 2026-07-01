import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import { ArrowLeft, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { ORIGENS, todayISO } from "./qualityUtils";
import type { QualityActionType } from "./qualityTypes";

interface ActionDraft {
  tipo: QualityActionType;
  descricao: string;
  due_date: string;
}

const emptyAction: ActionDraft = { tipo: "corretiva", descricao: "", due_date: "" };

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
    descricao: "",
    impacto: "",
    contencao_imediata: "",
    causa: "",
    criterio_eficacia: "",
    data_limite: "",
    data_verificacao: "",
  });
  const [actions, setActions] = useState<ActionDraft[]>([{ ...emptyAction }]);

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
        ...action,
        quality_case_id: data.id,
        responsavel_id: user.id,
        responsavel_nome: profile?.nome,
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
            <TabsTrigger value="acoes">Acoes e eficacia</TabsTrigger>
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
                  <div className="space-y-2"><Label>Cliente</Label><Input value={form.cliente} onChange={e => update("cliente", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Equipamento/peca</Label><Input value={form.equipamento} onChange={e => update("equipamento", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Serial/lote</Label><Input value={form.serial_lote} onChange={e => update("serial_lote", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Referencia</Label><Input value={form.referencia} onChange={e => update("referencia", e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Descricao do fato, nao conformidade ou risco</Label><Textarea rows={4} value={form.descricao} onChange={e => update("descricao", e.target.value)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Impacto</Label><Textarea rows={3} value={form.impacto} onChange={e => update("impacto", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Contencao imediata</Label><Textarea rows={3} value={form.contencao_imediata} onChange={e => update("contencao_imediata", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Causa provavel/raiz</Label><Textarea rows={3} value={form.causa} onChange={e => update("causa", e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acoes">
            <Card>
              <CardHeader><CardTitle className="text-lg">Plano enxuto e eficacia</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {actions.map((action, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[160px_1fr_170px_40px] gap-2 items-end">
                      <div className="space-y-2"><Label>Tipo</Label><Select value={action.tipo} onValueChange={v => setActions(prev => prev.map((a, i) => i === index ? { ...a, tipo: v as QualityActionType } : a))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contencao">Contencao</SelectItem><SelectItem value="corretiva">Corretiva</SelectItem><SelectItem value="preventiva">Preventiva</SelectItem><SelectItem value="verificacao">Verificacao</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label>Acao</Label><Input value={action.descricao} onChange={e => setActions(prev => prev.map((a, i) => i === index ? { ...a, descricao: e.target.value } : a))} /></div>
                      <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={action.due_date} onChange={e => setActions(prev => prev.map((a, i) => i === index ? { ...a, due_date: e.target.value } : a))} /></div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setActions(prev => prev.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setActions(prev => [...prev, { ...emptyAction }])}><Plus className="w-4 h-4" /> Adicionar acao</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Criterio de eficacia</Label><Textarea rows={3} value={form.criterio_eficacia} onChange={e => update("criterio_eficacia", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Data prevista de verificacao</Label><Input type="date" value={form.data_verificacao} onChange={e => update("data_verificacao", e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
