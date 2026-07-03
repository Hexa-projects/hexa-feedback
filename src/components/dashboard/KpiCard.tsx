import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { STATUS_COLORS } from "@/lib/kpi-definitions";
import { computeTrend, formatKpiValue } from "@/lib/kpi-utils";

interface Props {
  kpi: KpiDefinition;
  loading?: boolean;
  onClick?: (kpi: KpiDefinition) => void;
  compact?: boolean;
}

export function KpiCard({ kpi, loading, onClick, compact }: Props) {
  const trend = computeTrend(kpi.value, kpi.previousValue ?? null);
  const status = kpi.status || "neutral";
  const TrendIcon = trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  const trendPositive = trend.direction === "up";
  const trendColor = trend.direction === "flat" ? "text-muted-foreground" : trendPositive ? "text-emerald-600" : "text-red-600";

  return (
    <Card
      onClick={onClick ? () => onClick(kpi) : undefined}
      className={cn(
        "transition-all border",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/50",
        status === "critical" && "border-red-500/40",
        status === "attention" && "border-amber-500/40",
      )}
    >
      <CardContent className={cn("p-4 space-y-2", compact && "p-3 space-y-1")}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{kpi.label}</p>
          {kpi.description && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p>{kpi.description}</p>
                  {kpi.sourceTables?.length ? <p className="mt-1 opacity-70">Fonte: {kpi.sourceTables.join(", ")}</p> : null}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-baseline gap-2">
            <p className={cn("text-2xl font-bold tabular-nums", STATUS_COLORS[status])}>
              {formatKpiValue(kpi.value, kpi.format)}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-xs">
          {loading ? (
            <Skeleton className="h-3 w-16" />
          ) : trend.deltaPct !== null ? (
            <span className={cn("inline-flex items-center gap-1", trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {(trend.deltaPct * 100).toFixed(1).replace(".", ",")}%
              <span className="text-muted-foreground">vs período anterior</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem base de comparação</span>
          )}
          {kpi.target !== undefined && !loading && (
            <span className="text-muted-foreground">Meta: {formatKpiValue(kpi.target, kpi.format)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
