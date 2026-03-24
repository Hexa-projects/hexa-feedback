import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase-store";
import { SETORES, FREQUENCIAS } from "@/types/forms";
import HexaLayout from "@/components/HexaLayout";
import FormProgress from "@/components/FormProgress";
import SuccessMessage from "@/components/SuccessMessage";
import AILapidacao from "@/components/AILapidacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import AudioRecorder from "@/components/AudioRecorder";

export default function RepetitiveProcesses() {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showLapidacao, setShowLapidacao] = useState(false);
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

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const id = await db.saveProcess({
        user_id: user.id,
        processo: form.processo,
        frequencia: form.frequencia,
        tempo_medio: form.tempoMedio,
        depende_outros: form.dependeOutros,
        setor_dependencia: form.setorDependencia || undefined,
        pode_automatizar: form.podeAutomatizar,
        como_automatizar: form.comoAutomatizar || undefined,
      });
      setSavedId(id);
      setShowLapidacao(true);
      toast.success("Enviado! Agora aprofunde com a IA.");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLapidacaoComplete = async (perguntas: string[], respostas: string[]) => {
    if (savedId) {
      try {
        await db.updateLapidacao("repetitive_processes", savedId, perguntas, respostas);
      } catch (err: any) {
        toast.error("Erro ao salvar lapidação: " + err.message);
      }
    }
    setSent(true);
  };

  const skipLapidacao = () => setSent(true);

  const reset = () => {
    setForm({ processo: "", frequencia: "Diário", tempoMedio: "", dependeOutros: false, setorDependencia: "", podeAutomatizar: false, comoAutomatizar: "" });
    setSent(false);
    setSavedId(null);
    setShowLapidacao(false);
  };

  if (sent) return <HexaLayout><SuccessMessage onNew={reset} /></HexaLayout>;

  if (showLapidacao) {
    return (
      <HexaLayout>
        <div className="space-y-6 animate-slide-up">
          <div>
            <h1 className="text-2xl font-bold">Aprofundamento — Processo</h1>
            <p className="text-sm text-muted-foreground mt-1">A IA vai gerar perguntas para entender melhor o processo.</p>
          </div>
          <AILapidacao
            tipo="processo"
            conteudo={form.processo}
            contexto={`Frequência: ${form.frequencia}. Tempo médio: ${form.tempoMedio}. Depende de outros: ${form.dependeOutros ? "Sim" : "Não"}. Pode automatizar: ${form.podeAutomatizar ? "Sim" : "Não"}`}
            onComplete={handleLapidacaoComplete}
          />
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={skipLapidacao}>
            Pular lapidação
          </Button>
        </div>
      </HexaLayout>
    );
  }

  return (
    <HexaLayout>
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

        <div className="form-section">
          <Label className="text-sm font-medium">Explicar por áudio</Label>
          <AudioRecorder label="Gravar explicação" onTranscription={(text) => setForm(p => ({ ...p, comoAutomatizar: p.comoAutomatizar ? p.comoAutomatizar + "\n" + text : text, podeAutomatizar: true }))} />
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!form.processo.trim() || saving}>
          {saving ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </HexaLayout>
  );
}
