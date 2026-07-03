import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Filter, RotateCcw } from "lucide-react";
import { SETORES } from "@/types/forms";
import type { DashboardFilters as Filters, PresetKey } from "@/hooks/dashboard/useDashboardFilters";

interface Props {
  filters: Filters;
  onPresetChange: (p: PresetKey) => void;
  onSetorChange: (s: string) => void;
  onClienteChange: (c: string) => void;
  onReset: () => void;
  compact?: boolean;
}

const PRESETS: Array<{ v: PresetKey; l: string }> = [
  { v: "today", l: "Hoje" },
  { v: "7d", l: "7 dias" },
  { v: "30d", l: "30 dias" },
  { v: "mtd", l: "Mês atual" },
  { v: "qtd", l: "Trimestre" },
  { v: "ytd", l: "Ano" },
];

function Inline({ filters, onPresetChange, onSetorChange, onClienteChange, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={filters.preset} onValueChange={(v) => onPresetChange(v as PresetKey)}>
        <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{PRESETS.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.setor} onValueChange={onSetorChange}>
        <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Setor" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Todos">Todos os setores</SelectItem>
          {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        placeholder="Cliente contém..."
        value={filters.cliente}
        onChange={(e) => onClienteChange(e.target.value)}
        className="h-9 w-[180px]"
      />
      <Button variant="ghost" size="sm" onClick={onReset} className="h-9 gap-1"><RotateCcw className="w-3.5 h-3.5" /> Limpar</Button>
    </div>
  );
}

export function DashboardFilters(props: Props) {
  return (
    <>
      <div className="hidden md:block">
        <Inline {...props} />
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2"><Filter className="w-4 h-4" /> Filtros</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh]">
            <SheetHeader><SheetTitle>Filtros do dashboard</SheetTitle></SheetHeader>
            <div className="mt-4 flex flex-col gap-3">
              <Inline {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
