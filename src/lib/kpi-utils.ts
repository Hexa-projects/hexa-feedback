// KPI formatting and computation helpers
export type KpiFormat = "number" | "currency" | "percent" | "duration";
export type KpiStatus = "healthy" | "attention" | "critical" | "neutral";

export function formatKpiValue(value: number | null | undefined, format: KpiFormat = "number"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
    case "percent":
      return `${(value * (Math.abs(value) <= 1 ? 100 : 1)).toFixed(1).replace(".", ",")}%`;
    case "duration": {
      const mins = Math.max(0, Math.round(value));
      if (mins < 60) return `${mins} min`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
      const d = Math.floor(h / 24);
      const rh = h % 24;
      return rh ? `${d}d ${rh}h` : `${d}d`;
    }
    default:
      return new Intl.NumberFormat("pt-BR").format(value);
  }
}

export function computeTrend(current: number, previous: number | null | undefined): { delta: number; deltaPct: number | null; direction: "up" | "down" | "flat" } {
  if (previous === null || previous === undefined || previous === 0) {
    return { delta: current, deltaPct: null, direction: current > 0 ? "up" : current < 0 ? "down" : "flat" };
  }
  const delta = current - previous;
  const deltaPct = delta / Math.abs(previous);
  return { delta, deltaPct, direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat" };
}

export interface DateRange {
  start: string; // ISO
  end: string;   // ISO (exclusive)
  label: string;
}

export function getRangeForPreset(preset: "today" | "7d" | "30d" | "mtd" | "qtd" | "ytd" | "prev_month"): DateRange {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  switch (preset) {
    case "today":
      return { start: start.toISOString(), end: end.toISOString(), label: "Hoje" };
    case "7d":
      start.setDate(start.getDate() - 6);
      return { start: start.toISOString(), end: end.toISOString(), label: "Últimos 7 dias" };
    case "30d":
      start.setDate(start.getDate() - 29);
      return { start: start.toISOString(), end: end.toISOString(), label: "Últimos 30 dias" };
    case "mtd":
      start.setDate(1);
      return { start: start.toISOString(), end: end.toISOString(), label: "Mês até hoje" };
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      const s = new Date(now.getFullYear(), q, 1);
      return { start: s.toISOString(), end: end.toISOString(), label: "Trimestre até hoje" };
    }
    case "ytd": {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: s.toISOString(), end: end.toISOString(), label: "Ano até hoje" };
    }
    case "prev_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: s.toISOString(), end: e.toISOString(), label: "Mês anterior" };
    }
  }
}

export function getPreviousRange(range: DateRange): DateRange {
  const s = new Date(range.start);
  const e = new Date(range.end);
  const durMs = e.getTime() - s.getTime();
  const prevEnd = new Date(s.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durMs);
  return { start: prevStart.toISOString(), end: prevEnd.toISOString(), label: `Período anterior` };
}

export function statusFromThreshold(value: number, opts: { warn?: number; critical?: number; inverse?: boolean }): KpiStatus {
  const { warn, critical, inverse } = opts;
  if (critical !== undefined) {
    if ((!inverse && value >= critical) || (inverse && value <= critical)) return "critical";
  }
  if (warn !== undefined) {
    if ((!inverse && value >= warn) || (inverse && value <= warn)) return "attention";
  }
  return "healthy";
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set<string>()));
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

export function downloadFile(content: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
