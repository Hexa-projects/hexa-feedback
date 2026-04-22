import { Badge } from "@/components/ui/badge";
import { Cog } from "lucide-react";

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
    <div className="rounded-xl border bg-background p-3.5 space-y-2.5">
      <div className="flex items-start gap-2">
        <Cog className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{process.process_name}</p>
          {process.objective && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{process.objective}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {process.process_category && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
            {process.process_category}
          </Badge>
        )}
        {process.frequency && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {process.frequency}
          </Badge>
        )}
      </div>

      {(inputs.length > 0 || outputs.length > 0 || risks.length > 0) && (
        <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground pt-1 border-t">
          <div>
            <p className="font-medium uppercase tracking-wider">Entradas</p>
            <p className="tabular-nums text-foreground">{inputs.length}</p>
          </div>
          <div>
            <p className="font-medium uppercase tracking-wider">Saídas</p>
            <p className="tabular-nums text-foreground">{outputs.length}</p>
          </div>
          <div>
            <p className="font-medium uppercase tracking-wider">Riscos</p>
            <p className="tabular-nums text-foreground">{risks.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
