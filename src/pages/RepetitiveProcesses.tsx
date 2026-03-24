import { useState } from "react";
import { store } from "@/lib/store";
import { SETORES, FREQUENCIAS } from "@/types/forms";
import type { RepetitiveProcess } from "@/types/forms";
import AppLayout from "@/components/AppLayout";
import FormProgress from "@/components/FormProgress";
import SuccessMessage from "@/components/SuccessMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function RepetitiveProcesses() {
  const user = store.getCurrentUser();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    processo: "",
    frequencia: "Diário",
    tempoMedio: "",
    dependeOutros: false,
    setorDependencia: "",
    podeAutomatizar: false,
    comoAutomatizar: "",
  });

  const filled = [form.processo, form.tempoMedio].filter(v => v.trim()).length + 1;

  const handleSubmit = () => {
    if (!user) return;
    const data: RepetitiveProcess = {
      id: crypto.randomUUID(),
      userId: user.id,
      ...form,
      createdAt: new Date().toISOString(),
    };
    store.saveProcess(data);
    setSent(true);
  };

  const reset = () => {
    setForm({ processo: "", frequencia: "Diário", tempoMedio: "", dependeOutros: false, setorDependencia: "", podeAutomatizar: false, comoAutomatizar: "" });
    setSent(false);
  };

  if (sent) return <AppLayout><SuccessMessage onNew={reset} /></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Processos Repetitivos</h1>
          <p className="text-sm text-muted-foreground mt-1">Identifique processos que poderiam ser automatizados.</p>
        </div>
        <FormProgress current={filled} total={3} />

        <div className="form-section">
          <div>
            <Label>Processo repetitivo</Label>
            <Input value={form.processo} onChange={e => setForm(p => ({ ...p, processo: e.target.value }))} placeholder="Ex: Gerar relatório de vendas" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Frequência</Label>
              <Select value={form.frequencia} onValueChange={v => setForm(p => ({ ...p, frequencia: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tempo médio por ocorrência</Label>
              <Input value={form.tempoMedio} onChange={e => setForm(p => ({ ...p, tempoMedio: e.target.value }))} placeholder="Ex: 30min" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="flex items-center justify-between">
            <Label>Depende de outras pessoas?</Label>
            <Switch checked={form.dependeOutros} onCheckedChange={v => setForm(p => ({ ...p, dependeOutros: v }))} />
          </div>
          {form.dependeOutros && (
            <div>
              <Label>Qual setor?</Label>
              <Select value={form.setorDependencia} onValueChange={v => setForm(p => ({ ...p, setorDependencia: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="flex items-center justify-between">
            <Label>Poderia ser automatizado?</Label>
            <Switch checked={form.podeAutomatizar} onCheckedChange={v => setForm(p => ({ ...p, podeAutomatizar: v }))} />
          </div>
          {form.podeAutomatizar && (
            <div>
              <Label>Como seria o ideal?</Label>
              <Textarea value={form.comoAutomatizar} onChange={e => setForm(p => ({ ...p, comoAutomatizar: e.target.value }))} placeholder="Descreva como poderia funcionar..." rows={3} />
            </div>
          )}
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!form.processo.trim()}>
          Enviar
        </Button>
      </div>
    </AppLayout>
  );
}
