import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Planejamento", "Em Andamento", "Pausado", "Concluído", "Cancelado"];
const PRIORITIES = ["Baixa", "Média", "Alta", "Crítica"];

export default function ProjectForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    cliente: "",
    status: "Planejamento",
    prioridade: "Média",
    data_prevista: "",
    valor_contrato: "",
    notas: "",
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return toast.error("Título é obrigatório");
    setSaving(true);
    const { error } = await supabase.from("projects").insert({
      ...form,
      valor_contrato: parseFloat(form.valor_contrato) || 0,
      data_prevista: form.data_prevista || null,
      user_id: user!.id,
    } as any);
    if (error) toast.error("Erro ao salvar projeto");
    else {
      toast.success("Projeto criado!");
      navigate("/projects");
    }
    setSaving(false);
  };

  return (
    <HexaLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-slide-up">
        <Button variant="ghost" onClick={() => navigate("/projects")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Novo Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => update("titulo", e.target.value)} placeholder="Nome do projeto" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input value={form.cliente} onChange={(e) => update("cliente", e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-2">
                  <Label>Valor do Contrato (R$)</Label>
                  <Input type="number" value={form.valor_contrato} onChange={(e) => update("valor_contrato", e.target.value)} placeholder="0,00" />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={(e) => update("status", e.target.value)}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.prioridade} onChange={(e) => update("prioridade", e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Previsão de Conclusão</Label>
                  <Input type="date" value={form.data_prevista} onChange={(e) => update("data_prevista", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => update("descricao", e.target.value)} placeholder="Descreva o projeto..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={form.notas} onChange={(e) => update("notas", e.target.value)} placeholder="Observações adicionais..." rows={2} />
              </div>
              <Button type="submit" disabled={saving} className="w-full gap-2">
                <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Criar Projeto"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
