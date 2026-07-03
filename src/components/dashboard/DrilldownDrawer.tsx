import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadFile, toCsv } from "@/lib/kpi-utils";
import type { KpiDefinition } from "@/lib/kpi-definitions";
import { useMemo, useState } from "react";

interface Props {
  kpi: KpiDefinition | null;
  onClose: () => void;
}

const PAGE_SIZE = 25;

export function DrilldownDrawer({ kpi, onClose }: Props) {
  const [page, setPage] = useState(0);
  const records = kpi?.drilldownRecords || [];
  const headers = useMemo(() => {
    if (!records.length) return [] as string[];
    return Array.from(records.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set<string>()));
  }, [records]);

  const pageStart = page * PAGE_SIZE;
  const pageRecords = records.slice(pageStart, pageStart + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));

  return (
    <Sheet open={!!kpi} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {kpi && (
          <>
            <SheetHeader>
              <SheetTitle>{kpi.label}</SheetTitle>
              <SheetDescription>
                {kpi.description || "Registros que compõem este indicador."}
                {kpi.sourceTables?.length ? <span className="block mt-1 opacity-70">Fonte: {kpi.sourceTables.join(", ")}</span> : null}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{records.length} registros</p>
              <Button size="sm" variant="outline" className="gap-1" disabled={!records.length}
                onClick={() => downloadFile(toCsv(records), `${kpi.key}-drilldown.csv`, "text/csv;charset=utf-8")}>
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
            </div>
            <div className="mt-3 border rounded-lg overflow-x-auto">
              {records.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Sem registros para exibir.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map(h => <TableHead key={h} className="text-xs uppercase">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRecords.map((r, i) => (
                      <TableRow key={i}>
                        {headers.map(h => (
                          <TableCell key={h} className="text-xs">
                            {typeof r[h] === "object" && r[h] !== null ? JSON.stringify(r[h]) : String(r[h] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {records.length > PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-between">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
