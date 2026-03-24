import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase-store";
import { SETORES, type Setor } from "@/types/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormProgress from "@/components/FormProgress";
import AudioRecorder from "@/components/AudioRecorder";
import { toast } from "sonner";

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, role, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    setor: profile?.setor || "Administrativo",
    funcao: profile?.funcao || "",
    unidade: profile?.unidade || "",
    resumo_dia_dia: profile?.resumo_dia_dia || "",
    responsabilidades: profile?.responsabilidades || "",
    qualidades: profile?.qualidades || "",
    pontos_melhoria: profile?.pontos_melhoria || "",
    tempo_casa: profile?.tempo_casa || "",
    decisores: (profile as any)?.decisores || "",
    ferramentas_criticas: (profile as any)?.ferramentas_criticas || "",
    principal_gargalo: (profile as any)?.principal_gargalo || "",
  });

  const fields = Object.values(form);
  const filled = fields.filter(v => v.trim()).length;

  const handleSubmit = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await db.updateProfile(profile.id, { ...form, onboarding_completo: true });
      await refreshProfile();
      toast.success("Perfil salvo com sucesso!");
      navigate("/home");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
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
              <Input value={form.tempo_casa} onChange={e => u("tempo_casa", e.target.value)} placeholder="Ex: 2 anos e 3 meses" />
            </div>
          </div>

          <div className="form-section">
           <div>
              <Label>Resumo do que você faz no dia a dia</Label>
              <Textarea value={form.resumo_dia_dia} onChange={e => u("resumo_dia_dia", e.target.value)} placeholder="Descreva brevemente suas atividades..." rows={3} />
              <AudioRecorder label="Descrever por áudio" onTranscription={(text) => u("resumo_dia_dia", form.resumo_dia_dia ? form.resumo_dia_dia + "\n" + text : text)} />
            </div>
            <div>
              <Label>Principais responsabilidades</Label>
              <Textarea value={form.responsabilidades} onChange={e => u("responsabilidades", e.target.value)} placeholder="Liste suas responsabilidades..." rows={3} />
              <AudioRecorder label="Descrever por áudio" onTranscription={(text) => u("responsabilidades", form.responsabilidades ? form.responsabilidades + "\n" + text : text)} />
            </div>
          </div>

          <div className="form-section">
            <div>
              <Label>Suas qualidades principais no trabalho</Label>
              <Textarea value={form.qualidades} onChange={e => u("qualidades", e.target.value)} placeholder="O que você faz de melhor..." rows={2} />
              <AudioRecorder label="Descrever por áudio" onTranscription={(text) => u("qualidades", form.qualidades ? form.qualidades + "\n" + text : text)} />
            </div>
            <div>
              <Label>Pontos que gostaria de melhorar</Label>
              <Textarea value={form.pontos_melhoria} onChange={e => u("pontos_melhoria", e.target.value)} placeholder="O que pode ser aprimorado..." rows={2} />
              <AudioRecorder label="Descrever por áudio" onTranscription={(text) => u("pontos_melhoria", form.pontos_melhoria ? form.pontos_melhoria + "\n" + text : text)} />
            </div>
          </div>

          <div className="form-section">
            <div>
              <Label>Quem participa das decisões na sua área? (gestor, pares, diretoria)</Label>
              <Textarea value={form.decisores} onChange={e => u("decisores", e.target.value)} placeholder="Ex: Meu gestor direto e o diretor técnico" rows={2} />
              <AudioRecorder label="Descrever por áudio" onTranscription={(text) => u("decisores", form.decisores ? form.decisores + "\n" + text : text)} />
            </div>
            <div>
              <Label>Ferramentas críticas que você usa todos os dias</Label>
              <Textarea value={form.ferramentas_criticas} onChange={e => u("ferramentas_criticas", e.target.value)} placeholder="Ex: Excel de OS, ERP Totvs, WhatsApp do setor..." rows={2} />
              <AudioRecorder label="Descrever por áudio" onTranscription={(text) => u("ferramentas_criticas", form.ferramentas_criticas ? form.ferramentas_criticas + "\n" + text : text)} />
            </div>
            <div>
              <Label>Principal gargalo que você percebe na sua área</Label>
              <Textarea value={form.principal_gargalo} onChange={e => u("principal_gargalo", e.target.value)} placeholder="O que mais trava ou atrasa o trabalho do seu setor?" rows={2} />
              <AudioRecorder label="Descrever por áudio" onTranscription={(text) => u("principal_gargalo", form.principal_gargalo ? form.principal_gargalo + "\n" + text : text)} />
            </div>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={filled < 7 || saving}>
          {saving ? "Salvando..." : "Salvar e continuar"}
        </Button>
      </div>
    </div>
  );
}
