import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Package, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS = ["Bobina", "Placa", "Módulo", "Fonte", "Sensor", "Conector", "Motor", "Criogenia", "Geral"];
const STATUSES = ["Disponível", "Em Manutenção", "Teste/QA", "Aguardando Peça", "Envio ao Cliente", "Indisponível"];

export default function StockProductForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "", categoria: "Geral", descricao: "", serial_number: "", part_number: "",
    hexa_id: "", quantidade: 0, quantidade_minima: 0, localizacao: "", status: "Disponível",
    fornecedor: "", custo_unitario: 0, notas: ""
  });

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("stock_products").insert({ ...form, user_id: user.id });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Produto cadastrado!");
    navigate("/stock/products");
  };

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Novo Produto</h1>
            <p className="text-sm text-muted-foreground">Cadastrar item no estoque</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => update("nome", e.target.value)} placeholder="Ex: Bobina Gradiente X" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => update("categoria", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Serial Number (S/N)</Label>
                <Input value={form.serial_number} onChange={e => update("serial_number", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Part Number (P/N)</Label>
                <Input value={form.part_number} onChange={e => update("part_number", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>HEXA ID</Label>
                <Input value={form.hexa_id} onChange={e => update("hexa_id", e.target.value)} placeholder="HEXA-XXXX" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => update("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" min={0} value={form.quantidade} onChange={e => update("quantidade", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Qtd Mínima (alerta)</Label>
                <Input type="number" min={0} value={form.quantidade_minima} onChange={e => update("quantidade_minima", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Localização</Label>
                <Input value={form.localizacao} onChange={e => update("localizacao", e.target.value)} placeholder="Almoxarifado A, Prateleira 3" />
              </div>
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                <Input value={form.fornecedor} onChange={e => update("fornecedor", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Custo Unitário (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.custo_unitario} onChange={e => update("custo_unitario", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => update("descricao", e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={e => update("notas", e.target.value)} rows={2} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Produto"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
