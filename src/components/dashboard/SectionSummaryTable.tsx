import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { formatKpiValue, type KpiFormat } from "@/lib/kpi-utils";
import { cn } from "@/lib/utils";
import type { KpiStatus } from "@/lib/kpi-utils";

export interface SectionSummary {
  domain: string;
  label: string;
  route: string;
  metrics: Array<{ label: string; value: number; format?: KpiFormat; status?: KpiStatus }>;
}

interface Props {
  title?: string;
  sections: SectionSummary[];
}

const STATUS_TEXT: Record<KpiStatus, string> = {
  healthy: "text-emerald-600",
  attention: "text-amber-600",
  critical: "text-red-600",
  neutral: "",
};

export function SectionSummaryTable({ title = "Resumo por setor", sections }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Setor</TableHead>
                <TableHead className="text-xs">Indicadores</TableHead>
                <TableHead className="text-xs w-24 text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map(s => (
                <TableRow key={s.domain}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      {s.metrics.map(m => (
                        <span key={m.label} className="text-xs">
                          <span className="text-muted-foreground">{m.label}: </span>
                          <span className={cn("font-semibold", m.status && STATUS_TEXT[m.status])}>
                            {formatKpiValue(m.value, m.format || "number")}
                          </span>
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={s.route} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Abrir <ArrowRight className="w-3 h-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
