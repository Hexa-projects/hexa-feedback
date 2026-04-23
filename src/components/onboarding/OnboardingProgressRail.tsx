import { Check, Circle, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "intro", label: "Apresentação", hint: "Quem é você" },
  { id: "perfil", label: "Perfil", hint: "Setor & função" },
  { id: "rotina", label: "Rotina", hint: "Dia a dia" },
  { id: "processos", label: "Processos", hint: "Mapeamento ISO" },
  { id: "gargalos", label: "Gargalos", hint: "Pontos de dor" },
  { id: "revisao", label: "Revisão", hint: "Validação final" },
  { id: "completo", label: "Concluído", hint: "🎉" },
];

interface Props {
  currentStage: string;
  progress: number;
  missingFields?: string[];
}

export default function OnboardingProgressRail({ currentStage, progress, missingFields = [] }: Props) {
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage);
  const pct = Math.min(100, Math.max(0, progress));

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-4">
      {/* Progress hero */}
      <div className="relative rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/5 p-6 overflow-hidden shadow-lg shadow-primary/5">
        {/* decorative blur */}
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">
              Mapeamento
            </p>
          </div>

          {/* Circular-ish gradient progress */}
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-black tabular-nums bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent leading-none">
              {Math.round(pct)}
            </span>
            <span className="text-xl font-bold text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {pct < 100 ? "concluído da jornada" : "tudo pronto!"}
          </p>

          <div className="mt-4 h-2 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-primary/70 shadow-sm shadow-primary/40 transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stages */}
      <div className="rounded-3xl border border-border/50 bg-card p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-2 mb-3">
          Etapas
        </p>
        <ol className="space-y-0.5 relative">
          {/* connector line */}
          <span
            className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-primary/30 via-border to-border"
            aria-hidden
          />
          {STAGES.map((stage, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <li
                key={stage.id}
                className={cn(
                  "relative flex items-center gap-3 py-2 px-2 rounded-xl transition-all",
                  active && "bg-gradient-to-r from-primary/10 to-transparent"
                )}
              >
                <span
                  className={cn(
                    "relative z-10 flex items-center justify-center w-[22px] h-[22px] rounded-full shrink-0 border-2 transition-all",
                    done && "bg-primary border-primary text-primary-foreground",
                    active && "bg-card border-primary shadow-md shadow-primary/30",
                    !done && !active && "bg-card border-border"
                  )}
                >
                  {done ? (
                    <Check className="w-3 h-3" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                  ) : (
                    <Circle className="w-1.5 h-1.5 fill-muted-foreground/40 text-muted-foreground/40" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-[13px] font-semibold leading-tight",
                      active && "text-primary",
                      done && "text-muted-foreground line-through decoration-1",
                      !done && !active && "text-foreground/70"
                    )}
                  >
                    {stage.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">{stage.hint}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Pendências */}
      {missingFields.length > 0 && (
        <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
              Pendências
            </p>
          </div>
          <ul className="space-y-1.5">
            {missingFields.slice(0, 6).map((f, i) => (
              <li key={i} className="text-xs text-foreground/75 flex items-start gap-2">
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
