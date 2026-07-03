import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileJson, FileSpreadsheet, CameraIcon } from "lucide-react";
import { downloadFile, toCsv } from "@/lib/kpi-utils";
import type { KpiDefinition } from "@/lib/kpi-definitions";

interface Props {
  kpis: KpiDefinition[];
  filename?: string;
  onSnapshot?: () => void;
  snapshotting?: boolean;
}

export function ExportMenu({ kpis, filename = "hexaos-bi", onSnapshot, snapshotting }: Props) {
  const rows = kpis.map(k => ({
    key: k.key,
    label: k.label,
    domain: k.domain,
    value: k.value,
    previousValue: k.previousValue ?? "",
    format: k.format,
    status: k.status ?? "",
    target: k.target ?? "",
  }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Download className="w-4 h-4" /> Exportar</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => downloadFile(toCsv(rows), `${filename}.csv`, "text/csv;charset=utf-8")}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadFile(JSON.stringify(kpis, null, 2), `${filename}.json`, "application/json")}>
          <FileJson className="w-4 h-4 mr-2" /> JSON
        </DropdownMenuItem>
        {onSnapshot && (
          <DropdownMenuItem disabled={snapshotting} onClick={onSnapshot}>
            <CameraIcon className="w-4 h-4 mr-2" /> {snapshotting ? "Salvando..." : "Snapshot executivo"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
