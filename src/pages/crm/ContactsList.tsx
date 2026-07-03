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

// Padroniza nomes vindos do RD (remove pontuações órfãs, CAIXA ALTA e sujeira).
function normalizeName(raw: string): string {
  if (!raw) return "";
  let s = String(raw).replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s.,;:•\-]+/, "").replace(/[\s.,;:•\-]+$/, "").trim();
  s = s.replace(/\s+/g, " ");
  if (!s) return "";
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const isAllUpper = letters.length > 1 && letters === letters.toUpperCase();
  const isAllLower = letters.length > 1 && letters === letters.toLowerCase();
  if (isAllUpper || isAllLower) {
    const minor = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "van", "von", "la", "le"]);
    s = s
      .toLowerCase()
      .split(" ")
      .map((w, i) => {
        if (!w) return w;
        if (i > 0 && minor.has(w)) return w;
        return w
          .split("-")
          .map(p => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
          .join("-");
      })
      .join(" ");
  }
  return s;
}

// Formata telefones para um padrão único: +55 (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX
function formatPhoneBR(raw: string): string {
  if (!raw) return "";
  let d = String(raw).replace(/\D/g, "");
  if (!d) return "";
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 10) {
    return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11) {
    return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return `+${d}`;
}

const PHONE_TYPES: PhoneEntry["tipo"][] = ["Comercial", "Residencial", "Celular"];

type SortDir = "asc" | "desc";

