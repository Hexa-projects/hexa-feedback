import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";

export default function WorkOrderForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero_os: "", cliente: "", equipamento: "",
    descricao: "", urgencia: "Média", sla_horas: "48",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.cliente.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("work_orders").insert({
      ...form,
      sla_horas: parseInt(form.sla_horas) || 48,
      user_id: user.id,
      status: "Aberto",
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "OS criada!" }); navigate("/os"); }
    setSaving(false);
  };

  const update = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <HexaLayout>
      <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/os")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Card>
          <CardHeader><CardTitle>Abrir Nova OS</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº OS</Label>
                  <Input value={form.numero_os} onChange={e => update("numero_os", e.target.value)} placeholder="Ex: OS-2026-001" />
                </div>
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Input value={form.cliente} onChange={e => update("cliente", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Equipamento</Label>
                  <Input value={form.equipamento} onChange={e => update("equipamento", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Urgência</Label>
                  <Select value={form.urgencia} onValueChange={v => update("urgencia", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Baixa", "Média", "Alta", "Crítica"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>SLA (horas)</Label>
                  <Input type="number" value={form.sla_horas} onChange={e => update("sla_horas", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição do Problema</Label>
                <Textarea value={form.descricao} onChange={e => update("descricao", e.target.value)} rows={4} />
              </div>
              <Button type="submit" disabled={saving} className="gap-2">
                <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Abrir OS"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
