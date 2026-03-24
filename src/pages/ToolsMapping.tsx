import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase-store";
import { SETORES, CATEGORIAS_FERRAMENTA, FINALIDADES_FERRAMENTA, FREQUENCIAS, SATISFACAO_LEVELS } from "@/types/forms";
import HexaLayout from "@/components/HexaLayout";
import FormProgress from "@/components/FormProgress";
import SuccessMessage from "@/components/SuccessMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import AudioRecorder from "@/components/AudioRecorder";

export default function ToolsMapping() {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const filled = required.filter(v => v.trim()).length + 3;

  const toggleSetor = (s: string) => {
    setForm(p => ({
      ...p,
      setoresEnvolvidos: p.setoresEnvolvidos.includes(s)
        ? p.setoresEnvolvidos.filter(x => x !== s)
        : [...p.setoresEnvolvidos, s],
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await db.saveToolMapping({
        user_id: user.id,
        nome_ferramenta: form.nomeFerramentaOuPlanilha,
        categoria: form.categoria,
        finalidade: form.finalidade,
        descricao_uso: form.descricaoUso,
        frequencia_uso: form.frequenciaUso,
        tempo_gasto_semana: form.tempoGastoSemana,
        compartilha_com: form.compartilhaCom,
        setores_envolvidos: form.setoresEnvolvidos,
        problemas: form.problemas,
        satisfacao: form.satisfacao,
        gostaria_substituir: form.gostariaSubstituir,
        como_seria_ideal: form.comoSeriaIdeal || undefined,
        criado_por_voce: form.criadoPorVoce,
        quantas_pessoas_usam: form.quantasPessoasUsam,
      });
      setSent(true);
      toast.success("Ferramenta cadastrada!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSaving(false);
    }
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

  if (sent) return <HexaLayout><SuccessMessage onNew={reset} /></HexaLayout>;

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Mapeamento de Ferramentas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre cada planilha, sistema ou ferramenta que você usa no dia a dia.
          </p>
        </div>
        <FormProgress current={filled} total={6} />

        <div className="form-section">
          <div>
            <Label>Nome da ferramenta / planilha / sistema</Label>
            <Input value={form.nomeFerramentaOuPlanilha} onChange={e => setForm(p => ({ ...p, nomeFerramentaOuPlanilha: e.target.value }))}
              placeholder='Ex: "Planilha de controle de OS", "ERP Totvs"' />
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
              placeholder="Ex: Todo dia abro a planilha, copio os dados do ERP..." rows={4} />
            <AudioRecorder
              label="Descrever por áudio"
              onTranscription={(text) => setForm(p => ({ ...p, descricaoUso: p.descricaoUso ? p.descricaoUso + "\n" + text : text }))}
            />
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
              placeholder="Ex: Demora para abrir, perde dados..." rows={3} />
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

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!form.nomeFerramentaOuPlanilha.trim() || !form.descricaoUso.trim() || saving}>
          {saving ? "Cadastrando..." : "Cadastrar Ferramenta"}
        </Button>
      </div>
    </HexaLayout>
  );
}
