import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "intro", label: "Apresentação" },
  { id: "perfil", label: "Perfil" },
  { id: "rotina", label: "Rotina" },
  { id: "processos", label: "Processos" },
  { id: "gargalos", label: "Gargalos" },
  { id: "revisao", label: "Revisão" },
  { id: "completo", label: "Concluído" },
];

interface Props {
  currentStage: string;
  progress: number;
  missingFields?: string[];
}

export default function OnboardingProgressRail({ currentStage, progress, missingFields = [] }: Props) {
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-6">
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progresso</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">{Math.round(progress)}%</p>
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        <div className="space-y-1.5 pt-2">
          {STAGES.map((stage, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-md transition-colors",
                  active && "bg-primary/10 text-primary font-medium",
                  done && "text-muted-foreground"
                )}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : active ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                )}
                <span>{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {missingFields.length > 0 && (
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Pendências
          </p>
          <ul className="space-y-1.5">
            {missingFields.slice(0, 6).map((f, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
