import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase-store";
import { IMPACTOS, URGENCIAS } from "@/types/forms";
import AppLayout from "@/components/AppLayout";
import FormProgress from "@/components/FormProgress";
import SuccessMessage from "@/components/SuccessMessage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import AudioRecorder from "@/components/AudioRecorder";

const URGENCIA_COLORS: Record<string, string> = {
  "Baixa": "bg-hexa-green/10 text-hexa-green",
  "Média": "bg-hexa-yellow/10 text-hexa-yellow",
  "Alta": "bg-hexa-orange/10 text-hexa-orange",
  "Crítica": "bg-hexa-red/10 text-hexa-red",
};

export default function Bottlenecks() {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    descricao: "",
    impactos: [] as string[],
    exemploReal: "",
    urgencia: "Média",
    jaResolveu: false,
    comoResolveu: "",
  });

  const filled = [form.descricao, form.exemploReal].filter(v => v.trim()).length + (form.impactos.length > 0 ? 1 : 0) + 1;

  const toggleImpacto = (imp: string) => {
    setForm(p => ({
      ...p,
      impactos: p.impactos.includes(imp) ? p.impactos.filter(i => i !== imp) : [...p.impactos, imp],
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await db.saveBottleneck({
        user_id: user.id,
        descricao: form.descricao,
        impactos: form.impactos,
        exemplo_real: form.exemploReal,
        urgencia: form.urgencia,
        ja_resolveu: form.jaResolveu,
        como_resolveu: form.comoResolveu || undefined,
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
    setForm({ descricao: "", impactos: [], exemploReal: "", urgencia: "Média", jaResolveu: false, comoResolveu: "" });
    setSent(false);
  };

  if (sent) return <AppLayout><SuccessMessage onNew={reset} /></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Gargalos e Problemas</h1>
          <p className="text-sm text-muted-foreground mt-1">Reporte problemas que impactam seu trabalho.</p>
        </div>
        <FormProgress current={filled} total={4} />

        <div className="form-section">
          <div>
            <Label>Descreva o problema</Label>
            <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Explique o problema com detalhes..." rows={4} />
          </div>
        </div>

        <div className="form-section">
          <Label>Qual impacto gera?</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {IMPACTOS.map(imp => (
              <label key={imp} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.impactos.includes(imp)} onCheckedChange={() => toggleImpacto(imp)} />
                {imp}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div>
            <Label>Exemplo real</Label>
            <Textarea value={form.exemploReal} onChange={e => setForm(p => ({ ...p, exemploReal: e.target.value }))} placeholder="Conte uma situação concreta..." rows={3} />
          </div>
          <div>
            <Label>Nível de urgência</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {URGENCIAS.map(u => (
                <button key={u} onClick={() => setForm(p => ({ ...p, urgencia: u }))}
                  className={`hexa-badge border transition-all ${form.urgencia === u ? URGENCIA_COLORS[u] + " border-current" : "bg-secondary border-transparent"}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="flex items-center justify-between">
            <Label>Já tentou resolver?</Label>
            <Switch checked={form.jaResolveu} onCheckedChange={v => setForm(p => ({ ...p, jaResolveu: v }))} />
          </div>
          {form.jaResolveu && (
            <div>
              <Label>Como?</Label>
              <Textarea value={form.comoResolveu} onChange={e => setForm(p => ({ ...p, comoResolveu: e.target.value }))} placeholder="Descreva a tentativa..." rows={2} />
            </div>
          )}
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!form.descricao.trim() || saving}>
          {saving ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </AppLayout>
  );
}
