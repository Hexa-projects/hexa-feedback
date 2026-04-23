import { Badge } from "@/components/ui/badge";
import { Cog, ArrowRight, AlertTriangle, Repeat } from "lucide-react";

interface Props {
  process: {
    process_name: string;
    process_category?: string | null;
    objective?: string | null;
    frequency?: string | null;
    inputs_json?: any;
    outputs_json?: any;
    risks_json?: any;
  };
}

export default function OnboardingProcessCard({ process }: Props) {
  const inputs = Array.isArray(process.inputs_json) ? process.inputs_json : [];
  const outputs = Array.isArray(process.outputs_json) ? process.outputs_json : [];
  const risks = Array.isArray(process.risks_json) ? process.risks_json : [];

  return (
    <div className="group rounded-2xl border border-border/60 bg-gradient-to-br from-background to-muted/20 p-3.5 space-y-3 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all">
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Cog className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{process.process_name}</p>
          {process.objective && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {process.objective}
            </p>
          )}
        </div>
      </div>

      {(process.process_category || process.frequency) && (
        <div className="flex flex-wrap gap-1.5">
          {process.process_category && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 capitalize font-medium">
              {process.process_category}
            </Badge>
          )}
          {process.frequency && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 gap-1">
              <Repeat className="w-2.5 h-2.5" />
              {process.frequency}
            </Badge>
          )}
        </div>
      )}

      {(inputs.length > 0 || outputs.length > 0 || risks.length > 0) && (
        <div className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-border/50">
          <div className="rounded-lg bg-muted/40 p-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
              In
            </p>
            <p className="text-sm font-bold tabular-nums text-foreground">{inputs.length}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-1.5 text-center flex flex-col items-center">
            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
            <p className="text-sm font-bold tabular-nums text-foreground">{outputs.length}</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-1.5 text-center">
            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 mx-auto" />
            <p className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {risks.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
