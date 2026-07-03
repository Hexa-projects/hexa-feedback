import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, ChevronDown, Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Org = {
  id: string;
  rd_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  raw_payload: any;
  rd_updated_at: string | null;
};

type RdUser = { rd_id: string; name: string | null; email: string | null };

type QuickFilter = "all" | "mine";

type PresetFilter =
  | null
  | "sales_recurring"
  | "sales_recent_30d"
  | "sales_over_3m"
  | "with_sales"
  | "without_sales"
  | "deals_open"
  | "deals_recent_contact"
  | "new_no_deals";

const PRESET_LABELS: Record<Exclude<PresetFilter, null>, string> = {
  sales_recurring: "Vendas recorrentes (2+)",
  sales_recent_30d: "Vendas recentes (30 dias)",
  sales_over_3m: "Vendas há mais de 3 meses",
  with_sales: "Com vendas",
  without_sales: "Sem vendas",
  deals_open: "Negociações em andamento",
  deals_recent_contact: "Negociação com contato recente",
  new_no_deals: "Novas empresas sem negociação",
};

const SALES_PRESETS: Exclude<PresetFilter, null>[] = [
  "sales_recurring",
  "sales_recent_30d",
  "sales_over_3m",
  "with_sales",
  "without_sales",
];
const DEAL_PRESETS: Exclude<PresetFilter, null>[] = [
  "deals_open",
  "deals_recent_contact",
  "new_no_deals",
];

function ownerIdOf(org: Org): string | null {
  const p = org.raw_payload || {};
  return (
    (p.user_id && String(p.user_id)) ||
    (p.user?.id && String(p.user.id)) ||
    (p.owner?.id && String(p.owner.id)) ||
    null
  );
}

function dealsOf(org: Org): any[] {
  const p = org.raw_payload || {};
  const arr = p.deals ?? p.deal_list ?? p.deals_history ?? [];
  return Array.isArray(arr) ? arr : [];
}

