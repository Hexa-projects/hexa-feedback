import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase-store";
import { SETORES, FERRAMENTAS } from "@/types/forms";
import AppLayout from "@/components/AppLayout";
import FormProgress from "@/components/FormProgress";
import SuccessMessage from "@/components/SuccessMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import AudioRecorder from "@/components/AudioRecorder";

export default function DailyForm() {
  const { user, profile } = useAuth();
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    setor: profile?.setor || "Administrativo",
    funcao: profile?.funcao || "",
    atividadesPrincipais: "",
    ferramentas: [] as string[],
    tempoMedioPorAtividade: "",
    maiorConsumoTempo: "",
    impedimentos: "",
  });

  const vals = [form.setor, form.funcao, form.atividadesPrincipais, form.maiorConsumoTempo, form.impedimentos];
  const filled = vals.filter(v => v.trim()).length + (form.ferramentas.length > 0 ? 1 : 0);

  const toggleTool = (tool: string) => {
    setForm(p => ({
      ...p,
      ferramentas: p.ferramentas.includes(tool)
        ? p.ferramentas.filter(t => t !== tool)
        : [...p.ferramentas, tool],
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await db.saveDailyForm({
        user_id: user.id,
        setor: form.setor,
        funcao: form.funcao,
        atividades_principais: form.atividadesPrincipais,
        ferramentas: form.ferramentas,
        tempo_medio_por_atividade: form.tempoMedioPorAtividade,
        maior_consumo_tempo: form.maiorConsumoTempo,
        impedimentos: form.impedimentos,
      });
      setSent(true);
      toast.success("Enviado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm({ setor: profile?.setor || "Administrativo", funcao: profile?.funcao || "", atividadesPrincipais: "", ferramentas: [], tempoMedioPorAtividade: "", maiorConsumoTempo: "", impedimentos: "" });
    setSent(false);
  };

  if (sent) return <AppLayout><SuccessMessage onNew={reset} /></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Meu Dia a Dia</h1>
          <p className="text-sm text-muted-foreground mt-1">Conte como foi seu dia de trabalho.</p>
        </div>
        <FormProgress current={filled} total={6} />

        <div className="form-section">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Setor</Label>
              <Select value={form.setor} onValueChange={v => setForm(p => ({ ...p, setor: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Função</Label>
              <Input value={form.funcao} onChange={e => setForm(p => ({ ...p, funcao: e.target.value }))} placeholder="Sua função" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <Label>Atividades principais do dia</Label>
          <Textarea value={form.atividadesPrincipais} onChange={e => setForm(p => ({ ...p, atividadesPrincipais: e.target.value }))} placeholder="Descreva suas atividades hoje..." rows={4} />
        </div>

        <div className="form-section">
          <Label>Ferramentas usadas hoje</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {FERRAMENTAS.map(f => (
              <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.ferramentas.includes(f)} onCheckedChange={() => toggleTool(f)} />
                {f}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div>
            <Label>Tempo médio por atividade</Label>
            <Input value={form.tempoMedioPorAtividade} onChange={e => setForm(p => ({ ...p, tempoMedioPorAtividade: e.target.value }))} placeholder="Ex: 2h relatórios, 1h reuniões" />
          </div>
          <div>
            <Label>O que mais consumiu tempo?</Label>
            <Input value={form.maiorConsumoTempo} onChange={e => setForm(p => ({ ...p, maiorConsumoTempo: e.target.value }))} placeholder="Descreva brevemente" />
          </div>
          <div>
            <Label>O que impediu você de ser mais rápido?</Label>
            <Input value={form.impedimentos} onChange={e => setForm(p => ({ ...p, impedimentos: e.target.value }))} placeholder="Descreva brevemente" />
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={filled < 4 || saving}>
          {saving ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </AppLayout>
  );
}
