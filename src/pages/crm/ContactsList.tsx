import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Filter,
  Calendar as CalendarIcon,
  Info,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronsUpDown,
  Loader2,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Contact = {
  id: string;
  nome: string;
  empresa: string;
  emails: string[];
  telefones: string[];
  cargo: string;
  negociacoes: number;
};

const MOCK_CONTACTS: Contact[] = [
  {
    id: "c1",
    nome: "Ana Beatriz Souza",
    empresa: "MedCare Diagnósticos",
    emails: ["ana.souza@medcare.com.br"],
    telefones: ["(11) 98765-4321"],
    cargo: "Diretora Clínica",
    negociacoes: 3,
  },
  {
    id: "c2",
    nome: "Carlos Henrique Lima",
    empresa: "VetLife Hospital Veterinário",
    emails: ["carlos.lima@vetlife.com.br", "financeiro@vetlife.com.br"],
    telefones: ["(21) 99123-4567"],
    cargo: "Gerente Comercial",
    negociacoes: 1,
  },
  {
    id: "c3",
    nome: "Fernanda Alves",
    empresa: "Clínica Bem Estar",
    emails: ["fernanda@bemestar.com.br"],
    telefones: ["(31) 98888-1122", "(31) 3222-4455"],
    cargo: "Sócia Proprietária",
    negociacoes: 5,
  },
  {
    id: "c4",
    nome: "Rafael Monteiro",
    empresa: "Laboratório Precisão",
    emails: [],
    telefones: ["(11) 3344-5566"],
    cargo: "Coordenador de Compras",
    negociacoes: 0,
  },
  {
    id: "c5",
    nome: "Juliana Prado",
    empresa: "UPA Central",
    emails: ["juliana.prado@upacentral.gov.br"],
    telefones: [],
    cargo: "Superintendente",
    negociacoes: 2,
  },
  {
    id: "c6",
    nome: "Marcos Vinícius Teixeira",
    empresa: "Hospital São Lucas",
    emails: ["marcos.teixeira@saolucas.com.br"],
    telefones: ["(11) 91234-5678"],
    cargo: "Diretor de Operações",
    negociacoes: 4,
  },
  {
    id: "c7",
    nome: "Patrícia Nogueira",
    empresa: "PetSaúde Clínica Veterinária",
    emails: ["patricia@petsaude.com.br"],
    telefones: ["(19) 99555-7788"],
    cargo: "Veterinária Chefe",
    negociacoes: 1,
  },
  {
    id: "c8",
    nome: "Eduardo Ribeiro",
    empresa: "Centro Diagnóstico Imagem",
    emails: ["eduardo.ribeiro@cdimagem.com.br"],
    telefones: ["(11) 4002-8922"],
    cargo: "CEO",
    negociacoes: 7,
  },
  {
    id: "c9",
    nome: "Larissa Campos",
    empresa: "Clínica Vida Plena",
    emails: ["larissa@vidaplena.com.br"],
    telefones: ["(41) 98123-9988"],
    cargo: "Gestora Administrativa",
    negociacoes: 0,
  },
  {
    id: "c10",
    nome: "Bruno Ferreira",
    empresa: "AnimalCare Hospital",
    emails: ["bruno.ferreira@animalcare.com.br"],
    telefones: ["(51) 99777-1234"],
    cargo: "Diretor Técnico",
    negociacoes: 2,
  },
];

const PAGE_SIZES = [10, 25, 50, 100];

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  let out = "+55";
  if (d.length > 0) out += " (" + d.slice(0, 2);
  if (d.length >= 2) out += ")";
  if (d.length > 2) out += " " + d.slice(2, 7);
  if (d.length > 7) out += "-" + d.slice(7, 11);
  return out;
}

type PhoneEntry = { tipo: "Comercial" | "Residencial" | "Celular"; numero: string };
const PHONE_TYPES: PhoneEntry["tipo"][] = ["Comercial", "Residencial", "Celular"];

type SortDir = "asc" | "desc";

