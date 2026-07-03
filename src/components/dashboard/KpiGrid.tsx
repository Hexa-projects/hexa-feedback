import { KpiCard } from "./KpiCard";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { cn } from "@/lib/utils";

interface Props {
  kpis: KpiDefinition[];
  loading?: boolean;
  onKpiClick?: (kpi: KpiDefinition) => void;
  columns?: 2 | 3 | 4 | 5 | 6;
  compact?: boolean;
}

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

export function KpiGrid({ kpis, loading, onKpiClick, columns = 4, compact }: Props) {
  return (
    <div className={cn("grid gap-3", GRID_COLS[columns])}>
      {kpis.map(k => (
        <KpiCard key={k.key} kpi={k} loading={loading} onClick={onKpiClick} compact={compact} />
      ))}
    </div>
  );
}
