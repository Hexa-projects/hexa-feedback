import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import AudioRecorder from "@/components/AudioRecorder";
import { CalendarClock, ListChecks } from "lucide-react";

interface Props {
  form: Record<string, any>;
  update: (key: string, val: string) => void;
}

export default function StepRotina({ form, update }: Props) {
  const append = (key: string, text: string) => {
    update(key, form[key] ? form[key] + "\n" + text : text);
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" /> Sua Rotina de Trabalho
        </h2>
        <p className="text-sm text-muted-foreground">Descreva o que faz no dia a dia e suas responsabilidades. Pode digitar ou falar!</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>O que você faz no dia a dia?</Label>
          <Textarea value={form.resumo_dia_dia} onChange={e => update("resumo_dia_dia", e.target.value)} placeholder="Descreva suas atividades principais: reuniões, relatórios, atendimentos..." rows={3} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("resumo_dia_dia", t)} />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" /> Principais responsabilidades</Label>
          <Textarea value={form.responsabilidades} onChange={e => update("responsabilidades", e.target.value)} placeholder="Liste o que depende diretamente de você..." rows={3} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("responsabilidades", t)} />
        </div>
      </div>
    </div>
  );
}