export default function ContactsList() {
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");

  // pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // modal create
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cargo: "",
    whatsapp: "",
    empresa: "",
  });
  const [phones, setPhones] = useState<PhoneEntry[]>([
    { tipo: "Celular", numero: "" },
  ]);
  const [emails, setEmails] = useState<string[]>([""]);
  const [nomeError, setNomeError] = useState(false);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rd_organizations")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(500);
      if (data) setCompanies(data as any);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c => {
      return (
        c.nome.toLowerCase().includes(q) ||
        c.empresa.toLowerCase().includes(q) ||
        c.emails.some(e => e.toLowerCase().includes(q)) ||
        c.telefones.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [contacts, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) =>
      sortDir === "asc"
        ? a.nome.localeCompare(b.nome, "pt-BR")
        : b.nome.localeCompare(a.nome, "pt-BR"),
    );
    return arr;
  }, [filtered, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const activeFilters = search.trim() ? 1 : 0;

  const allSelected =
    pageRows.length > 0 && pageRows.every(r => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) pageRows.forEach(r => next.delete(r.id));
    else pageRows.forEach(r => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const pageNumbers = useMemo(() => buildPages(currentPage, totalPages), [
    currentPage,
    totalPages,
  ]);

  const handleCreate = () => {
    if (!form.nome.trim()) {
      setNomeError(true);
      return;
    }
    setSaving(true);
    setTimeout(() => {
      const newC: Contact = {
        id: `local-${Date.now()}`,
        nome: form.nome.trim(),
        empresa: form.empresa || "",
        emails: form.email ? [form.email] : [],
        telefones: form.telefone ? [form.telefone] : [],
        cargo: form.cargo || "",
        negociacoes: 0,
      };
      setContacts(prev => [newC, ...prev]);
      setForm({ nome: "", empresa: "", email: "", telefone: "", cargo: "" });
      setNomeError(false);
      setSaving(false);
      setCreateOpen(false);
      toast.success("Contato criado com sucesso");
    }, 300);
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contatos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus contatos comerciais
        </p>
      </div>

      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros ({activeFilters})
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <div className="space-y-3">
              <div className="text-sm font-medium">Buscar</div>
              <Input
                placeholder="Nome, e-mail, telefone ou empresa"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              <div className="flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearch("")}
                  disabled={!search}
                >
                  Limpar
                </Button>
                <Button size="sm" onClick={() => setFilterOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" aria-label="Calendário">
            <CalendarIcon className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Criar contato</Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="w-10 p-3 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="p-3 text-left font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() =>
                      setSortDir(sortDir === "asc" ? "desc" : "asc")
                    }
                  >
                    Contatos
                    {sortDir === "asc" ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="p-3 text-left font-medium">Empresa</th>
                <th className="p-3 text-left font-medium">Emails</th>
                <th className="p-3 text-left font-medium">Telefones</th>
                <th className="p-3 text-left font-medium">Cargo</th>
                <th className="p-3 text-left font-medium">Negociações</th>
                <th className="w-10 p-3"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Nenhum contato encontrado
                  </td>
                </tr>
              ) : (
                pageRows.map(c => (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="p-3">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                        aria-label={`Selecionar ${c.nome}`}
                      />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium text-left"
                        onClick={() => toast.info(`Contato: ${c.nome}`)}
                      >
                        {c.nome}
                      </button>
                    </td>
                    <td className="p-3">{c.empresa || ""}</td>
                    <td className="p-3 max-w-[220px]">
                      <div className="truncate" title={c.emails.join(", ")}>
                        {c.emails.join(", ")}
                      </div>
                    </td>
                    <td className="p-3">{c.telefones.join(", ")}</td>
                    <td className="p-3">{c.cargo || ""}</td>
                    <td className="p-3">{c.negociacoes || ""}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Informações"
                        onClick={() => toast.info(`Detalhes de ${c.nome}`)}
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé de paginação */}
        <div className="flex items-center justify-between gap-3 p-3 border-t flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Exibindo</span>
            <Select
              value={String(pageSize)}
              onValueChange={v => setPageSize(Number(v))}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(s => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>de {total} Contatos</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            {pageNumbers.map((n, i) =>
              n === "..." ? (
                <span
                  key={`e-${i}`}
                  className="px-2 text-muted-foreground text-sm"
                >
                  …
                </span>
              ) : (
                <Button
                  key={n}
                  size="sm"
                  variant={n === currentPage ? "default" : "outline"}
                  className={cn(
                    "min-w-[36px]",
                    n === currentPage && "bg-primary text-primary-foreground",
                  )}
                  onClick={() => setPage(n as number)}
                >
                  {n}
                </Button>
              ),
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Criar contato */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ct-nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ct-nome"
                placeholder="Digite o nome"
                value={form.nome}
                onChange={e => {
                  setForm({ ...form, nome: e.target.value });
                  if (e.target.value.trim()) setNomeError(false);
                }}
                aria-invalid={nomeError}
                className={
                  nomeError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
              />
              {nomeError && (
                <p className="text-xs text-destructive">Nome é obrigatório</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Empresa</Label>
              <Popover
                open={companyPopoverOpen}
                onOpenChange={setCompanyPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {form.empresa || (
                      <span className="text-muted-foreground">
                        Selecionar empresa
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                  <Command>
                    <CommandInput placeholder="Buscar empresa..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                      <CommandGroup>
                        {companies.map(c => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              setForm(f => ({ ...f, empresa: c.name }));
                              setCompanyPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.empresa === c.name
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-email">E-mail</Label>
              <Input
                id="ct-email"
                type="email"
                placeholder="nome@empresa.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-telefone">Telefone</Label>
              <Input
                id="ct-telefone"
                placeholder="(11) 98765-4321"
                value={form.telefone}
                inputMode="numeric"
                onChange={e =>
                  setForm({ ...form, telefone: maskPhone(e.target.value) })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-cargo">Cargo</Label>
              <Input
                id="ct-cargo"
                placeholder="Ex.: Diretor Comercial"
                value={form.cargo}
                onChange={e => setForm({ ...form, cargo: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}
