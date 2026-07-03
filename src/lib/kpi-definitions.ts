import type { KpiFormat, KpiStatus } from "./kpi-utils";

export type KpiDomain =
  | "executive"
  | "commercial"
  | "finance"
  | "operations"
  | "quality"
  | "stock"
  | "lab"
  | "projects"
  | "people";

export interface KpiDefinition {
  key: string;
  label: string;
  description?: string;
  value: number;
  previousValue?: number | null;
  format: KpiFormat;
  domain: KpiDomain;
  sourceTables: string[];
  status?: KpiStatus;
  target?: number;
  /** Optional records that compose the KPI for drill-down. */
  drilldownRecords?: Array<Record<string, unknown>>;
  /** Optional route for the drill-down. */
  drilldownRoute?: string;
}

export const STATUS_COLORS: Record<KpiStatus, string> = {
  healthy: "text-emerald-600",
  attention: "text-amber-600",
  critical: "text-red-600",
  neutral: "text-muted-foreground",
};

export const STATUS_BG: Record<KpiStatus, string> = {
  healthy: "bg-emerald-500/10 border-emerald-500/30",
  attention: "bg-amber-500/10 border-amber-500/30",
  critical: "bg-red-500/10 border-red-500/30",
  neutral: "bg-muted/40 border-border",
};
