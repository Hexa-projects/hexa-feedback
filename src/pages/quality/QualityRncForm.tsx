import { useState } from "react";
import { useNavigate } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { RNC_DISPOSICOES, RNC_ORIGENS, RNC_TIPOS, todayISO } from "./qualityUtils";

export default function QualityRncForm() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    origem: "Processo interno",
    prioridade: "media",
    emitente: profile?.nome || "",
    data_emissao: todayISO(),
    cliente_fornecedor: "",
    pedido_compra: "",
    nota_fiscal: "",
    ordem_producao: "",
    descricao_item: "",
    codigo_item: "",
    lote_serial: "",
    quantidade_afetada: "",
    unidade: "",
    descricao_nao_conformidade: "",
    evidencia_inicial: "",
    area_detectada: "",
    detectado_por: "",
    tipo_nao_conformidade: "Produto",
    requisito_descumprido: "",
    impacto: "",
    disposicao: "",
    disposicao_observacao: "",
    disposicao_responsavel_1: "",
    disposicao_data_1: "",
    disposicao_responsavel_2: "",
    disposicao_data_2: "",
    metodo_retrabalho: "",
    total_horas: "",
    retrabalho_responsavel: "",
    retrabalho_data_inicio: "",
    retrabalho_data_fim: "",
    reinspecao_resultado: "",
    reinspecao_observacao: "",
    reinspecao_responsavel: "",
    reinspecao_data: "",
    requer_racp: false,
  });

  const update = (key: string, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const generateCode = async () => {
    const year = new Date().getFullYear();
    const { count } = await (supabase as any)
      .from("quality_rncs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${year}-01-01`)
      .lt("created_at", `${year + 1}-01-01`);
    return `RNC-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.origem || !form.descricao_nao_conformidade.trim()) {
      toast.error("Preencha origem e descricao da nao conformidade.");
      return;
    }
    setSaving(true);
    const codigo = await generateCode();
    const status = form.disposicao === "Retrabalho" ? "em_retrabalho" : form.disposicao ? "em_disposicao" : "aberta";
    const payload = {
      ...form,
      codigo,
      status: form.requer_racp ? "aguardando_racp" : status,
      quantidade_afetada: form.quantidade_afetada ? Number(form.quantidade_afetada) : null,
      total_horas: form.total_horas ? Number(form.total_horas) : null,
      reinspecao_resultado: form.reinspecao_resultado || null,
      created_by: user.id,
      owner_id: user.id,
      updated_by: user.id,
    };
    const { data, error } = await (supabase as any).from("quality_rncs").insert(payload).select().single();
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await (supabase as any).from("quality_rnc_events").insert({
      rnc_id: data.id,
      event_type: "created",
      description: `RNC ${codigo} criada`,
      actor_id: user.id,
      after_state: payload,
    });
    toast.success("RNC criada com sucesso.");
    navigate(`/quality/rnc/${data.id}`);
  };

  return (
    <HexaLayout>
      <div className="max-w-5xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/quality/rnc")}><ArrowLeft className="w-4 h-4" /> Voltar</Button>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><AlertCircle className="w-6 h-6 text-primary" /> Nova RNC</h1>
            <p className="text-sm text-muted-foreground">Registro objetivo de nao conformidade, disposicao e reinspecao</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}</Button>
        </div>

        <Tabs defaultValue="identificacao" className="space-y-4">
          <TabsList>
            <TabsTrigger value="identificacao">Identificacao</TabsTrigger>
            <TabsTrigger value="disposicao">Disposicao</TabsTrigger>
            <TabsTrigger value="reinspecao">Reinspecao</TabsTrigger>
          </TabsList>

          <TabsContent value="identificacao">
            <Card>
              <CardHeader><CardTitle className="text-lg">Cabecalho e nao conformidade</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-2"><Label>Emitente</Label><Input value={form.emitente} onChange={e => update("emitente", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.data_emissao} onChange={e => update("data_emissao", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Origem</Label><Select value={form.origem} onValueChange={v => update("origem", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RNC_ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Prioridade</Label><Select value={form.prioridade} onValueChange={v => update("prioridade", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Critica</SelectItem></SelectContent></Select></div>
                  <div className="md:col-span-2 space-y-2"><Label>Cliente / fornecedor</Label><Input value={form.cliente_fornecedor} onChange={e => update("cliente_fornecedor", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Pedido de compra</Label><Input value={form.pedido_compra} onChange={e => update("pedido_compra", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Nota fiscal</Label><Input value={form.nota_fiscal} onChange={e => update("nota_fiscal", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Ordem de producao</Label><Input value={form.ordem_producao} onChange={e => update("ordem_producao", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Descricao do item</Label><Input value={form.descricao_item} onChange={e => update("descricao_item", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Codigo</Label><Input value={form.codigo_item} onChange={e => update("codigo_item", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Lote / serial</Label><Input value={form.lote_serial} onChange={e => update("lote_serial", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Quantidade</Label><Input type="number" value={form.quantidade_afetada} onChange={e => update("quantidade_afetada", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Unidade</Label><Input value={form.unidade} onChange={e => update("unidade", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Tipo</Label><Select value={form.tipo_nao_conformidade} onValueChange={v => update("tipo_nao_conformidade", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RNC_TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Area detectada</Label><Input value={form.area_detectada} onChange={e => update("area_detectada", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Detectado por</Label><Input value={form.detectado_por} onChange={e => update("detectado_por", e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Descricao da nao conformidade</Label><Textarea rows={4} value={form.descricao_nao_conformidade} onChange={e => update("descricao_nao_conformidade", e.target.value)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Requisito descumprido</Label><Textarea rows={2} value={form.requisito_descumprido} onChange={e => update("requisito_descumprido", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Evidencia inicial</Label><Textarea rows={2} value={form.evidencia_inicial} onChange={e => update("evidencia_inicial", e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Impacto</Label><Textarea rows={2} value={form.impacto} onChange={e => update("impacto", e.target.value)} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disposicao">
            <Card>
              <CardHeader><CardTitle className="text-lg">Disposicao e retrabalho</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Disposicao</Label><Select value={form.disposicao || "none"} onValueChange={v => update("disposicao", v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">A definir</SelectItem>{RNC_DISPOSICOES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Responsavel 1</Label><Input value={form.disposicao_responsavel_1} onChange={e => update("disposicao_responsavel_1", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Data 1</Label><Input type="date" value={form.disposicao_data_1} onChange={e => update("disposicao_data_1", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Responsavel 2</Label><Input value={form.disposicao_responsavel_2} onChange={e => update("disposicao_responsavel_2", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Data 2</Label><Input type="date" value={form.disposicao_data_2} onChange={e => update("disposicao_data_2", e.target.value)} /></div>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm mt-8"><Checkbox checked={form.requer_racp} onCheckedChange={v => update("requer_racp", Boolean(v))} /> Requer RACP</label>
                </div>
                <div className="space-y-2"><Label>Observacao da disposicao</Label><Textarea rows={3} value={form.disposicao_observacao} onChange={e => update("disposicao_observacao", e.target.value)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2 space-y-2"><Label>Metodo de retrabalho</Label><Textarea rows={3} value={form.metodo_retrabalho} onChange={e => update("metodo_retrabalho", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Total de horas</Label><Input type="number" value={form.total_horas} onChange={e => update("total_horas", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Responsavel retrabalho</Label><Input value={form.retrabalho_responsavel} onChange={e => update("retrabalho_responsavel", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Inicio</Label><Input type="date" value={form.retrabalho_data_inicio} onChange={e => update("retrabalho_data_inicio", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.retrabalho_data_fim} onChange={e => update("retrabalho_data_fim", e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reinspecao">
            <Card>
              <CardHeader><CardTitle className="text-lg">Reinspecao do produto retrabalhado</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>Resultado</Label><Select value={form.reinspecao_resultado || "none"} onValueChange={v => update("reinspecao_resultado", v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nao realizada</SelectItem><SelectItem value="aprovado">Aprovado</SelectItem><SelectItem value="reprovado">Reprovado</SelectItem><SelectItem value="aprovado_com_restricao">Aprovado com restricao</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Responsavel</Label><Input value={form.reinspecao_responsavel} onChange={e => update("reinspecao_responsavel", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.reinspecao_data} onChange={e => update("reinspecao_data", e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Observacao</Label><Textarea rows={4} value={form.reinspecao_observacao} onChange={e => update("reinspecao_observacao", e.target.value)} /></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