export default function ContactsList() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all"); // "all" | "__none__" | nome empresa
  const [filterCargo, setFilterCargo] = useState<string>("");
  const [filterEmail, setFilterEmail] = useState<"any" | "with" | "without">("any");
  const [filterPhone, setFilterPhone] = useState<"any" | "with" | "without">("any");
  const [filterPhoneType, setFilterPhoneType] = useState<"any" | "Celular" | "Comercial" | "Residencial">("any");
  const [filterDeals, setFilterDeals] = useState<"any" | "none" | "with" | "gte3" | "gte5">("any");

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
      setLoading(true);
      const [{ data: cts }, { data: orgs }, { data: deals }, { data: cfields }] = await Promise.all([
        supabase
          .from("rd_contacts")
          .select("id, rd_id, name, email, phone, organization_rd_id, raw_payload")
          .is("deleted_at", null)
          .order("name", { ascending: true })
          .limit(5000),
        supabase
          .from("rd_organizations")
          .select("id, rd_id, name")
          .is("deleted_at", null)
          .limit(5000),
        supabase
          .from("rd_deals")
          .select("contact_rd_id, rd_updated_at, raw_payload")
          .is("deleted_at", null)
          .not("contact_rd_id", "is", null)
          .limit(20000),
        supabase
          .from("rd_custom_fields")
          .select("rd_id, label, for_entity")
          .is("deleted_at", null)
          .limit(500),
      ]);
      const orgMap = new Map<string, string>();
      (orgs || []).forEach((o: any) => o.rd_id && orgMap.set(o.rd_id, o.name || ""));
      setCompanies(((orgs || []) as any).map((o: any) => ({ id: o.id, name: o.name })).filter((o: any) => o.name));
      // Descobre o(s) custom field(s) que representam cargo/função no deal
      const cargoFieldIds = new Set<string>(
        (cfields || [])
          .filter((f: any) => /fun[cç][aã]o|cargo|posi[cç][aã]o|position|job/i.test(f.label || ""))
          .map((f: any) => String(f.rd_id)),
      );
      // Para cada contato, guarda o cargo do deal mais recente
      const cargoByContact = new Map<string, string>();
      const dealCount = new Map<string, number>();
      const dealsSorted = [...(deals || [])].sort((a: any, b: any) =>
        String(b.rd_updated_at || "").localeCompare(String(a.rd_updated_at || "")),
      );
      dealsSorted.forEach((d: any) => {
        if (!d.contact_rd_id) return;
        dealCount.set(d.contact_rd_id, (dealCount.get(d.contact_rd_id) || 0) + 1);
        if (cargoByContact.has(d.contact_rd_id)) return;
        const dcf = (d.raw_payload && Array.isArray(d.raw_payload.deal_custom_fields))
          ? d.raw_payload.deal_custom_fields
          : [];
        for (const f of dcf) {
          const fid = String(f?.custom_field_id ?? f?._id ?? "");
          const val = typeof f?.value === "string" ? f.value.trim() : "";
          if (val && cargoFieldIds.has(fid)) {
            cargoByContact.set(d.contact_rd_id, val);
            break;
          }
        }
      });
      const mapped: Contact[] = (cts || []).map((c: any) => {
        const raw = c.raw_payload || {};
        const rawEmails: string[] = Array.isArray(raw.emails)
          ? raw.emails.map((e: any) => e?.email).filter(Boolean)
          : (c.email ? [c.email] : []);
        const emails = Array.from(
          new Set(
            rawEmails
              .map((e: string) => String(e).trim().toLowerCase())
              .filter(Boolean),
          ),
        );
        const rawPhones: PhoneEntry[] = Array.isArray(raw.phones)
          ? raw.phones.map((p: any) => ({
              tipo: (p?.type === "cellphone" ? "Celular" : p?.type === "work" ? "Comercial" : p?.type === "home" ? "Residencial" : "Celular") as PhoneEntry["tipo"],
              numero: formatPhoneBR(p?.phone || ""),
            })).filter((p: PhoneEntry) => p.numero)
          : (c.phone ? [{ tipo: "Celular" as const, numero: formatPhoneBR(c.phone) }] : []);
        // dedup por número
        const seen = new Set<string>();
        const phonesData = rawPhones.filter(p => {
          if (seen.has(p.numero)) return false;
          seen.add(p.numero);
          return true;
        });
        const nome = normalizeName(c.name) || "(sem nome)";
        return {
          id: c.id,
          nome,
          empresa: c.organization_rd_id ? normalizeName(orgMap.get(c.organization_rd_id) || "") : "",
          emails,
          telefones: phonesData.map(p => p.numero),
          phonesData,
          cargo: normalizeName(raw.title || raw.job_title || raw.position || cargoByContact.get(c.rd_id) || ""),
          negociacoes: dealCount.get(c.rd_id) || 0,
        };
      });
      setContacts(mapped);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cargoQ = filterCargo.trim().toLowerCase();
    return contacts.filter(c => {
      if (q) {
        const hit =
          c.nome.toLowerCase().includes(q) ||
          c.empresa.toLowerCase().includes(q) ||
          (c.cargo || "").toLowerCase().includes(q) ||
          c.emails.some(e => e.toLowerCase().includes(q)) ||
          c.telefones.some(t => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (filterEmpresa !== "all") {
        if (filterEmpresa === "__none__") {
          if (c.empresa.trim()) return false;
        } else if (c.empresa !== filterEmpresa) return false;
      }
      if (cargoQ && !(c.cargo || "").toLowerCase().includes(cargoQ)) return false;
      if (filterEmail === "with" && c.emails.length === 0) return false;
      if (filterEmail === "without" && c.emails.length > 0) return false;
      if (filterPhone === "with" && c.telefones.length === 0) return false;
      if (filterPhone === "without" && c.telefones.length > 0) return false;
      if (filterPhoneType !== "any") {
        const hasType = (c.phonesData || []).some(p => p.tipo === filterPhoneType);
        if (!hasType) return false;
      }
      if (filterDeals === "none" && c.negociacoes > 0) return false;
      if (filterDeals === "with" && c.negociacoes < 1) return false;
      if (filterDeals === "gte3" && c.negociacoes < 3) return false;
      if (filterDeals === "gte5" && c.negociacoes < 5) return false;
      return true;
    });
  }, [contacts, search, filterEmpresa, filterCargo, filterEmail, filterPhone, filterPhoneType, filterDeals]);

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
  }, [search, pageSize, filterEmpresa, filterCargo, filterEmail, filterPhone, filterPhoneType, filterDeals]);

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (filterEmpresa !== "all" ? 1 : 0) +
    (filterCargo.trim() ? 1 : 0) +
    (filterEmail !== "any" ? 1 : 0) +
    (filterPhone !== "any" ? 1 : 0) +
    (filterPhoneType !== "any" ? 1 : 0) +
    (filterDeals !== "any" ? 1 : 0);

  const empresaOptions = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach(c => { if (c.empresa.trim()) s.add(c.empresa); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [contacts]);

  const clearAllFilters = () => {
    setSearch("");
    setFilterEmpresa("all");
    setFilterCargo("");
    setFilterEmail("any");
    setFilterPhone("any");
    setFilterPhoneType("any");
    setFilterDeals("any");
  };

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
          <PopoverContent align="start" className="w-[380px] max-h-[80vh] overflow-y-auto">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Busca livre</Label>
                <Input
                  placeholder="Nome, e-mail, telefone, cargo ou empresa"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Empresa</Label>
                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    <SelectItem value="__none__">Sem empresa vinculada</SelectItem>
                    {empresaOptions.map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Cargo contém</Label>
                <Input
                  placeholder="Ex: Diretor, Gerente..."
                  value={filterCargo}
                  onChange={e => setFilterCargo(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Select value={filterEmail} onValueChange={(v: any) => setFilterEmail(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer</SelectItem>
                      <SelectItem value="with">Com e-mail</SelectItem>
                      <SelectItem value="without">Sem e-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Select value={filterPhone} onValueChange={(v: any) => setFilterPhone(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer</SelectItem>
                      <SelectItem value="with">Com telefone</SelectItem>
                      <SelectItem value="without">Sem telefone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de telefone</Label>
                <Select value={filterPhoneType} onValueChange={(v: any) => setFilterPhoneType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer tipo</SelectItem>
                    <SelectItem value="Celular">Celular</SelectItem>
                    <SelectItem value="Comercial">Comercial</SelectItem>
                    <SelectItem value="Residencial">Residencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Negociações</Label>
                <Select value={filterDeals} onValueChange={(v: any) => setFilterDeals(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Todas</SelectItem>
                    <SelectItem value="none">Sem negociação</SelectItem>
                    <SelectItem value="with">Com pelo menos 1</SelectItem>
                    <SelectItem value="gte3">3 ou mais</SelectItem>
                    <SelectItem value="gte5">5 ou mais</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  disabled={activeFilters === 0}
                >
                  Limpar tudo
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

      {/* Barra de ações em massa */}
      {selectedCount > 0 && (
        <div className="rounded-lg overflow-hidden border">
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-900 text-slate-100 flex-wrap">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">{selectedCount} selecionado{selectedCount > 1 ? "s" : ""}</span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-slate-300 hover:text-white underline-offset-2 hover:underline"
              >
                Limpar seleção
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                className="text-sky-400 hover:text-sky-300 font-medium"
                onClick={() => toast.info("Adicionar ou Alterar em breve")}
              >
                Adicionar ou Alterar
              </button>
              <button
                type="button"
                className="text-sky-400 hover:text-sky-300 font-medium"
                onClick={() => toast.info("Criar Negociação em breve")}
              >
                Criar Negociação
              </button>
              <button
                type="button"
                className="text-red-400 hover:text-red-300 font-medium"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Excluir
              </button>
            </div>
          </div>
          {!allFilteredSelected && sorted.length > pageRows.length && (
            <div className="px-4 py-2 bg-muted/60 text-sm text-muted-foreground flex items-center justify-center">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={selectAllFiltered}
              >
                Selecionar todos os {sorted.length} itens deste filtro
              </button>
            </div>
          )}
        </div>
      )}

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
                    {loading ? "Carregando contatos..." : "Nenhum contato encontrado. Rode uma sincronização em Configurações → Integrações → RD Station."}
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir {selectedCount} contato{selectedCount > 1 ? "s" : ""}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
