import { useEffect, useMemo, useState } from "react";
import HexaLayout from "@/components/HexaLayout";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import CreateCompanySheet from "@/components/crm/CreateCompanySheet";

type Contact = {
  id: string;
  nome: string;
  empresa: string;
  emails: string[];
  telefones: string[];
  cargo: string;
  negociacoes: number;
  whatsapp?: string;
  phonesData?: PhoneEntry[];
};

type PhoneEntry = { tipo: "Comercial" | "Residencial" | "Celular"; numero: string };

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

  // modal create / edit contact
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  // company edit sheet
  type CompanyData = {
    name: string;
    tipo: string;
    segment: string;
    url: string;
    summary: string;
    address: string;
    cnpj: string;
  };
  const [companyEditOpen, setCompanyEditOpen] = useState(false);
  const [companyEditName, setCompanyEditName] = useState<string>("");
  const [companyDataMap, setCompanyDataMap] = useState<Record<string, CompanyData>>({});

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

  const pageSelectedCount = pageRows.filter(r => selected.has(r.id)).length;
  const allSelected = pageRows.length > 0 && pageSelectedCount === pageRows.length;
  const someSelected = pageSelectedCount > 0 && pageSelectedCount < pageRows.length;
  const headerCheckboxState: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;
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
  const clearSelection = () => setSelected(new Set());
  const selectAllFiltered = () => {
    setSelected(new Set(sorted.map(r => r.id)));
  };
  const selectedCount = selected.size;
  const allFilteredSelected =
    sorted.length > 0 && sorted.every(r => selected.has(r.id));

  const pageNumbers = useMemo(() => buildPages(currentPage, totalPages), [
    currentPage,
    totalPages,
  ]);

  const resetForm = () => {
    setForm({ nome: "", cargo: "", whatsapp: "", empresa: "" });
    setPhones([{ tipo: "Celular", numero: "" }]);
    setEmails([""]);
    setNomeError(false);
  };

  const openEditContact = (c: Contact) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      cargo: c.cargo || "",
      whatsapp: c.whatsapp || "",
      empresa: c.empresa || "",
    });
    setPhones(
      c.phonesData && c.phonesData.length
        ? c.phonesData
        : c.telefones.length
          ? c.telefones.map(n => ({ tipo: "Celular" as const, numero: n }))
          : [{ tipo: "Celular", numero: "" }],
    );
    setEmails(c.emails.length ? c.emails : [""]);
    setNomeError(false);
    setCreateOpen(true);
  };

  const openCreateContact = () => {
    setEditingId(null);
    resetForm();
    setCreateOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) {
      setNomeError(true);
      return;
    }
    setSaving(true);
    setTimeout(() => {
      const cleanEmails = emails.map(e => e.trim()).filter(Boolean);
      const cleanPhonesData = phones.filter(p => p.numero.trim());
      const cleanPhones = cleanPhonesData.map(p => p.numero.trim());
      if (editingId) {
        setContacts(prev =>
          prev.map(c =>
            c.id === editingId
              ? {
                  ...c,
                  nome: form.nome.trim(),
                  empresa: form.empresa || "",
                  cargo: form.cargo || "",
                  whatsapp: form.whatsapp || "",
                  emails: cleanEmails,
                  telefones: cleanPhones,
                  phonesData: cleanPhonesData,
                }
              : c,
          ),
        );
        toast.success("Contato atualizado com sucesso");
      } else {
        const newC: Contact = {
          id: `local-${Date.now()}`,
          nome: form.nome.trim(),
          empresa: form.empresa || "",
          emails: cleanEmails,
          telefones: cleanPhones,
          phonesData: cleanPhonesData,
          whatsapp: form.whatsapp || "",
          cargo: form.cargo || "",
          negociacoes: 0,
        };
        setContacts(prev => [newC, ...prev]);
        toast.success("Contato criado com sucesso");
      }
      resetForm();
      setEditingId(null);
      setSaving(false);
      setCreateOpen(false);
    }, 300);
  };

  const openEditCompany = (name: string) => {
    if (!name) return;
    setCompanyEditName(name);
    setCompanyEditOpen(true);
  };

  const handleCompanySaved = (data: CompanyData) => {
    const oldName = companyEditName;
    const newName = data.name;
    setCompanyDataMap(prev => {
      const next = { ...prev };
      if (oldName && oldName !== newName) delete next[oldName];
      next[newName] = data;
      return next;
    });
    if (oldName && oldName !== newName) {
      setContacts(prev =>
        prev.map(c => (c.empresa === oldName ? { ...c, empresa: newName } : c)),
      );
    }
  };

  // Delete confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const handleDeleteSelected = () => {
    const ids = new Set(selected);
    setContacts(prev => prev.filter(c => !ids.has(c.id)));
    const n = ids.size;
    setSelected(new Set());
    setDeleteConfirmOpen(false);
    toast.success(`${n} contato${n > 1 ? "s" : ""} excluído${n > 1 ? "s" : ""}`);
  };

  return (
    <HexaLayout>
      <div className="space-y-4">
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
          <Button onClick={openCreateContact}>Criar contato</Button>
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
                    checked={headerCheckboxState}
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
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b last:border-b-0",
                      selected.has(c.id)
                        ? "bg-primary/10 hover:bg-primary/15"
                        : "hover:bg-muted/30",
                    )}
                  >
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
                        onClick={() => openEditContact(c)}
                      >
                        {c.nome}
                      </button>
                    </td>
                    <td className="p-3">
                      {c.empresa ? (
                        <button
                          type="button"
                          className="text-primary hover:underline text-left"
                          onClick={() => openEditCompany(c.empresa)}
                        >
                          {c.empresa}
                        </button>
                      ) : (
                        ""
                      )}
                    </td>
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
      <Dialog
        open={createOpen}
        onOpenChange={o => {
          setCreateOpen(o);
          if (!o) {
            resetForm();
            setEditingId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Contato" : "Criar Contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="ct-nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ct-nome"
                placeholder="Digite o nome do contato"
                value={form.nome}
                maxLength={100}
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

            {/* Cargo */}
            <div className="space-y-2">
              <Label htmlFor="ct-cargo">Cargo</Label>
              <Input
                id="ct-cargo"
                placeholder="Digite o cargo do contato"
                value={form.cargo}
                maxLength={100}
                onChange={e => setForm({ ...form, cargo: e.target.value })}
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label htmlFor="ct-whatsapp">Nome de usuário no WhatsApp</Label>
              <Input
                id="ct-whatsapp"
                placeholder="@"
                value={form.whatsapp}
                maxLength={50}
                onChange={e => setForm({ ...form, whatsapp: e.target.value })}
              />
            </div>

            {/* Telefones */}
            <div className="space-y-2">
              <Label>Telefone</Label>
              <div className="space-y-2">
                {phones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      value={p.tipo}
                      onValueChange={v =>
                        setPhones(prev =>
                          prev.map((x, ix) =>
                            ix === i ? { ...x, tipo: v as PhoneEntry["tipo"] } : x,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="w-[150px]">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_TYPES.map(t => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="+55 (00) 00000-0000"
                      value={p.numero}
                      inputMode="tel"
                      onChange={e =>
                        setPhones(prev =>
                          prev.map((x, ix) =>
                            ix === i
                              ? { ...x, numero: maskPhone(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                    {phones.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover telefone"
                        onClick={() =>
                          setPhones(prev => prev.filter((_, ix) => ix !== i))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                onClick={() =>
                  setPhones(prev => [...prev, { tipo: "Celular", numero: "" }])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar telefone
              </button>
            </div>

            {/* E-mails */}
            <div className="space-y-2">
              <Label>E-mail</Label>
              <div className="space-y-2">
                {emails.map((em, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="seunome@email.com"
                      value={em}
                      maxLength={255}
                      onChange={e =>
                        setEmails(prev =>
                          prev.map((x, ix) => (ix === i ? e.target.value : x)),
                        )
                      }
                    />
                    {emails.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover e-mail"
                        onClick={() =>
                          setEmails(prev => prev.filter((_, ix) => ix !== i))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                onClick={() => setEmails(prev => [...prev, ""])}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar e-mail
              </button>
            </div>

            {/* Empresa */}
            <div className="space-y-2">
              <Label>Empresa do contato</Label>
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
                      <span className="text-muted-foreground">Selecionar</span>
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

          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Salvar alterações" : "Criar Contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCompanySheet
        open={companyEditOpen}
        onOpenChange={setCompanyEditOpen}
        mode="edit"
        initial={
          companyDataMap[companyEditName] || { name: companyEditName }
        }
        onSaved={handleCompanySaved}
      />
      </div>
    </HexaLayout>
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
