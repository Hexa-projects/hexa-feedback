import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OwnerOption {
  id: string;
  name: string;
  email?: string | null;
}

export type OwnerQuick = "all" | "mine";

interface Props {
  owners: OwnerOption[];
  quick: OwnerQuick;
  selectedOwners: string[];
  onChange: (quick: OwnerQuick, selectedOwners: string[]) => void;
  allLabel: string;
  mineLabel: string;
  triggerClassName?: string;
}

export default function OwnerFilterPopover({
  owners,
  quick,
  selectedOwners,
  onChange,
  allLabel,
  mineLabel,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftQuick, setDraftQuick] = useState<OwnerQuick>(quick);
  const [draftOwners, setDraftOwners] = useState<string[]>(selectedOwners);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setDraftQuick(quick);
      setDraftOwners(selectedOwners);
      setSearch("");
    }
  }, [open, quick, selectedOwners]);

  const ownersById = useMemo(() => {
    const m = new Map<string, OwnerOption>();
    owners.forEach(o => m.set(o.id, o));
    return m;
  }, [owners]);

  const filteredOwners = useMemo(() => {
    if (!search.trim()) return owners;
    const q = search.trim().toLowerCase();
    return owners.filter(o =>
      (o.name || "").toLowerCase().includes(q) ||
      (o.email || "").toLowerCase().includes(q),
    );
  }, [owners, search]);

  const toggleOwner = (id: string, checked: boolean) => {
    setDraftOwners(prev =>
      checked ? [...prev, id] : prev.filter(x => x !== id),
    );
    setDraftQuick("all");
  };

  const handleClear = () => {
    setDraftQuick("all");
    setDraftOwners([]);
    setSearch("");
  };

  const handleApply = () => {
    onChange(draftQuick, draftQuick === "mine" ? [] : draftOwners);
    setOpen(false);
  };

  const triggerLabel =
    quick === "mine"
      ? mineLabel
      : selectedOwners.length === 0
        ? allLabel
        : selectedOwners.length === 1
          ? ownersById.get(selectedOwners[0])?.name || "1 responsável"
          : `${selectedOwners.length} responsáveis`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2 min-w-[200px] justify-between h-9", triggerClassName)}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar"
              className="pl-8 h-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="py-1">
          <button
            type="button"
            onClick={() => {
              setDraftQuick("all");
              setDraftOwners([]);
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
              draftQuick === "all" && draftOwners.length === 0
                ? "text-primary font-medium bg-primary/5"
                : "text-foreground",
            )}
          >
            {allLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftQuick("mine");
              setDraftOwners([]);
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
              draftQuick === "mine"
                ? "text-primary font-medium bg-primary/5"
                : "text-foreground",
            )}
          >
            {mineLabel}
          </button>
        </div>

        <div className="border-t">
          <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Responsáveis
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredOwners.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Nenhum responsável encontrado
              </p>
            ) : (
              filteredOwners.map(o => {
                const checked = draftOwners.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={v => toggleOwner(o.id, !!v)}
                    />
                    <span className="truncate">
                      {o.name || o.email || o.id}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t p-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            onClick={handleClear}
          >
            Limpar
          </Button>
          <Button type="button" size="sm" className="h-8" onClick={handleApply}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