function segmentOf(org: Org): string {
  const p = org.raw_payload || {};
  return (
    p.segment ||
    p.sector ||
    p.industry ||
    p.company?.segment ||
    p.company?.sector ||
    p.company?.industry ||
    ""
  );
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function orgCreatedAt(org: Org): Date | null {
  const p = org.raw_payload || {};
  return toDate(p.created_at) || toDate(org.rd_updated_at);
}

function matchesPreset(org: Org, preset: Exclude<PresetFilter, null>): boolean {
  const deals = dealsOf(org);
  const now = Date.now();
  const wonDeals = deals.filter(d => d?.win === true || d?.won === true || d?.won_at || d?.stage?.nickname === "won");
  const openDeals = deals.filter(d => {
    const closed = d?.win === true || d?.win === false || d?.won_at || d?.lost_at || d?.closed_at;
    return !closed;
  });
  const wonDates = wonDeals
    .map(d => toDate(d?.won_at || d?.closed_at || d?.updated_at))
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastWon = wonDates[0] ?? null;

  const DAY = 24 * 60 * 60 * 1000;

  switch (preset) {
    case "sales_recurring":
      return wonDeals.length >= 2;
    case "sales_recent_30d":
      return !!lastWon && now - lastWon.getTime() <= 30 * DAY;
    case "sales_over_3m":
      return !!lastWon && now - lastWon.getTime() > 90 * DAY;
    case "with_sales":
      return wonDeals.length >= 1;
    case "without_sales":
      return wonDeals.length === 0;
    case "deals_open":
      return openDeals.length > 0;
    case "deals_recent_contact": {
      if (openDeals.length === 0) return false;
      const lastTouch = openDeals
        .map(d => toDate(d?.last_activity_at || d?.updated_at))
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return !!lastTouch && now - lastTouch.getTime() <= 7 * DAY;
    }
    case "new_no_deals": {
      const created = orgCreatedAt(org);
      const isNew = !!created && now - created.getTime() <= 30 * DAY;
      return isNew && deals.length === 0;
    }
  }
}


export default function CompaniesList() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [users, setUsers] = useState<RdUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState("");

  // Applied filter state (what the table actually uses)
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);

  // Draft (inside popover, only committed on "Aplicar")
  const [open, setOpen] = useState(false);
  const [draftQuick, setDraftQuick] = useState<QuickFilter>("all");
  const [draftOwners, setDraftOwners] = useState<string[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");

  // Preset filter (independent single-select dropdown)
  const [preset, setPreset] = useState<PresetFilter>(null);
  const [presetOpen, setPresetOpen] = useState(false);

  // Quick search popover
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {

      const [{ data: orgData }, { data: userData }] = await Promise.all([
        supabase
          .from("rd_organizations")
          .select("id, rd_id, name, email, phone, cnpj, raw_payload, rd_updated_at")
          .is("deleted_at", null)
          .order("name", { ascending: true }),
        supabase
          .from("rd_users")
          .select("rd_id, name, email")
          .is("deleted_at", null)
          .order("name", { ascending: true }),
      ]);
      setOrgs((orgData as any) || []);
      setUsers((userData as any) || []);
      setLoading(false);
    })();
  }, []);

  // Map current logged user → rd_user rd_id (by email)
  const myRdId = useMemo(() => {
    if (!user?.email) return null;
    const me = users.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
    return me?.rd_id ?? null;
  }, [user?.email, users]);

  const filteredOrgs = useMemo(() => {
    let list = orgs;
    if (quick === "mine" && myRdId) {
      list = list.filter(o => ownerIdOf(o) === myRdId);
    } else if (selectedOwners.length > 0) {
      const set = new Set(selectedOwners);
      list = list.filter(o => {
        const oid = ownerIdOf(o);
        return oid ? set.has(oid) : false;
      });
    }
    if (preset) {
      list = list.filter(o => matchesPreset(o, preset));
    }
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      list = list.filter(o =>
        (o.name || "").toLowerCase().includes(q) ||
        (o.email || "").toLowerCase().includes(q) ||
        (o.cnpj || "").toLowerCase().includes(q) ||
        segmentOf(o).toLowerCase().includes(q),
      );
    }
    return list;
  }, [orgs, quick, selectedOwners, tableSearch, myRdId, preset]);


  const filteredOwners = useMemo(() => {
    if (!ownerSearch.trim()) return users;
    const q = ownerSearch.trim().toLowerCase();
    return users.filter(u =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q),
    );
  }, [users, ownerSearch]);

  const ownersById = useMemo(() => {
    const m = new Map<string, RdUser>();
    users.forEach(u => m.set(u.rd_id, u));
    return m;
  }, [users]);

  const openPopover = (v: boolean) => {
    if (v) {
      // Seed draft with applied filter
      setDraftQuick(quick);
      setDraftOwners(selectedOwners);
      setOwnerSearch("");
    }
    setOpen(v);
  };

  const toggleDraftOwner = (rdId: string, checked: boolean) => {
    setDraftOwners(prev => {
      const next = checked ? [...prev, rdId] : prev.filter(x => x !== rdId);
      // Selecting any owner implicitly moves away from quick filters
      return next;
    });
    setDraftQuick("all");
  };

  const handleClear = () => {
    setDraftQuick("all");
    setDraftOwners([]);
    setOwnerSearch("");
  };

  const handleApply = () => {
    setQuick(draftQuick);
    setSelectedOwners(draftQuick === "mine" ? [] : draftOwners);
    setOpen(false);
  };

  const triggerLabel =
    quick === "mine"
      ? "Minhas Empresas"
      : selectedOwners.length === 0
        ? "Todas as Empresas"
        : selectedOwners.length === 1
          ? ownersById.get(selectedOwners[0])?.name || "1 responsável"
          : `${selectedOwners.length} responsáveis`;

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" /> Empresas
            </h1>
            <p className="text-sm text-muted-foreground">
              Empresas sincronizadas do RD Station CRM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter dropdown */}
          <Popover open={open} onOpenChange={openPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 min-w-[200px] justify-between"
              >
                <span className="truncate">{triggerLabel}</span>
                <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              {/* Search */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar"
                    className="pl-8 h-9"
                    value={ownerSearch}
                    onChange={e => setOwnerSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick options */}
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
                  Todas as Empresas
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
                  Minhas Empresas
                </button>
              </div>

              {/* Responsáveis */}
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
                    filteredOwners.map(u => {
                      const checked = draftOwners.includes(u.rd_id);
                      return (
                        <label
                          key={u.rd_id}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={v => toggleDraftOwner(u.rd_id, !!v)}
                          />
                          <span className="truncate">
                            {u.name || u.email || u.rd_id}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Footer */}
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
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={handleApply}
                >
                  Aplicar
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Filtros predefinidos (VENDAS / NEGOCIAÇÕES) */}
          <Popover open={presetOpen} onOpenChange={setPresetOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 min-w-[200px] justify-between",
                  preset && "border-primary text-primary",
                )}
              >
                <span className="truncate">
                  {preset ? PRESET_LABELS[preset] : "Filtros predefinidos"}
                </span>
                <ChevronDown className="w-4 h-4 opacity-60 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              <div className="py-1">
                <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Vendas
                </div>
                {SALES_PRESETS.map(key => {
                  const active = preset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPreset(active ? null : key);
                        setPresetOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                        active
                          ? "text-primary font-medium bg-primary/5"
                          : "text-foreground",
                      )}
                    >
                      {PRESET_LABELS[key]}
                    </button>
                  );
                })}

                <div className="px-3 pt-3 pb-1 mt-1 border-t text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Negociações
                </div>
                {DEAL_PRESETS.map(key => {
                  const active = preset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPreset(active ? null : key);
                        setPresetOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                        active
                          ? "text-primary font-medium bg-primary/5"
                          : "text-foreground",
                      )}
                    >
                      {PRESET_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>



          {/* Table search (separate — não faz parte do painel) */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa..."
              className="pl-9"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground p-6">Carregando...</p>
            ) : filteredOrgs.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>CNPJ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map(o => {
                    const ownerId = ownerIdOf(o);
                    const owner = ownerId ? ownersById.get(ownerId) : null;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.name || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {owner?.name || owner?.email || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{o.email || "—"}</TableCell>
                        <TableCell className="text-sm">{o.phone || "—"}</TableCell>
                        <TableCell className="text-sm">{o.cnpj || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
