import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import AudioRecorder from "@/components/AudioRecorder";
import { Cog, Repeat, Users, Wrench } from "lucide-react";

interface Props {
  form: Record<string, any>;
  update: (key: string, val: string) => void;
}

export default function StepProcessos({ form, update }: Props) {
  const append = (key: string, text: string) => {
    update(key, form[key] ? form[key] + "\n" + text : text);
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Cog className="w-5 h-5 text-primary" /> Processos & Ferramentas
        </h2>
        <p className="text-sm text-muted-foreground">Nos ajude a mapear o que você usa e o que pode ser otimizado pela IA.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Ferramentas que você usa todos os dias</Label>
          <Textarea value={form.ferramentas_criticas} onChange={e => update("ferramentas_criticas", e.target.value)} placeholder="Ex: Excel de OS, ERP Totvs, WhatsApp do setor, planilha de controle..." rows={3} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("ferramentas_criticas", t)} />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" /> Tarefas repetitivas que faz toda semana</Label>
          <Textarea value={form.tarefas_repetitivas} onChange={e => update("tarefas_repetitivas", e.target.value)} placeholder="Ex: preencher planilha de faturamento, conferir estoque, enviar relatório semanal..." rows={3} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("tarefas_repetitivas", t)} />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> De quem você depende pra trabalhar?</Label>
          <Textarea value={form.decisores} onChange={e => update("decisores", e.target.value)} placeholder="Ex: Gestor direto, setor financeiro pra liberar compras, TI pra ajustar sistema..." rows={2} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("decisores", t)} />
        </div>

        <div className="space-y-1.5">
          <Label>Quanto tempo por semana gasta em tarefas manuais/repetitivas?</Label>
          <Input value={form.tempo_tarefas_manuais} onChange={e => update("tempo_tarefas_manuais", e.target.value)} placeholder="Ex: umas 8 horas por semana" />
        </div>
      </div>
    </div>
  );
}
