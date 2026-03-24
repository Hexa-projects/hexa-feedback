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

export default function LabPartForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    descricao: "", equipamento_origem: "", status: "Entrada",
    localizacao: "", notas: "", previsao_conclusao: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.descricao.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("lab_parts").insert({
      ...form,
      previsao_conclusao: form.previsao_conclusao || null,
      user_id: user.id,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Peça registrada!" }); navigate("/lab"); }
    setSaving(false);
  };

  const update = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <HexaLayout>
      <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/lab")}><ArrowLeft className="w-4 h-4" /> Voltar</Button>
        <Card>
          <CardHeader><CardTitle>Registrar Peça</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input value={form.descricao} onChange={e => update("descricao", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Equipamento Origem</Label>
                  <Input value={form.equipamento_origem} onChange={e => update("equipamento_origem", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => update("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Entrada", "Em Reparo", "Em Teste", "Pronta"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Input value={form.localizacao} onChange={e => update("localizacao", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Previsão Conclusão</Label>
                  <Input type="date" value={form.previsao_conclusao} onChange={e => update("previsao_conclusao", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={form.notas} onChange={e => update("notas", e.target.value)} rows={3} />
              </div>
              <Button type="submit" disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? "Salvando..." : "Registrar"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
