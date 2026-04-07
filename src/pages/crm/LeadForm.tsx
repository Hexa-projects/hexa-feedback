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
import { createSalesEvent } from "@/lib/openclaw-events";

const STATUSES = ["Qualificação", "Contato Inicial", "Reunião", "Proposta Enviada", "Negociação", "Ganho", "Perdido"];

export default function LeadForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "", empresa: "", email: "", telefone: "",
    status: "Qualificação", valor_estimado: "",
    origem: "", notas: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.nome.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      ...form,
      valor_estimado: parseFloat(form.valor_estimado) || 0,
      user_id: user.id,
      ultimo_contato: new Date().toISOString(),
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead criado com sucesso!" });
      navigate("/crm");
    }
    setSaving(false);
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <HexaLayout>
      <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/crm")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Novo Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={e => update("nome", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input value={form.empresa} onChange={e => update("empresa", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={e => update("telefone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => update("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor Estimado (R$)</Label>
                  <Input type="number" value={form.valor_estimado} onChange={e => update("valor_estimado", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Input value={form.origem} onChange={e => update("origem", e.target.value)} placeholder="Ex: Indicação, Google, Evento" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={form.notas} onChange={e => update("notas", e.target.value)} rows={3} />
              </div>
              <Button type="submit" disabled={saving} className="gap-2">
                <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Criar Lead"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
