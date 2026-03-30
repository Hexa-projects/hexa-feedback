import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import AudioRecorder from "@/components/AudioRecorder";
import { AlertTriangle, Star, TrendingDown } from "lucide-react";

interface Props {
  form: Record<string, any>;
  update: (key: string, val: string) => void;
}

export default function StepGargalos({ form, update }: Props) {
  const append = (key: string, text: string) => {
    update(key, form[key] ? form[key] + "\n" + text : text);
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" /> Gargalos & Potencial
        </h2>
        <p className="text-sm text-muted-foreground">Identifique o que trava seu trabalho e onde você brilha.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Principal gargalo na sua área</Label>
          <Textarea value={form.principal_gargalo} onChange={e => update("principal_gargalo", e.target.value)} placeholder="O que mais trava ou atrasa o trabalho do seu setor?" rows={3} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("principal_gargalo", t)} />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Pontos que gostaria de melhorar</Label>
          <Textarea value={form.pontos_melhoria} onChange={e => update("pontos_melhoria", e.target.value)} placeholder="O que poderia ser diferente no seu dia a dia?" rows={2} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("pontos_melhoria", t)} />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Suas qualidades principais</Label>
          <Textarea value={form.qualidades} onChange={e => update("qualidades", e.target.value)} placeholder="O que você faz de melhor no trabalho?" rows={2} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("qualidades", t)} />
        </div>

        <div className="space-y-1.5">
          <Label>Se pudesse mudar uma coisa no setor, o que seria?</Label>
          <Textarea value={form.mudaria_no_setor} onChange={e => update("mudaria_no_setor", e.target.value)} placeholder="Pense grande: processo, ferramenta, comunicação..." rows={2} />
          <AudioRecorder label="Descrever por áudio" onTranscription={t => append("mudaria_no_setor", t)} />
        </div>
      </div>
    </div>
  );
}
