import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { SETORES, type Setor } from "@/types/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormProgress from "@/components/FormProgress";

export default function Onboarding() {
  const navigate = useNavigate();
  const user = store.getCurrentUser();
  const [form, setForm] = useState({
    setor: user?.setor || ("Administrativo" as Setor),
    funcao: user?.funcao || "",
    unidade: user?.unidade || "",
    resumoDiaDia: user?.resumoDiaDia || "",
    responsabilidades: user?.responsabilidades || "",
    qualidades: user?.qualidades || "",
    pontosMelhoria: user?.pontosMelhoria || "",
    tempoCasa: user?.tempoCasa || "",
  });

  const fields = Object.values(form);
  const filled = fields.filter(v => v.trim()).length;

  const handleSubmit = () => {
    if (!user) return;
    const updated = { ...user, ...form, onboardingCompleto: true };
    store.saveUser(updated);
    store.setCurrentUser(updated);
    navigate("/daily");
  };

  const u = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-lg mx-auto space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Quem eu sou na Hexamedical</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete seu perfil para personalizar sua experiência.</p>
        </div>

        <FormProgress current={filled} total={fields.length} />

        <div className="space-y-4">
          <div className="form-section">
            <div>
              <Label>Setor</Label>
              <Select value={form.setor} onValueChange={v => u("setor", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Função / Cargo</Label>
              <Input value={form.funcao} onChange={e => u("funcao", e.target.value)} placeholder="Ex: Analista financeiro" />
            </div>
            <div>
              <Label>Unidade / Filial</Label>
              <Input value={form.unidade} onChange={e => u("unidade", e.target.value)} placeholder="Ex: Matriz SP" />
            </div>
            <div>
              <Label>Tempo de casa</Label>
              <Input value={form.tempoCasa} onChange={e => u("tempoCasa", e.target.value)} placeholder="Ex: 2 anos e 3 meses" />
            </div>
          </div>

          <div className="form-section">
            <div>
              <Label>Resumo do que você faz no dia a dia</Label>
              <Textarea value={form.resumoDiaDia} onChange={e => u("resumoDiaDia", e.target.value)} placeholder="Descreva brevemente suas atividades..." rows={3} />
            </div>
            <div>
              <Label>Principais responsabilidades</Label>
              <Textarea value={form.responsabilidades} onChange={e => u("responsabilidades", e.target.value)} placeholder="Liste suas responsabilidades..." rows={3} />
            </div>
          </div>

          <div className="form-section">
            <div>
              <Label>Suas qualidades principais no trabalho</Label>
              <Textarea value={form.qualidades} onChange={e => u("qualidades", e.target.value)} placeholder="O que você faz de melhor..." rows={2} />
            </div>
            <div>
              <Label>Pontos que gostaria de melhorar</Label>
              <Textarea value={form.pontosMelhoria} onChange={e => u("pontosMelhoria", e.target.value)} placeholder="O que pode ser aprimorado..." rows={2} />
            </div>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={filled < 5}>
          Salvar e continuar
        </Button>
      </div>
    </div>
  );
}
