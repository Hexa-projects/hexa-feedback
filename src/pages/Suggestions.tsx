import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase-store";
import { SETORES, BENEFICIOS, ESFORCOS } from "@/types/forms";
import AppLayout from "@/components/AppLayout";
import FormProgress from "@/components/FormProgress";
import SuccessMessage from "@/components/SuccessMessage";
import AILapidacao from "@/components/AILapidacao";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import AudioRecorder from "@/components/AudioRecorder";

export default function Suggestions() {
  const { user, profile } = useAuth();
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showLapidacao, setShowLapidacao] = useState(false);
  const [form, setForm] = useState({
    ideia: "",
    setorImpactado: profile?.setor || "Administrativo",
    beneficio: "Tempo",
    esforco: "Médio",
  });

  const filled = [form.ideia].filter(v => v.trim()).length + 2;

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const id = await db.saveSuggestion({
        user_id: user.id,
        ideia: form.ideia,
        setor_impactado: form.setorImpactado,
        beneficio: form.beneficio,
        esforco: form.esforco,
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
        await db.updateLapidacao("suggestions", savedId, perguntas, respostas);
      } catch (err: any) {
        toast.error("Erro ao salvar lapidação: " + err.message);
      }
    }
    setSent(true);
  };

  const skipLapidacao = () => setSent(true);

  const reset = () => {
    setForm({ ideia: "", setorImpactado: profile?.setor || "Administrativo", beneficio: "Tempo", esforco: "Médio" });
    setSent(false);
    setSavedId(null);
    setShowLapidacao(false);
  };

  if (sent) return <AppLayout><SuccessMessage onNew={reset} /></AppLayout>;

  if (showLapidacao) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-slide-up">
          <div>
            <h1 className="text-2xl font-bold">Aprofundamento — Sugestão</h1>
            <p className="text-sm text-muted-foreground mt-1">A IA vai gerar perguntas para aprofundar sua ideia.</p>
          </div>
          <AILapidacao
            tipo="sugestao"
            conteudo={form.ideia}
            contexto={`Setor: ${form.setorImpactado}. Benefício: ${form.beneficio}. Esforço: ${form.esforco}`}
            onComplete={handleLapidacaoComplete}
          />
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={skipLapidacao}>
            Pular lapidação
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Sugestões e Melhorias</h1>
          <p className="text-sm text-muted-foreground mt-1">Compartilhe suas ideias para melhorar a empresa.</p>
        </div>
        <FormProgress current={filled} total={4} />

        <div className="form-section">
          <div>
            <Label>Ideia de melhoria</Label>
            <Textarea value={form.ideia} onChange={e => setForm(p => ({ ...p, ideia: e.target.value }))} placeholder="Descreva sua ideia..." rows={5} />
            <AudioRecorder label="Descrever por áudio" onTranscription={(text) => setForm(p => ({ ...p, ideia: p.ideia ? p.ideia + "\n" + text : text }))} />
          </div>
        </div>

        <div className="form-section">
          <div>
            <Label>Setor impactado</Label>
            <Select value={form.setorImpactado} onValueChange={v => setForm(p => ({ ...p, setorImpactado: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Benefício esperado</Label>
              <Select value={form.beneficio} onValueChange={v => setForm(p => ({ ...p, beneficio: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BENEFICIOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Esforço estimado</Label>
              <Select value={form.esforco} onValueChange={v => setForm(p => ({ ...p, esforco: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESFORCOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!form.ideia.trim() || saving}>
          {saving ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </AppLayout>
  );
}
