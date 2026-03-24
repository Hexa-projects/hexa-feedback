import { useState } from "react";
import { store } from "@/lib/store";
import { SETORES, CATEGORIAS_FERRAMENTA, FINALIDADES_FERRAMENTA, FREQUENCIAS, SATISFACAO_LEVELS } from "@/types/forms";
import type { ToolMapping } from "@/types/forms";
import AppLayout from "@/components/AppLayout";
import FormProgress from "@/components/FormProgress";
import SuccessMessage from "@/components/SuccessMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

export default function ToolsMapping() {
  const user = store.getCurrentUser();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    nomeFerramentaOuPlanilha: "",
    categoria: "Planilha / Excel",
    finalidade: "Controle de dados",
    descricaoUso: "",
    frequenciaUso: "Diário",
    tempoGastoSemana: "",
    compartilhaCom: "",
    setoresEnvolvidos: [] as string[],
    problemas: "",
    satisfacao: "Regular",
    gostariaSubstituir: false,
    comoSeriaIdeal: "",
    criadoPorVoce: false,
    quantasPessoasUsam: "",
  });

  const required = [form.nomeFerramentaOuPlanilha, form.descricaoUso, form.tempoGastoSemana];
  const filled = required.filter(v => v.trim()).length + 3; // +3 for dropdowns with defaults

  const toggleSetor = (s: string) => {
    setForm(p => ({
      ...p,
      setoresEnvolvidos: p.setoresEnvolvidos.includes(s)
        ? p.setoresEnvolvidos.filter(x => x !== s)
        : [...p.setoresEnvolvidos, s],
    }));
  };

  const handleSubmit = () => {
    if (!user) return;
    const data: ToolMapping = {
      id: crypto.randomUUID(),
      userId: user.id,
      ...form,
      createdAt: new Date().toISOString(),
    };
    store.saveToolMapping(data);
    setSent(true);
  };

  const reset = () => {
    setForm({
      nomeFerramentaOuPlanilha: "", categoria: "Planilha / Excel", finalidade: "Controle de dados",
      descricaoUso: "", frequenciaUso: "Diário", tempoGastoSemana: "", compartilhaCom: "",
      setoresEnvolvidos: [], problemas: "", satisfacao: "Regular", gostariaSubstituir: false,
      comoSeriaIdeal: "", criadoPorVoce: false, quantasPessoasUsam: "",
    });
    setSent(false);
  };

  if (sent) return <AppLayout><SuccessMessage onNew={reset} /></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Mapeamento de Ferramentas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre cada planilha, sistema ou ferramenta que você usa no dia a dia. 
            Isso nos ajuda a entender o ecossistema atual e construir o HexaOS.
          </p>
        </div>
        <FormProgress current={filled} total={6} />

        <div className="form-section">
          <div>
            <Label>Nome da ferramenta / planilha / sistema</Label>
            <Input value={form.nomeFerramentaOuPlanilha} onChange={e => setForm(p => ({ ...p, nomeFerramentaOuPlanilha: e.target.value }))}
              placeholder='Ex: "Planilha de controle de OS", "ERP Totvs", "WhatsApp do setor"' />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS_FERRAMENTA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Finalidade principal</Label>
              <Select value={form.finalidade} onValueChange={v => setForm(p => ({ ...p, finalidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FINALIDADES_FERRAMENTA.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div>
            <Label>Como você usa? Descreva o passo a passo</Label>
            <Textarea value={form.descricaoUso} onChange={e => setForm(p => ({ ...p, descricaoUso: e.target.value }))}
              placeholder="Ex: Todo dia abro a planilha, copio os dados do ERP, filtro por data, gero o relatório e envio por e-mail para o gestor..." rows={4} />
          </div>
        </div>

        <div className="form-section">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Frequência de uso</Label>
              <Select value={form.frequenciaUso} onValueChange={v => setForm(p => ({ ...p, frequenciaUso: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tempo gasto por semana</Label>
              <Input value={form.tempoGastoSemana} onChange={e => setForm(p => ({ ...p, tempoGastoSemana: e.target.value }))}
                placeholder="Ex: 3 horas, 30 min/dia" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Quantas pessoas usam?</Label>
              <Input value={form.quantasPessoasUsam} onChange={e => setForm(p => ({ ...p, quantasPessoasUsam: e.target.value }))}
                placeholder="Ex: Só eu, 3 pessoas, todo o setor" />
            </div>
            <div>
              <Label>Compartilha com quem?</Label>
              <Input value={form.compartilhaCom} onChange={e => setForm(p => ({ ...p, compartilhaCom: e.target.value }))}
                placeholder="Ex: Gestor, equipe comercial" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <Label>Setores envolvidos no uso</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {SETORES.map(s => (
              <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.setoresEnvolvidos.includes(s)} onCheckedChange={() => toggleSetor(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div>
            <Label>Problemas / dificuldades com essa ferramenta</Label>
            <Textarea value={form.problemas} onChange={e => setForm(p => ({ ...p, problemas: e.target.value }))}
              placeholder="Ex: Demora para abrir, perde dados, não integra com outros sistemas, preciso copiar manualmente..." rows={3} />
          </div>
          <div>
            <Label>Nível de satisfação</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {SATISFACAO_LEVELS.map(s => (
                <button key={s} onClick={() => setForm(p => ({ ...p, satisfacao: s }))}
                  className={`hexa-badge border transition-all ${
                    form.satisfacao === s
                      ? s === "Péssimo" || s === "Ruim" ? "bg-destructive/10 text-destructive border-current"
                        : s === "Regular" ? "bg-accent text-accent-foreground border-current"
                        : "bg-primary/10 text-primary border-current"
                      : "bg-secondary border-transparent"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="flex items-center justify-between">
            <Label>Foi você quem criou essa ferramenta/planilha?</Label>
            <Switch checked={form.criadoPorVoce} onCheckedChange={v => setForm(p => ({ ...p, criadoPorVoce: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Gostaria que fosse substituída por algo melhor?</Label>
            <Switch checked={form.gostariaSubstituir} onCheckedChange={v => setForm(p => ({ ...p, gostariaSubstituir: v }))} />
          </div>
          {form.gostariaSubstituir && (
            <div>
              <Label>Como seria a ferramenta ideal?</Label>
              <Textarea value={form.comoSeriaIdeal} onChange={e => setForm(p => ({ ...p, comoSeriaIdeal: e.target.value }))}
                placeholder="Descreva como deveria funcionar no sistema ideal..." rows={3} />
            </div>
          )}
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!form.nomeFerramentaOuPlanilha.trim() || !form.descricaoUso.trim()}>
          Cadastrar Ferramenta
        </Button>
      </div>
    </AppLayout>
  );
}
