import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger, PopoverAnchor,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Plus, Search, FileText, Check, ChevronsUpDown, Loader2, List, LayoutGrid, Lock, Trash2, CheckCircle2, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CreateCompanySheet from "@/components/crm/CreateCompanySheet";

// Taxonomia de Equipamentos (Categoria → Marca → Modelos)
const EQUIPMENT_CATEGORIES: { sigla: string; nome: string }[] = [
  { sigla: "TC", nome: "Tomógrafo Computadorizado" },
  { sigla: "RM", nome: "Ressonância Magnética" },
  { sigla: "RX", nome: "Raios X" },
  { sigla: "MAMO", nome: "Mamógrafo" },
  { sigla: "DO", nome: "Densitometria Óssea" },
  { sigla: "HEMO", nome: "Hemodinâmica" },
  { sigla: "ARC", nome: "Arco Cirúrgico" },
  { sigla: "US", nome: "Ultrassom" },
  { sigla: "DR", nome: "Placa DR" },
];

const EQUIPMENT_TREE: Record<string, Record<string, string[]>> = {
  TC: {
    "Canon/Toshiba": ["Aquilion Start", "Aquilion Lightning", "Aquilion Prime", "Aquilion One", "Aquilion LB", "Alexion"],
    "Siemens": ["SOMATOM Emotion", "SOMATOM Scope", "SOMATOM Go.Up", "SOMATOM Go.Now", "SOMATOM Go.All", "SOMATOM Perspective", "SOMATOM Definition AS", "SOMATOM Definition Edge", "SOMATOM Drive", "SOMATOM Force"],
    "GE": ["BrightSpeed", "LightSpeed", "Revolution ACT", "Revolution EVO", "Revolution Maxima", "Revolution CT", "Optima CT520", "Optima CT540"],
    "Philips": ["Brilliance 6", "Brilliance 16", "Brilliance 40", "Brilliance 64", "Brilliance Big Bore", "Brilliance iCT", "Incisive CT", "IQon Spectral CT"],
  },
  RM: {
    "Siemens": ["MAGNETOM Free.Max", "MAGNETOM Free.Star", "MAGNETOM Sempra", "MAGNETOM Aera", "MAGNETOM Altea", "MAGNETOM Amira", "MAGNETOM Vida", "MAGNETOM Skyra", "MAGNETOM Prisma"],
    "GE": ["Signa Explorer", "Signa Creator", "Signa Voyager", "Signa Artist", "Signa Premier", "Signa Architect", "Signa Pioneer"],
    "Philips": ["Ingenia 1.5T", "Ingenia 3.0T", "Ingenia Elition", "Achieva", "Intera", "Multiva", "Prodiva"],
    "Canon/Toshiba": ["Vantage Elan", "Vantage Orian", "Vantage Titan", "Vantage Galan", "Vantage Fortian"],
    "Esaote": ["S-scan", "O-scan", "O-scan SMART", "G-scan Brio", "Magnifico Open"],
  },
  RX: {
    "DRGEM": ["GXR-40S", "GXR-SD", "Topaz"],
    "Siemens": ["Multix Fusion", "Multix Impact", "Multix Select", "Ysio Max", "Ysio X.pree"],
    "GE": ["Definium 646", "Definium 656", "Definium Tempo"],
    "Philips": ["DigitalDiagnost", "DuraDiagnost", "CombiDiagnost R90"],
    "Mindray": ["DigiEye 280", "DigiEye 330", "DigiEye 350"],
  },
  MAMO: {
    "Hologic": ["Selenia Dimensions", "3Dimensions", "Lorad M-IV"],
    "GE": ["Senographe Essential", "Senographe Pristina", "Senographe Crystal Nova"],
    "Siemens": ["Mammomat Inspiration", "Mammomat Revelation", "Mammomat Fusion"],
  },
  DO: {
    "Osteosys": ["Dexxum T", "Dexxum 3"],
  },
  HEMO: {
    "Philips": ["Azurion 3", "Azurion 5", "Azurion 7", "Allura Xper FD10", "Allura Xper FD20"],
    "Siemens": ["Artis Zee", "Artis Q", "Artis Q.zen", "Artis icono"],
    "GE": ["Innova IGS 520", "Innova IGS 530", "Discovery IGS 730"],
  },
  ARC: {
    "GE": ["OEC One", "OEC Elite CFD"],
    "Siemens": ["Cios Select", "Cios Alpha", "Cios Spin", "Cios Flow"],
    "Philips": ["Zenition 50", "Zenition 70", "BV Pulsera", "BV Endura"],
  },
  US: {
    "GE": ["LOGIQ P9", "LOGIQ E10", "LOGIQ Fortis", "Voluson E8", "Voluson E10", "Versana Premier", "Vivid E95"],
    "Philips": ["Affiniti 50", "Affiniti 70", "EPIQ 5", "EPIQ 7", "ClearVue 650", "CX50"],
    "Siemens": ["Acuson Redwood", "Acuson Juniper", "Acuson Sequoia"],
    "Canon": ["Aplio a450", "Aplio i600", "Xario 200G"],
  },
  DR: {
    "Mindray": ["RetroPad 35x43", "RetroPad 43x43"],
    "Rayance": ["Rayence 1417WCC", "Rayence 1717SCC", "Rayence 1717WCC"],
  },
};

// Remove acentos e caracteres especiais, retorna em MAIÚSCULAS
const normalizeUpper = (v: string) =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const TIPO_OPTIONS = [
  "Aplicação / Treinamento",
  "Armazenamento de equipamento",
  "Contrato de manutenção de mão de obra",
  "Contrato de manutenção de mão de obra + peças",
  "Contrato de manutenção de mão de obra + especiais",
  "Descarte de equipamento",
  "Locação de peças, bobinas e equipamentos",
  "Projeto Site Planning",
  "Reparo de peças e bobinas",
  "Revitalização de equipamento",
  "Reinstalação de Software",
  "Serviço de Blindagem",
  "Serviço de Ramping Up",
  "Serviço de Ramping Down",
  "Serviço de Shimming",
  "Serviço de Transporte",
  "Venda de peças",
  "Venda de equipamento",
  "Visita Técnica (Acesso remoto)",
  "Visita Técnica (Manutenção Corretiva)",
  "Visita Técnica (Manutenção Preventiva)",
  "Desmontagem de equipamento",
  "Montagem de equipamento",
];

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  aprovada: "bg-green-100 text-green-800",
  reprovada: "bg-red-100 text-red-800",
};

const emptyForm = {
  tipo: "",
  empresa: "",
  cnpj: "",
  cpf: "",
  cliente_nome: "",
  telefone: "",
  // Endereço fiscal (empresa)
  cep_empresa: "",
  rua_empresa: "",
  bairro_empresa: "",
  cidade_empresa: "",
  uf_empresa: "",
  // Endereço de atendimento
  cep: "",
  rua: "",
  bairro: "",
  cidade: "",
  uf: "",
  complemento: "",
  endereco: "",
  contato: "",
  responsavel_comercial: "",
  email_1: "",
  email_2: "",
  equipamento: "",
  categoria: "",
  marca: "",
  marca_outro: "",
  modelo: "",
  modelo_outro: "",
  itens_inclusos: "",
  itens_nao_inclusos: "",
  preco: "",
  condicoes_pagamento: "",
  tempo_garantia: "",
  frete: "",
  comissao: "",
  origem: "",
  origem_outro: "",
  business_line: "",
  requester_name: "",
  piece_source: "",
  supplier_name: "",
  supplier_cost: "",
  status: "pendente",
  observacoes: "",
};

const maskCNPJ = (v: string) =>
  v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

const isValidCNPJ = (v: string) => /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(v);

const maskCPF = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");

const isValidCPF = (v: string) => /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(v);

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""));
  }
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
};

const isValidPhone = (v: string) => /^\(\d{2}\) \d{4,5}-\d{4}$/.test(v);

const maskCEP = (v: string) =>
  v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

const maskCurrency = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  const num = Number(digits) / 100;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const parseCurrency = (v: string) => {
  if (!v) return null;
  return Number(v.replace(/\D/g, "")) / 100;
};

const maskPercent = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  return `${digits}%`;
};

const parsePercent = (v: string) => {
  if (!v) return null;
  return Number(v.replace(/\D/g, ""));
};

export default function RequestsList() {
  const { user, role } = useAuth();
  const [isCeo, setIsCeo] = useState(false);
  // CEO/Admin podem aprovar/reprovar/excluir.
  const canEditStatus = role === "admin" || role === "gestor" || isCeo;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [tipoOpen, setTipoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [docType, setDocType] = useState<"cnpj" | "cpf">("cnpj");
  const [form, setForm] = useState({ ...emptyForm });
  const [detail, setDetail] = useState<any | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestKind, setSuggestKind] = useState<"contato" | "empresa">("contato");
  const [suggestData, setSuggestData] = useState<{ nome: string; doc: string; telefone: string; email: string; endereco?: string } | null>(null);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ nome: "", cpf: "", telefone: "", email: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [companyInitial, setCompanyInitial] = useState<any>(null);
  const [sellers, setSellers] = useState<{ id: string; nome: string }[]>([]);
  const [vendedorMode, setVendedorMode] = useState<"select" | "other">("select");
  const [dismissedDocs, setDismissedDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, nome, setor")
        .order("nome", { ascending: true });
      const list = (data || []).filter((p: any) => p.nome);
      const comercial = list.filter((p: any) => (p.setor || "").toString().toLowerCase() === "comercial");
      setSellers((comercial.length ? comercial : list).map((p: any) => ({ id: p.id, nome: p.nome })));
    })();
  }, []);

  // Sugere cadastro assim que CPF/CNPJ válido for digitado e não existir no sistema
  useEffect(() => {
    if (!open) return;
    if (suggestOpen) return;
    const timer = setTimeout(async () => {
      try {
        if (docType === "cnpj") {
          if (!isValidCNPJ(form.cnpj)) return;
          const digits = form.cnpj.replace(/\D/g, "");
          if (dismissedDocs.has(digits)) return;
          const { data } = await (supabase as any)
            .from("rd_organizations").select("id")
            .or(`cnpj.eq.${form.cnpj},cnpj.eq.${digits}`)
            .limit(1);
          if (data && data.length) return;
          const endereco = `${form.rua}, ${form.complemento} - ${form.bairro}, ${form.cidade}${form.uf ? "/" + form.uf : ""}${form.cep ? " - CEP " + form.cep : ""}`;
          setSuggestKind("empresa");
          setSuggestData({
            nome: form.empresa,
            doc: form.cnpj,
            telefone: form.telefone,
            email: form.email_1,
            endereco: form.rua ? endereco : "",
          });
          setSuggestOpen(true);
        } else {
          if (!isValidCPF(form.cpf)) return;
          const digits = form.cpf.replace(/\D/g, "");
          if (dismissedDocs.has(digits)) return;
          const { data } = await (supabase as any)
            .from("commercial_requests").select("id").eq("cnpj", digits).limit(1);
          if (data && data.length) return;
          setSuggestKind("contato");
          setSuggestData({
            nome: form.cliente_nome,
            doc: form.cpf,
            telefone: form.telefone,
            email: form.email_1,
          });
          setSuggestOpen(true);
        }
      } catch (err) {
        console.warn("[suggest-early] check failed", err);
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cnpj, form.cpf, docType, open, dismissedDocs]);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).rpc("is_ceo_or_admin", { _user: user.id });
      setIsCeo(!!data);
    })();
  }, [user]);

  // Deep-link: /crm/requests?request=<id>&view=kanban (from notifications)
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "kanban" || viewParam === "list") setView(viewParam);
  }, [searchParams]);

  useEffect(() => {
    const reqId = searchParams.get("request");
    if (!reqId) return;
    if (detail?.id === reqId) return;

    let cancelled = false;
    (async () => {
      // 1) Try to find in the already-loaded list
      const found = items.find((r) => r.id === reqId);
      if (found) {
        setDetail(found);
      } else {
        // 2) Fallback: fetch directly (avoids RLS/timing edge cases)
        const { data, error } = await (supabase as any)
          .from("commercial_requests")
          .select("*")
          .eq("id", reqId)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          toast.error("Solicitação não encontrada ou sem permissão de acesso.");
        } else {
          setDetail(data);
          // Merge into the list so approve/reject updates render correctly
          setItems((prev) => (prev.some((x) => x.id === data.id) ? prev : [data, ...prev]));
        }
      }
      // Clean the url params after opening
      const next = new URLSearchParams(searchParams);
      next.delete("request");
      next.delete("view");
      setSearchParams(next, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items]);

  const fetchWithTimeout = async (url: string, ms = 5000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  };

  const fetchCEP = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    setCepError(null);

    // 1) ViaCEP
    try {
      const res = await fetchWithTimeout(`https://viacep.com.br/ws/${clean}/json/`, 5000);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setForm((f) => ({
            ...f,
            rua: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            uf: data.uf || "",
          }));
          setCepLoading(false);
          return;
        }
      }
    } catch {
      /* fallback */
    }

    // 2) BrasilAPI fallback
    try {
      const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${clean}`, 5000);
      if (res.ok) {
        const data = await res.json();
        setForm((f) => ({
          ...f,
          rua: data.street || "",
          bairro: data.neighborhood || "",
          cidade: data.city || "",
          uf: data.state || "",
        }));
        setCepLoading(false);
        return;
      }
    } catch {
      /* fall through */
    }

    setCepError("Não foi possível buscar o endereço automaticamente, preencha manualmente");
    setCepLoading(false);
  };

  // Normaliza a resposta de diferentes provedores públicos de CNPJ
  // em um formato único usado pelo formulário.
  const normalizeCnpjPayload = (raw: any) => {
    if (!raw) return null;
    // BrasilAPI: { razao_social, nome_fantasia, cep, logradouro, bairro, municipio, uf, ddd_telefone_1, email, ... }
    // publica.cnpj.ws: { razao_social, estabelecimento: { cep, logradouro, bairro, cidade:{nome}, estado:{sigla}, ddd1, telefone1, email } }
    // receitaws-proxy: { nome, fantasia, cep, logradouro, bairro, municipio, uf, telefone, email }
    const est = raw?.estabelecimento || {};
    const razao =
      raw?.razao_social ||
      raw?.nome ||
      est?.nome_fantasia ||
      raw?.nome_fantasia ||
      "";
    const cep = raw?.cep || est?.cep || "";
    const logradouro = raw?.logradouro || est?.logradouro || "";
    const numero = raw?.numero || est?.numero || "";
    const complemento = raw?.complemento || est?.complemento || "";
    const bairro = raw?.bairro || est?.bairro || "";
    const municipio = raw?.municipio || est?.cidade?.nome || est?.municipio || "";
    const uf = raw?.uf || est?.estado?.sigla || est?.uf || "";
    const telefone =
      raw?.ddd_telefone_1 ||
      raw?.telefone ||
      (est?.ddd1 && est?.telefone1 ? `${est.ddd1}${est.telefone1}` : "") ||
      "";
    const email = raw?.email || est?.email || "";
    if (!razao && !cep && !logradouro) return null;
    return { razao, cep, logradouro, numero, complemento, bairro, municipio, uf, telefone, email };
  };

  // 0) Busca local — verifica se já existe empresa cadastrada com esse CNPJ
  const fetchLocalByCnpj = async (cnpj: string): Promise<boolean> => {
    const masked = maskCNPJ(cnpj);
    // Tenta em commercial_requests (mais completo — tem endereço fiscal)
    const { data: reqs } = await (supabase as any)
      .from("commercial_requests")
      .select("empresa, cnpj, contato, telefone, email_1, endereco")
      .eq("cnpj", masked)
      .order("created_at", { ascending: false })
      .limit(1);
    const prev = reqs?.[0];
    if (prev) {
      setForm((f) => ({
        ...f,
        empresa: prev.empresa || f.empresa,
        contato: f.contato || prev.contato || "",
        telefone: f.telefone || prev.telefone || "",
        email_1: f.email_1 || prev.email_1 || "",
      }));
      toast.success("Empresa localizada no cadastro local");
      return true;
    }
    // Fallback: rd_organizations
    const { data: orgs } = await (supabase as any)
      .from("rd_organizations")
      .select("name, cnpj, email, phone")
      .eq("cnpj", masked)
      .limit(1);
    const org = orgs?.[0];
    if (org) {
      setForm((f) => ({
        ...f,
        empresa: org.name || f.empresa,
        telefone: f.telefone || (org.phone ? maskPhone(org.phone) : ""),
        email_1: f.email_1 || org.email || "",
      }));
      toast.success("Empresa localizada no cadastro local");
      return true;
    }
    return false;
  };

  const fetchCNPJ = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return;
    setCnpjLoading(true);

    // 1) Primeiro tenta no banco local
    try {
      const localHit = await fetchLocalByCnpj(cnpj);
      if (localHit) {
        setCnpjLoading(false);
        return;
      }
    } catch {
      /* segue para provedores externos */
    }

    // Cascata de provedores públicos (sem custo/token). Retornamos na 1ª que responder.
    const providers: Array<() => Promise<any>> = [
      // 1) BrasilAPI (Receita Federal — CORS aberto)
      async () => {
        const r = await fetchWithTimeout(
          `https://brasilapi.com.br/api/cnpj/v1/${clean}`,
          6000
        );
        if (!r.ok) throw new Error("brasilapi");
        return r.json();
      },
      // 2) publica.cnpj.ws (Receita Federal — CORS aberto, gratuita)
      async () => {
        const r = await fetchWithTimeout(
          `https://publica.cnpj.ws/cnpj/${clean}`,
          6000
        );
        if (!r.ok) throw new Error("cnpjws");
        return r.json();
      },
      // 3) Proxy interno (ReceitaWS) — fallback
      async () => {
        const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const r = await fetchWithTimeout(
          `https://${projectId}.supabase.co/functions/v1/receitaws-proxy?cnpj=${clean}`,
          8000
        );
        if (!r.ok) throw new Error("receitaws");
        return r.json();
      },
    ];

    let normalized: ReturnType<typeof normalizeCnpjPayload> = null;
    for (const p of providers) {
      try {
        const raw = await p();
        normalized = normalizeCnpjPayload(raw);
        if (normalized) break;
      } catch {
        // segue para próximo provedor
      }
    }

    if (!normalized) {
      setCnpjLoading(false);
      toast.error("Não foi possível consultar este CNPJ agora. Preencha manualmente.");
      return;
    }

    setForm((f) => ({
      ...f,
      empresa: normalized!.razao || f.empresa,
      cep_empresa: normalized!.cep ? maskCEP(String(normalized!.cep)) : f.cep_empresa,
      rua_empresa: normalized!.logradouro || f.rua_empresa,
      bairro_empresa: normalized!.bairro || f.bairro_empresa,
      cidade_empresa: normalized!.municipio || f.cidade_empresa,
      uf_empresa: normalized!.uf || f.uf_empresa,
      telefone: f.telefone || normalized!.telefone || "",
      email_1: f.email_1 || normalized!.email || "",
    }));
    toast.success("Dados do CNPJ preenchidos automaticamente");
    setCnpjLoading(false);
  };

  // Sugestões locais para empresas (nome) e contatos (nome)
  type CompanySug = {
    empresa: string;
    cnpj?: string;
    telefone?: string;
    email_1?: string;
    contato?: string;
    cep?: string;
    rua?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
  type ContactSug = { nome: string; empresa?: string; cpf?: string; telefone?: string; email?: string };
  const [companySugs, setCompanySugs] = useState<CompanySug[]>([]);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [contactSugs, setContactSugs] = useState<ContactSug[]>([]);
  const [contactOpen, setContactOpen] = useState(false);

  // Heurística para separar um endereço em partes (CEP, Rua, Bairro, Cidade, UF).
  // Aceita formatos livres tipo "RUA X, 123, BAIRRO, CIDADE, SP, 18910-102".
  const parseAddress = (raw: any): { cep?: string; rua?: string; bairro?: string; cidade?: string; uf?: string } => {
    if (!raw) return {};
    const str = typeof raw === "string" ? raw : (raw?.address || raw?.endereco || "");
    if (!str || typeof str !== "string") return {};
    const parts = str.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
    let cep: string | undefined;
    let uf: string | undefined;
    const rest: string[] = [];
    for (const p of parts) {
      const digits = p.replace(/\D/g, "");
      if (!cep && digits.length === 8) { cep = digits; continue; }
      if (!uf && /^[A-Z]{2}$/i.test(p)) { uf = p.toUpperCase(); continue; }
      rest.push(p);
    }
    // rest: [rua, bairro, cidade] em ordem provável
    let rua: string | undefined;
    let bairro: string | undefined;
    let cidade: string | undefined;
    if (rest.length === 1) {
      rua = rest[0];
    } else if (rest.length === 2) {
      bairro = rest[0]; cidade = rest[1];
    } else if (rest.length >= 3) {
      cidade = rest[rest.length - 1];
      bairro = rest[rest.length - 2];
      rua = rest.slice(0, rest.length - 2).join(", ");
    }
    return { cep, rua, bairro, cidade, uf };
  };

  useEffect(() => {
    const q = form.empresa.trim();
    if (docType !== "cnpj" || q.length < 2) { setCompanySugs([]); return; }
    const t = setTimeout(async () => {
      const [{ data: reqs }, { data: orgs }] = await Promise.all([
        (supabase as any)
          .from("commercial_requests")
          .select("empresa, cnpj, contato, telefone, email_1, endereco")
          .ilike("empresa", `%${q}%`)
          .not("cnpj", "is", null)
          .neq("cnpj", "")
          .order("created_at", { ascending: false })
          .limit(15),
        (supabase as any)
          .from("rd_organizations")
          .select("name, cnpj, phone, email, raw_payload")
          .ilike("name", `%${q}%`)
          .limit(15),
      ]);
      const map = new Map<string, CompanySug>();
      (reqs || []).forEach((r: any) => {
        const key = (r.empresa || "").toLowerCase().trim();
        if (!key || map.has(key)) return;
        const addr = parseAddress(r.endereco);
        map.set(key, {
          empresa: r.empresa,
          cnpj: r.cnpj,
          telefone: r.telefone,
          email_1: r.email_1,
          contato: r.contato,
          ...addr,
        });
      });
      (orgs || []).forEach((o: any) => {
        const key = (o.name || "").toLowerCase().trim();
        if (!key || map.has(key)) return;
        const addr = parseAddress(o.raw_payload);
        map.set(key, {
          empresa: o.name,
          cnpj: o.cnpj,
          telefone: o.phone ? maskPhone(o.phone) : "",
          email_1: o.email,
          ...addr,
        });
      });
      setCompanySugs(Array.from(map.values()).slice(0, 8));
    }, 250);
    return () => clearTimeout(t);
  }, [form.empresa, docType]);

  useEffect(() => {
    const q = form.cliente_nome.trim();
    if (docType !== "cpf" || q.length < 2) { setContactSugs([]); return; }
    const t = setTimeout(async () => {
      // No fluxo CPF, o nome do cliente é armazenado em "empresa" e o CPF em "cnpj"
      // dentro de commercial_requests. rd_contacts não tem CPF cadastrado.
      const [{ data: reqs }, { data: cts }] = await Promise.all([
        (supabase as any)
          .from("commercial_requests")
          .select("empresa, contato, telefone, email_1, cnpj")
          .ilike("empresa", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(15),
        (supabase as any)
          .from("rd_contacts")
          .select("name, phone, email, organization_rd_id")
          .ilike("name", `%${q}%`)
          .limit(15),
      ]);
      // Buscar nomes das organizações vinculadas aos contatos RD
      const orgIds = Array.from(
        new Set((cts || []).map((c: any) => c.organization_rd_id).filter(Boolean))
      );
      const orgMap = new Map<string, string>();
      if (orgIds.length) {
        const { data: orgs } = await (supabase as any)
          .from("rd_organizations")
          .select("rd_id, name")
          .in("rd_id", orgIds);
        (orgs || []).forEach((o: any) => orgMap.set(o.rd_id, o.name));
      }
      const map = new Map<string, ContactSug>();
      (reqs || []).forEach((r: any) => {
        const key = (r.contato || r.empresa || "").toLowerCase().trim();
        if (!key || map.has(key)) return;
        const digits = String(r.cnpj || "").replace(/\D/g, "");
        const cpfVal = digits.length === 11 ? digits : undefined;
        map.set(key, {
          nome: r.contato || r.empresa,
          empresa: r.contato ? r.empresa : undefined,
          cpf: cpfVal,
          telefone: r.telefone,
          email: r.email_1,
        });
      });
      (cts || []).forEach((c: any) => {
        const key = (c.name || "").toLowerCase().trim();
        if (!key || map.has(key)) return;
        map.set(key, {
          nome: c.name,
          empresa: c.organization_rd_id ? orgMap.get(c.organization_rd_id) : undefined,
          telefone: c.phone ? maskPhone(c.phone) : "",
          email: c.email,
        });
      });
      setContactSugs(Array.from(map.values()).slice(0, 8));
    }, 250);
    return () => clearTimeout(t);
  }, [form.cliente_nome, docType]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("commercial_requests")
      .select("*")
      .neq("status", "lixeira")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar solicitações");
    setItems(data || []);
    setLoading(false);
  };

  const softDelete = async (r: any) => {
    if (!canEditStatus) return;
    if (!window.confirm("Tem certeza que deseja excluir esta solicitação? Ela será movida para a Lixeira.")) return;
    const prevStatus = r.status || "pendente";
    const marker = `[TRASH_PREV:${prevStatus}|${new Date().toISOString()}]`;
    const nextObs = r.observacoes ? `${marker}\n${r.observacoes}` : marker;
    const { error } = await (supabase as any)
      .from("commercial_requests")
      .update({ status: "lixeira", observacoes: nextObs, deleted_at: new Date().toISOString(), deleted_by: user?.id })
      .eq("id", r.id);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    setDetail(null);
    toast.success("Solicitação movida para a Lixeira");
  };


  useEffect(() => {
    if (!user) { setLoading(false); return; }
    load();
  }, [user]);

  // Aprovação via RPC segura (SECURITY DEFINER). Cria o lead no funil de vendas.
  const approveRequest = async (r: any) => {
    if (!canEditStatus) return;
    if (r.status !== "pendente") return;
    setStatusSaving(true);
    const { data, error } = await (supabase as any).rpc("approve_commercial_request", {
      request_id: r.id,
    });
    setStatusSaving(false);
    if (error) return toast.error("Erro ao aprovar: " + error.message);
    setItems((prev) =>
      prev.map((x) =>
        x.id === r.id
          ? { ...x, status: "aprovada", converted_lead_id: data, approved_at: new Date().toISOString() }
          : x
      )
    );
    setDetail((d: any) =>
      d && d.id === r.id
        ? { ...d, status: "aprovada", converted_lead_id: data, approved_at: new Date().toISOString() }
        : d
    );
    toast.success("Solicitação aprovada — negócio criado em Vendas › Novo Negócio", {
      action: {
        label: "Ver no Kanban",
        onClick: () => window.location.assign("/crm/kanban"),
      },
    });
  };

  const openRejectDialog = (r: any) => {
    if (!canEditStatus) return;
    if (r.status !== "pendente") return;
    setRejectTarget(r);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) return toast.error("Informe o motivo da reprovação");
    setStatusSaving(true);
    const { error } = await (supabase as any).rpc("reject_commercial_request", {
      request_id: rejectTarget.id,
      reason,
    });
    setStatusSaving(false);
    if (error) return toast.error("Erro ao reprovar: " + error.message);
    setItems((prev) =>
      prev.map((x) =>
        x.id === rejectTarget.id
          ? { ...x, status: "reprovada", rejection_reason: reason, rejected_at: new Date().toISOString() }
          : x
      )
    );
    setDetail((d: any) =>
      d && d.id === rejectTarget.id
        ? { ...d, status: "reprovada", rejection_reason: reason, rejected_at: new Date().toISOString() }
        : d
    );
    setRejectOpen(false);
    setRejectTarget(null);
    setRejectReason("");
    toast.success("Solicitação reprovada");
  };

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        r.empresa?.toLowerCase().includes(s) ||
        r.equipamento?.toLowerCase().includes(s) ||
        r.tipo?.toLowerCase().includes(s)
      );
    });
  }, [items, search, filterStatus]);

  const kpis = useMemo(() => {
    const total = items.length;
    const pendentes = items.filter((i) => i.status === "pendente").length;
    const aprovadas = items.filter((i) => i.status === "aprovada").length;
    const reprovadas = items.filter((i) => i.status === "reprovada").length;
    const scoped = filterStatus === "all" ? items : items.filter((i) => i.status === filterStatus);
    const valor = scoped.reduce((sum, i) => sum + (Number(i.preco) || 0), 0);
    return { total, pendentes, aprovadas, reprovadas, valor };
  }, [items, filterStatus]);

  const valorLabel =
    filterStatus === "pendente" ? "Valor pendentes"
    : filterStatus === "aprovada" ? "Valor aprovadas"
    : filterStatus === "reprovada" ? "Valor reprovadas"
    : "Valor total";


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // CPF x CNPJ — mutuamente exclusivos, ao menos um obrigatório
    const hasCnpj = !!form.cnpj.trim();
    const hasCpf = !!form.cpf.trim();
    if (!hasCnpj && !hasCpf) {
      return toast.error("Informe CNPJ ou CPF");
    }
    if (hasCnpj && hasCpf) {
      return toast.error("Preencha apenas um: CNPJ ou CPF");
    }
    if (hasCnpj && !isValidCNPJ(form.cnpj)) {
      return toast.error("CNPJ inválido (use 00.000.000/0000-00)");
    }
    if (hasCpf && !isValidCPF(form.cpf)) {
      return toast.error("CPF inválido (use 000.000.000-00)");
    }

    // Nome (empresa ou cliente) conforme o caminho escolhido
    if (hasCnpj && !form.empresa.trim()) {
      return toast.error("Campo obrigatório: Nome da empresa");
    }
    if (hasCpf && !form.cliente_nome.trim()) {
      return toast.error("Campo obrigatório: Nome do cliente");
    }

    const required: [string, string][] = [
      ["tipo", "Tipo"],
      ["telefone", "Telefone"],
      ["cep", "CEP (atendimento)"],
      ["rua", "Rua (atendimento)"],
      ["bairro", "Bairro (atendimento)"],
      ["cidade", "Cidade (atendimento)"],
      ["complemento", "Complemento (atendimento)"],
      ["contato", "Contato"],
      ["responsavel_comercial", "Vendedor(a)"],
      ["email_1", "E-mail 1"],
      ["categoria", "Categoria"],
      ["marca", "Marca"],
      ["modelo", "Modelo"],
      ["itens_inclusos", "Itens inclusos"],
      ["itens_nao_inclusos", "Itens não inclusos"],
      ["preco", "Preço"],
      ["condicoes_pagamento", "Condições de pagamento"],
      ["tempo_garantia", "Tempo de garantia"],
      ["frete", "Frete"],
      ["comissao", "Comissão"],
      ["origem", "Origem"],
      ["business_line", "Linha de negócio"],
      
      ["status", "Status"],
      ["observacoes", "Observações"],
    ];
    for (const [k, label] of required) {
      if (!String((form as any)[k] ?? "").trim()) {
        return toast.error(`Campo obrigatório: ${label}`);
      }
    }
    if (form.origem === "Outro" && !form.origem_outro.trim()) {
      return toast.error("Campo obrigatório: Especifique a origem");
    }
    if (form.marca === "OUTRO" && !form.marca_outro.trim()) {
      return toast.error("Campo obrigatório: Especifique a marca");
    }
    if (form.modelo === "OUTRO" && !form.modelo_outro.trim()) {
      return toast.error("Campo obrigatório: Especifique o modelo");
    }
    if (!isValidPhone(form.telefone)) return toast.error("Telefone inválido");

    // Monta equipamento normalizado (MAIÚSCULAS, sem acentos): "CATEGORIA - MARCA - MODELO"
    const marcaFinal = form.marca === "OUTRO" ? form.marca_outro : form.marca;
    const modeloFinal = form.modelo === "OUTRO" ? form.modelo_outro : form.modelo;
    const equipamentoNorm = `${normalizeUpper(form.categoria)} - ${normalizeUpper(marcaFinal)} - ${normalizeUpper(modeloFinal)}`;

    setSaving(true);
    const enderecoAtendimento = `${form.rua}, ${form.complemento} - ${form.bairro}, ${form.cidade}${form.uf ? "/" + form.uf : ""} - CEP ${form.cep}`;
    const payload: any = {
      ...form,
      // Se for CPF, armazena o nome do cliente no campo "empresa" (compatibilidade de schema)
      empresa: hasCnpj ? form.empresa : form.cliente_nome,
      cnpj: hasCnpj ? form.cnpj : "",
      endereco: enderecoAtendimento,
      equipamento: equipamentoNorm,
      preco: parseCurrency(form.preco),
      comissao: parsePercent(form.comissao),
      origem: form.origem === "Outro" ? form.origem_outro : form.origem,
      customer_state: form.uf,
      status_detail: "pendente_gestao",
      supplier_cost: form.supplier_cost ? parseCurrency(form.supplier_cost) : null,
      user_id: user!.id,
    };
    // Remove campos auxiliares que não existem na tabela
    delete payload.cpf;
    delete payload.cliente_nome;
    delete payload.cep; delete payload.rua; delete payload.bairro;
    delete payload.cidade; delete payload.uf; delete payload.complemento;
    delete payload.cep_empresa; delete payload.rua_empresa;
    delete payload.bairro_empresa; delete payload.cidade_empresa; delete payload.uf_empresa;
    delete payload.origem_outro;
    delete payload.categoria; delete payload.marca; delete payload.marca_outro;
    delete payload.modelo; delete payload.modelo_outro;
    // Toda nova solicitação nasce como PENDENTE — aguardando aprovação do CEO.
    payload.status = "pendente";
    const { data: inserted, error } = await (supabase as any)
      .from("commercial_requests")
      .insert(payload)
      .select("id, empresa, preco")
      .maybeSingle();
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Solicitação enviada para aprovação", {
      description: "Os CEOs foram notificados para analisar.",
    });
    // Fire-and-forget: push notification to CEOs. The internal notification
    // was already created by the DB trigger.
    try {
      if (inserted?.id) {
        const bodyText =
          `Nova solicitação` +
          (inserted.empresa ? ` · ${inserted.empresa}` : "") +
          (inserted.preco ? ` · R$ ${Number(inserted.preco).toLocaleString("pt-BR")}` : "") +
          " — aguardando análise.";
        supabase.functions.invoke("notify-ceos-push", {
          body: { request_id: inserted.id, body: bodyText },
        }).catch((err) => console.warn("[push] notify-ceos-push failed", err));
      }
    } catch (e) { console.warn("[push] dispatch failed", e); }

    // Sugestão de cadastro agora ocorre durante a digitação do CPF/CNPJ (ver useEffect acima).


    setOpen(false);
    setForm({ ...emptyForm });
    load();
  };

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Solicitações
            </h1>
            <p className="text-sm text-muted-foreground">
              Registre e acompanhe solicitações comerciais de clientes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-input bg-background p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "px-2.5 py-1.5 rounded-[5px] transition-colors",
                  view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Visualização em lista"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("kanban")}
                className={cn(
                  "px-2.5 py-1.5 rounded-[5px] transition-colors",
                  view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Visualização em kanban"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <Button onClick={() => setOpen(true)} className="gap-1">
              <Plus className="mr-2 h-4 w-4" />
              Nova Solicitação
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi
            label="Total"
            value={kpis.total}
            active={filterStatus === "all"}
            onClick={() => setFilterStatus("all")}
          />
          <Kpi
            label="Pendentes da gestão"
            value={kpis.pendentes}
            tone="amber"
            active={filterStatus === "pendente"}
            onClick={() => setFilterStatus(filterStatus === "pendente" ? "all" : "pendente")}
          />
          <Kpi
            label="Aprovadas"
            value={kpis.aprovadas}
            tone="emerald"
            active={filterStatus === "aprovada"}
            onClick={() => setFilterStatus(filterStatus === "aprovada" ? "all" : "aprovada")}
          />
          <Kpi
            label="Reprovadas"
            value={kpis.reprovadas}
            tone="rose"
            active={filterStatus === "reprovada"}
            onClick={() => setFilterStatus(filterStatus === "reprovada" ? "all" : "reprovada")}
          />
          <Kpi
            className="col-span-2 md:col-span-1"
            label={valorLabel}
            value={kpis.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            tone="cyan"
          />

        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa, equipamento ou tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente(s) da gestão</SelectItem>
                <SelectItem value="aprovada">Aprovada(s)</SelectItem>
                <SelectItem value="reprovada">Reprovada(s)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {view === "list" ? (
        /* Tabela */
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {loading ? "Carregando..." : `${filtered.length} solicitação(ões)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground p-6">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma solicitação encontrada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      {filterStatus === "reprovada" && <TableHead>Motivo</TableHead>}
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow
                        key={r.id}
                        onDoubleClick={() => setDetail(r)}
                        className="cursor-pointer select-none"
                      >
                        <TableCell className="font-medium max-w-[240px] truncate">
                          {r.tipo}
                        </TableCell>
                        <TableCell>{r.empresa}</TableCell>
                        <TableCell className="text-muted-foreground">{r.equipamento || "-"}</TableCell>
                        <TableCell>
                          {r.preco
                            ? Number(r.preco).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[r.status]}>
                            {r.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        {filterStatus === "reprovada" && (
                          <TableCell
                            className="text-sm text-red-700 max-w-[320px] truncate"
                            title={r.rejection_reason || ""}
                          >
                            {r.rejection_reason || "-"}
                          </TableCell>
                        )}
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(r.created_at), "dd/MM/yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        ) : (
        /* Kanban */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["pendente", "aprovada", "reprovada"] as const).map((col) => {
            const colItems = filtered.filter((r) => r.status === col);
            return (
              <div
                key={col}
                onDragOver={(e) => { if (canEditStatus) e.preventDefault(); }}
                onDrop={async () => {
                  if (!canEditStatus || !draggedId) return;
                  const r = items.find((x) => x.id === draggedId);
                  setDraggedId(null);
                  if (!r || r.status !== "pendente") return;
                  if (col === "aprovada") await approveRequest(r);
                  else if (col === "reprovada") openRejectDialog(r);
                }}
                className={cn(
                  "bg-muted/30 rounded-xl border-t-4 p-3 min-h-[300px]",
                  col === "pendente" ? "border-t-yellow-400"
                    : col === "aprovada" ? "border-t-green-400"
                    : "border-t-red-400",
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold capitalize">{col}</h3>
                  <span className="text-xs bg-muted rounded-full px-2 py-0.5">{colItems.length}</span>
                </div>
                <div className="space-y-2">
                  {colItems.map((r) => (
                    <div
                      key={r.id}
                      draggable={canEditStatus}
                      onDragStart={() => canEditStatus && setDraggedId(r.id)}
                      onDoubleClick={() => setDetail(r)}
                      className={cn(
                        "p-3 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow select-none",
                        canEditStatus ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                      )}
                    >
                      <p className="text-xs text-muted-foreground truncate">{r.tipo}</p>
                      <p className="text-sm font-medium truncate">{r.empresa}</p>
                      {r.equipamento && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.equipamento}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-hexa-green">
                          {r.preco
                            ? Number(r.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "dd/MM/yyyy")}
                        </span>
                      </div>
                    </div>
                  ))}
                  {colItems.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhuma solicitação</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Modal nova solicitação */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identificação */}
            <Section title="Identificação">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo *</Label>
                  <Popover open={tipoOpen} onOpenChange={setTipoOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        <span className={cn("truncate", !form.tipo && "text-muted-foreground")}>
                          {form.tipo || "Digite para filtrar..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Digite o tipo..." />
                        <CommandList>
                          <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                          <CommandGroup>
                            {TIPO_OPTIONS.map((t) => (
                              <CommandItem
                                key={t}
                                value={t}
                                onSelect={() => {
                                  setForm({ ...form, tipo: t });
                                  setTipoOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.tipo === t ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {t}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Tipo de documento *</Label>
                  <div className="mt-1 inline-flex rounded-md border border-input bg-background p-0.5">
                    {(["cnpj", "cpf"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (docType === opt) return;
                          setDocType(opt);
                          setForm({
                            ...form,
                            cnpj: "",
                            cpf: "",
                            empresa: "",
                            cep_empresa: "",
                            rua_empresa: "",
                            bairro_empresa: "",
                            cidade_empresa: "",
                            cliente_nome: "",
                          });
                        }}
                        className={cn(
                          "px-4 py-1.5 text-sm font-medium rounded-[5px] transition-colors",
                          docType === opt
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        aria-pressed={docType === opt}
                      >
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {docType === "cnpj" ? (
                    <Field label="CNPJ">
                      <Input
                        placeholder="00.000.000/0000-00"
                        value={form.cnpj}
                        disabled={cnpjLoading}
                        onChange={(e) => {
                          const masked = maskCNPJ(e.target.value);
                          setForm({ ...form, cnpj: masked });
                          if (isValidCNPJ(masked)) fetchCNPJ(masked);
                        }}
                      />
                    </Field>
                  ) : (
                    <Field label="CPF">
                      <Input
                        placeholder="000.000.000-00"
                        value={form.cpf}
                        onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                      />
                    </Field>
                  )}
                  {docType === "cnpj" ? (
                    <Field label="Nome da empresa">
                      <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
                        <PopoverAnchor asChild>
                          <Input
                            placeholder="Buscar empresa cadastrada..."
                            autoComplete="off"
                            value={form.empresa}
                            onFocus={() => { if (form.empresa.trim().length >= 2) setCompanyOpen(true); }}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.trim() === "") {
                                setCompanyOpen(false);
                                setForm((f) => ({ ...f, empresa: "", cnpj: "", telefone: "", email_1: "", contato: "" }));
                              } else {
                                setCompanyOpen(v.trim().length >= 2);
                                setForm((f) => ({ ...f, empresa: v }));
                              }
                            }}
                          />
                        </PopoverAnchor>
                        <PopoverContent
                          className="p-0 w-[--radix-popover-trigger-width]"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          onInteractOutside={(e) => {
                            // Don't close when interacting with the trigger input itself
                            const t = e.target as HTMLElement;
                            if (t?.tagName === "INPUT") e.preventDefault();
                          }}
                        >
                          <Command shouldFilter={false}>
                            <CommandList>
                              {companySugs.length === 0 ? (
                                <CommandEmpty>Nenhuma empresa encontrada</CommandEmpty>
                              ) : (
                                <CommandGroup heading="Empresas cadastradas">
                                  {companySugs.map((s, i) => (
                                    <CommandItem
                                      key={`${s.empresa}-${s.cnpj ?? i}`}
                                      value={`${s.empresa}-${s.cnpj ?? i}`}
                                      onSelect={() => {
                                        setForm((f) => ({
                                          ...f,
                                          empresa: s.empresa,
                                          cnpj: s.cnpj ? maskCNPJ(s.cnpj) : f.cnpj,
                                          telefone: s.telefone || f.telefone,
                                          email_1: s.email_1 || f.email_1,
                                          contato: s.contato || f.contato,
                                          cep_empresa: s.cep ? maskCEP(s.cep) : f.cep_empresa,
                                          rua_empresa: s.rua || f.rua_empresa,
                                          bairro_empresa: s.bairro || f.bairro_empresa,
                                          cidade_empresa: s.cidade || f.cidade_empresa,
                                          uf_empresa: s.uf || f.uf_empresa,
                                        }));
                                        setCompanySugs([]);
                                        setCompanyOpen(false);
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{s.empresa}</span>
                                        {s.cnpj && <span className="text-xs text-muted-foreground">{maskCNPJ(s.cnpj)}</span>}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </Field>
                  ) : (
                    <Field label="Nome do cliente">
                      <Popover open={contactOpen} onOpenChange={setContactOpen}>
                        <PopoverAnchor asChild>
                          <Input
                            placeholder="Buscar contato cadastrado..."
                            autoComplete="off"
                            value={form.cliente_nome}
                            onFocus={() => { if (form.cliente_nome.trim().length >= 2) setContactOpen(true); }}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.trim() === "") {
                                setContactOpen(false);
                                setForm((f) => ({ ...f, cliente_nome: "", cpf: "", telefone: "", email_1: "" }));
                              } else {
                                setContactOpen(v.trim().length >= 2);
                                setForm((f) => ({ ...f, cliente_nome: v }));
                              }
                            }}
                          />
                        </PopoverAnchor>
                        <PopoverContent
                          className="p-0 w-[--radix-popover-trigger-width]"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          onInteractOutside={(e) => {
                            const t = e.target as HTMLElement;
                            if (t?.tagName === "INPUT") e.preventDefault();
                          }}
                        >
                          <Command shouldFilter={false}>
                            <CommandList>
                              {contactSugs.length === 0 ? (
                                <CommandEmpty>Nenhum contato encontrado</CommandEmpty>
                              ) : (
                                <CommandGroup heading="Contatos cadastrados">
                                  {contactSugs.map((s, i) => (
                                    <CommandItem
                                      key={`${s.nome}-${i}`}
                                      value={`${s.nome}-${i}`}
                                      onSelect={() => {
                                        setForm((f) => ({
                                          ...f,
                                          cliente_nome: s.nome,
                                          contato: s.nome || f.contato,
                                          cpf: s.cpf ? maskCPF(s.cpf) : f.cpf,
                                          telefone: s.telefone || f.telefone,
                                          email_1: s.email || f.email_1,
                                        }));
                                        setContactSugs([]);
                                        setContactOpen(false);
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{s.nome}</span>
                                        {s.empresa && (
                                          <span className="text-xs text-muted-foreground">{s.empresa}</span>
                                        )}
                                        {(s.email || s.telefone) && (
                                          <span className="text-xs text-muted-foreground">{[s.email, s.telefone].filter(Boolean).join(" · ")}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </Field>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selecione <strong>CNPJ</strong> (empresa) ou <strong>CPF</strong> (pessoa física).
              </p>
            </Section>

            {/* Dados da empresa OU do cliente (condicional) */}
            {form.cnpj.trim() && (
              <Section title="Dados da Empresa">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <Field label="CEP (fiscal)">
                    <Input
                      placeholder="00000-000"
                      value={form.cep_empresa}
                      onChange={(e) =>
                        setForm({ ...form, cep_empresa: maskCEP(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Rua (fiscal)">
                    <Input
                      value={form.rua_empresa}
                      onChange={(e) => setForm({ ...form, rua_empresa: e.target.value })}
                    />
                  </Field>
                  <Field label="Bairro (fiscal)">
                    <Input
                      value={form.bairro_empresa}
                      onChange={(e) => setForm({ ...form, bairro_empresa: e.target.value })}
                    />
                  </Field>
                  <Field label="Cidade (fiscal)">
                    <Input
                      value={form.cidade_empresa}
                      onChange={(e) => setForm({ ...form, cidade_empresa: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Endereço fiscal preenchido automaticamente pela consulta de CNPJ (editável).
                </p>
              </Section>
            )}


            {/* Endereço de Atendimento */}
            <Section title="Endereço de Atendimento">
              <p className="text-xs text-muted-foreground -mt-2 mb-3">
                Local onde o atendimento/serviço será realizado. Pode ser diferente do endereço fiscal.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="CEP *">
                  <div className="relative">
                    <Input
                      placeholder="00000-000"
                      value={form.cep}
                      onChange={(e) => {
                        const v = maskCEP(e.target.value);
                        setForm({ ...form, cep: v });
                        setCepError(null);
                        if (v.replace(/\D/g, "").length === 8) fetchCEP(v);
                      }}
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {cepError && (
                    <p className="text-xs text-destructive mt-1">{cepError}</p>
                  )}
                </Field>
                <Field label={cepLoading ? "Rua (buscando...)" : "Rua *"}>
                  <Input
                    value={form.rua}
                    onChange={(e) => setForm({ ...form, rua: e.target.value })}
                  />
                </Field>
                <Field label="Bairro *">
                  <Input
                    value={form.bairro}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                  />
                </Field>
                <Field label="Cidade *">
                  <Input
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Complemento * (número, bloco, apto)">
                    <Input
                      value={form.complemento}
                      onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Contato */}
            <Section title="Contato">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Contato *">
                  <Input
                    value={form.contato}
                    onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  />
                </Field>
                <Field label="Telefone *">
                  <Input
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
                  />
                </Field>
                <Field label="E-mail 1 *">
                  <Input
                    type="email"
                    value={form.email_1}
                    onChange={(e) => setForm({ ...form, email_1: e.target.value })}
                  />
                </Field>
                <Field label="E-mail 2">
                  <Input
                    type="email"
                    value={form.email_2}
                    onChange={(e) => setForm({ ...form, email_2: e.target.value })}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Vendedor(a) *">
                    <div className="space-y-2">
                      <Select
                        value={
                          vendedorMode === "other"
                            ? "__other__"
                            : sellers.some((s) => s.nome === form.responsavel_comercial)
                            ? form.responsavel_comercial
                            : form.responsavel_comercial
                            ? "__other__"
                            : ""
                        }
                        onValueChange={(v) => {
                          if (v === "__other__") {
                            setVendedorMode("other");
                            if (sellers.some((s) => s.nome === form.responsavel_comercial)) {
                              setForm({ ...form, responsavel_comercial: "" });
                            }
                          } else {
                            setVendedorMode("select");
                            setForm({ ...form, responsavel_comercial: v });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {sellers.map((s) => (
                            <SelectItem key={s.id} value={s.nome}>
                              {s.nome}
                            </SelectItem>
                          ))}
                          <SelectItem value="__other__">Outro (digitar manualmente)</SelectItem>
                        </SelectContent>
                      </Select>
                      {(vendedorMode === "other" ||
                        (form.responsavel_comercial &&
                          !sellers.some((s) => s.nome === form.responsavel_comercial))) && (
                        <Input
                          placeholder="Digite o nome do vendedor(a)"
                          value={form.responsavel_comercial}
                          onChange={(e) =>
                            setForm({ ...form, responsavel_comercial: e.target.value })
                          }
                        />
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </Section>

            {/* Equipamento */}
            <Section title="Equipamento e Proposta">
              <div className="space-y-4">
                <TooltipProvider delayDuration={200}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Categoria">
                      <Select
                        value={form.categoria}
                        onValueChange={(v) =>
                          setForm({ ...form, categoria: v, marca: "", marca_outro: "", modelo: "", modelo_outro: "" })
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {EQUIPMENT_CATEGORIES.map((c) => (
                            <SelectItem key={c.sigla} value={c.sigla} title={c.nome}>
                              <span className="font-semibold">{c.sigla}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{c.nome}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Marca">
                      {form.marca === "OUTRO" ? (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Digite a marca"
                            value={form.marca_outro}
                            onChange={(e) => setForm({ ...form, marca_outro: e.target.value.toUpperCase() })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setForm({ ...form, marca: "", marca_outro: "", modelo: "", modelo_outro: "" })}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={form.marca}
                          onValueChange={(v) => setForm({ ...form, marca: v, modelo: "", modelo_outro: "" })}
                          disabled={!form.categoria}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={form.categoria ? "Selecione" : "Escolha a categoria"} />
                          </SelectTrigger>
                          <SelectContent>
                            {form.categoria &&
                              Object.keys(EQUIPMENT_TREE[form.categoria] || {}).map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            <SelectItem value="OUTRO">OUTRO</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                    <Field label="Modelo">
                      {form.modelo === "OUTRO" ? (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Digite o modelo"
                            value={form.modelo_outro}
                            onChange={(e) => setForm({ ...form, modelo_outro: e.target.value.toUpperCase() })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setForm({ ...form, modelo: "", modelo_outro: "" })}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Select
                          value={form.modelo}
                          onValueChange={(v) => setForm({ ...form, modelo: v, modelo_outro: "" })}
                          disabled={!form.marca || form.marca === "OUTRO"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={form.marca && form.marca !== "OUTRO" ? "Selecione" : "Escolha a marca"} />
                          </SelectTrigger>
                          <SelectContent>
                            {form.categoria && form.marca && form.marca !== "OUTRO" &&
                              (EQUIPMENT_TREE[form.categoria]?.[form.marca] || []).map((mo) => (
                                <SelectItem key={mo} value={mo}>{mo}</SelectItem>
                              ))}
                            <SelectItem value="OUTRO">OUTRO</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                  </div>
                </TooltipProvider>
                <Field label="Itens inclusos">
                  <Textarea
                    rows={3}
                    value={form.itens_inclusos}
                    onChange={(e) => setForm({ ...form, itens_inclusos: e.target.value })}
                  />
                </Field>
                <Field label="Itens não inclusos">
                  <Textarea
                    rows={3}
                    value={form.itens_nao_inclusos}
                    onChange={(e) => setForm({ ...form, itens_nao_inclusos: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            {/* Condições */}
            <Section title="Condições Comerciais">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Preço">
                  <Input
                    placeholder="R$ 0,00"
                    value={form.preco}
                    onChange={(e) => setForm({ ...form, preco: maskCurrency(e.target.value) })}
                  />
                </Field>
                <Field label="Condições de pagamento">
                  <Input
                    placeholder="Ex: 30/60/90"
                    value={form.condicoes_pagamento}
                    onChange={(e) =>
                      setForm({ ...form, condicoes_pagamento: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tempo de garantia">
                  <Input
                    placeholder="Ex: 12 meses"
                    value={form.tempo_garantia}
                    onChange={(e) => setForm({ ...form, tempo_garantia: e.target.value })}
                  />
                </Field>
                <Field label="Frete *">
                  <Select
                    value={form.frete}
                    onValueChange={(v) => setForm({ ...form, frete: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Incluso">Incluso</SelectItem>
                      <SelectItem value="Não incluso">Não incluso</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Comissão">
                  <Input
                    placeholder="0%"
                    value={form.comissao}
                    onChange={(e) => setForm({ ...form, comissao: maskPercent(e.target.value) })}
                  />
                </Field>
                <div className="space-y-3">
                  <Field label="Origem">
                    <Select
                      value={form.origem}
                      onValueChange={(v) => setForm({ ...form, origem: v, origem_outro: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Site">Site</SelectItem>
                        <SelectItem value="Indicação">Indicação</SelectItem>
                        <SelectItem value="Evento">Evento</SelectItem>
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {form.origem === "Outro" && (
                    <Field label="Origem (especifique)">
                      <Input
                        placeholder="Digite a origem..."
                        value={form.origem_outro}
                        onChange={(e) => setForm({ ...form, origem_outro: e.target.value })}
                      />
                    </Field>
                  )}
                </div>
                <Field label="Linha de negócio *">
                  <Select value={form.business_line} onValueChange={(business_line) => setForm({ ...form, business_line })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent><SelectItem value="equipamento_novo">Equipamento novo</SelectItem><SelectItem value="equipamento_usado">Equipamento usado</SelectItem><SelectItem value="servico">Serviço</SelectItem><SelectItem value="reparo">Reparo</SelectItem><SelectItem value="peca">Peça</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Quem solicitou o orçamento">
                  <Input value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} placeholder="Colaborador ou parceiro" />
                </Field>
                {(form.business_line === "peca" || form.business_line === "reparo") && <>
                  <Field label="Origem da peça">
                    <Select value={form.piece_source} onValueChange={(piece_source) => setForm({ ...form, piece_source, supplier_name: piece_source === "estoque_proprio" ? "" : form.supplier_name, supplier_cost: piece_source === "estoque_proprio" ? "" : form.supplier_cost })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="estoque_proprio">Estoque próprio</SelectItem><SelectItem value="terceiro">Fornecedor terceiro</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  {form.piece_source === "terceiro" && <><Field label="Fornecedor"><Input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} /></Field><Field label="Custo de aquisição"><Input value={form.supplier_cost} onChange={(e) => setForm({ ...form, supplier_cost: maskCurrency(e.target.value) })} /></Field></>}
                </>}
              </div>
            </Section>

            {/* Outros */}
            <Section title="Outros">
              <div className="grid grid-cols-1 gap-4">
                <Field label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="aprovada">Aprovada</SelectItem>
                      <SelectItem value="reprovada">Reprovada</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Observações">
                  <Textarea
                    rows={3}
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Criar Solicitação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal detalhes (somente leitura) */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-6">
              {detail.status === "aprovada" && (
                <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                      Solicitação aprovada — em andamento em Negociações
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                      Todos os campos estão bloqueados para preservar o histórico. O card independente segue seu fluxo no Funil de Vendas.
                    </p>
                    {detail.converted_lead_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 gap-1 border-green-300 text-green-800 hover:bg-green-100 dark:text-green-300"
                        onClick={() => {
                          setDetail(null);
                          navigate(`/crm/kanban?funnel=vendas&lead=${detail.converted_lead_id}`);
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir card em Negociações
                      </Button>
                    )}
                  </div>
                  <Lock className="w-4 h-4 text-green-600/70 shrink-0" />
                </div>
              )}

              <Section title="Identificação">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReadField label="Tipo" value={detail.tipo} />
                  <ReadField label="CNPJ" value={detail.cnpj} />
                </div>
              </Section>

              <Section title="Dados da Empresa">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReadField label="Nome da empresa" value={detail.empresa} />
                  <ReadField label="Telefone" value={detail.telefone} />
                  <div className="md:col-span-2">
                    <ReadField label="Endereço" value={detail.endereco} />
                  </div>
                  <ReadField label="Contato" value={detail.contato} />
                  <ReadField label="Vendedor(a)" value={detail.responsavel_comercial} />
                  <ReadField label="E-mail 1" value={detail.email_1} />
                  <ReadField label="E-mail 2" value={detail.email_2} />
                </div>
              </Section>

              <Section title="Equipamento e Proposta">
                <div className="space-y-4">
                  <ReadField label="Equipamento" value={detail.equipamento} />
                  <ReadField label="Itens inclusos" value={detail.itens_inclusos} multiline />
                  <ReadField label="Itens não inclusos" value={detail.itens_nao_inclusos} multiline />
                </div>
              </Section>

              <Section title="Condições Comerciais">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReadField
                    label="Preço"
                    value={
                      detail.preco != null
                        ? Number(detail.preco).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : ""
                    }
                  />
                  <ReadField label="Condições de pagamento" value={detail.condicoes_pagamento} />
                  <ReadField label="Tempo de garantia" value={detail.tempo_garantia} />
                  <ReadField label="Frete" value={detail.frete} />
                  <ReadField
                    label="Comissão"
                    value={detail.comissao != null ? `${detail.comissao}%` : ""}
                  />
                  <ReadField label="Origem" value={detail.origem} />
                </div>
              </Section>

              <Section title="Outros">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground flex items-center gap-1">
                      Status
                      {!canEditStatus && <Lock className="w-3 h-3" />}
                    </Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={STATUS_COLORS[detail.status] || ""}>
                        {detail.status === "pendente"
                          ? "Pendente"
                          : detail.status === "aprovada"
                          ? "Aprovada"
                          : detail.status === "reprovada"
                          ? "Reprovada"
                          : detail.status}
                      </Badge>
                      {detail.status === "pendente" && (
                        <span className="text-xs text-muted-foreground">
                          Aguardando aprovação do CEO
                        </span>
                      )}
                    </div>
                    {canEditStatus && detail.status === "pendente" && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => approveRequest(detail)}
                          disabled={statusSaving}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRejectDialog(detail)}
                          disabled={statusSaving}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          Reprovar
                        </Button>
                      </div>
                    )}
                    {detail.status === "reprovada" && (
                      <div className="mt-3 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3">
                        <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">
                          Motivo da reprovação
                        </p>
                        <p className="text-sm text-red-900 dark:text-red-200 whitespace-pre-wrap">
                          {detail.rejection_reason?.trim() || "— não informado —"}
                        </p>
                      </div>
                    )}
                    {!canEditStatus && detail.status === "pendente" && (
                      <p className="text-xs text-muted-foreground">
                        Apenas CEO ou Admin podem aprovar/reprovar.
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <ReadField label="Observações" value={detail.observacoes} multiline />
                  </div>
                  <ReadField
                    label="Criada em"
                    value={
                      detail.created_at
                        ? format(new Date(detail.created_at), "dd/MM/yyyy HH:mm")
                        : ""
                    }
                  />
                </div>
              </Section>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {canEditStatus && detail && (
                <Button
                  variant="destructive"
                  onClick={() => softDelete(detail)}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de reprovação — motivo obrigatório */}
      <Dialog open={rejectOpen} onOpenChange={(o) => !o && setRejectOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reprovar solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da reprovação *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Descreva o motivo da reprovação..."
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={statusSaving}>
              Cancelar
            </Button>
            <Button
              onClick={confirmReject}
              disabled={statusSaving || !rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sugerir cadastro (CPF → contato / CNPJ → empresa) */}
      <Dialog
        open={suggestOpen}
        onOpenChange={(o) => {
          if (!o && suggestData?.doc) {
            const d = suggestData.doc.replace(/\D/g, "");
            if (d) setDismissedDocs((prev) => new Set(prev).add(d));
          }
          setSuggestOpen(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {suggestKind === "empresa" ? "Cadastrar nova empresa" : "Cadastrar novo contato"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {suggestKind === "empresa"
                ? "O CNPJ informado não está cadastrado no sistema. Deseja adicionar esta empresa à sua lista de empresas?"
                : "O CPF informado não está cadastrado no sistema. Deseja adicionar este cliente à sua lista de contatos?"}
            </p>
            {suggestData && (
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div><span className="text-muted-foreground">{suggestKind === "empresa" ? "Empresa" : "Nome"}:</span> <strong>{suggestData.nome || "—"}</strong></div>
                <div><span className="text-muted-foreground">{suggestKind === "empresa" ? "CNPJ" : "CPF"}:</span> <strong>{suggestData.doc || "—"}</strong></div>
                <div><span className="text-muted-foreground">Telefone:</span> <strong>{suggestData.telefone || "—"}</strong></div>
                <div><span className="text-muted-foreground">E-mail:</span> <strong>{suggestData.email || "—"}</strong></div>
                {suggestKind === "empresa" && suggestData.endereco && (
                  <div><span className="text-muted-foreground">Endereço:</span> <strong>{suggestData.endereco}</strong></div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (suggestData?.doc) {
                  const d = suggestData.doc.replace(/\D/g, "");
                  if (d) setDismissedDocs((prev) => new Set(prev).add(d));
                }
                setSuggestOpen(false);
              }}
            >
              Agora não
            </Button>
            <Button
              onClick={() => {
                if (!suggestData) return;
                if (suggestKind === "empresa") {
                  setCompanyInitial({
                    name: suggestData.nome || "",
                    cnpj: suggestData.doc || "",
                    address: suggestData.endereco || "",
                    tipo: "",
                    segment: "",
                    url: "",
                    summary: "",
                  });
                  setSuggestOpen(false);
                  setCreateCompanyOpen(true);
                } else {
                  setContactForm({
                    nome: suggestData.nome || "",
                    cpf: suggestData.doc || "",
                    telefone: suggestData.telefone || "",
                    email: suggestData.email || "",
                  });
                  setSuggestOpen(false);
                  setCreateContactOpen(true);
                }
              }}
            >
              {suggestKind === "empresa" ? "Cadastrar empresa" : "Cadastrar contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCompanySheet
        open={createCompanyOpen}
        onOpenChange={setCreateCompanyOpen}
        mode="create"
        initial={companyInitial || undefined}
        onCreated={() => setCompanyInitial(null)}
      />


      {/* Criar Contato pré-preenchido */}
      <Dialog open={createContactOpen} onOpenChange={setCreateContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Nome *">
              <Input
                value={contactForm.nome}
                onChange={(e) => setContactForm({ ...contactForm, nome: e.target.value })}
                placeholder="Digite o nome do contato"
              />
            </Field>
            <Field label="CPF">
              <Input
                value={contactForm.cpf}
                onChange={(e) => setContactForm({ ...contactForm, cpf: maskCPF(e.target.value) })}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={contactForm.telefone}
                onChange={(e) => setContactForm({ ...contactForm, telefone: maskPhone(e.target.value) })}
                placeholder="(11) 91234-5678"
              />
            </Field>
            <Field label="E-mail 1">
              <Input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateContactOpen(false)} disabled={savingContact}>
              Cancelar
            </Button>
            <Button
              disabled={savingContact || !contactForm.nome.trim()}
              onClick={async () => {
                setSavingContact(true);
                const phoneDigits = contactForm.telefone.replace(/\D/g, "");
                const cpfDigits = contactForm.cpf.replace(/\D/g, "");
                const payload: any = {
                  name: contactForm.nome.trim(),
                  email: contactForm.email.trim() || null,
                  phone: phoneDigits || null,
                  sync_status: "local",
                  raw_payload: cpfDigits ? { cpf: cpfDigits } : {},
                };
                const { error } = await (supabase as any)
                  .from("rd_contacts")
                  .insert(payload);
                setSavingContact(false);
                if (error) {
                  toast.error("Erro ao cadastrar contato: " + error.message);
                  return;
                }
                toast.success("Contato cadastrado com sucesso");
                setCreateContactOpen(false);
                setContactForm({ nome: "", cpf: "", telefone: "", email: "" });
              }}
            >
              Criar Contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HexaLayout>

  );
}

function ReadField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: any;
  multiline?: boolean;
}) {
  const display =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <div
        className={cn(
          "min-h-10 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm",
          multiline && "whitespace-pre-wrap",
        )}
      >
        {display}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
  active = false,
  onClick,
  className,
}: {
  label: string;
  value: any;
  tone?: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    cyan: "text-cyan-600",
    rose: "text-rose-600",
  };
  const clickable = typeof onClick === "function";
  return (
    <Card
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "transition-all",
        clickable && "cursor-pointer hover:border-primary/50",
        active && "border-primary ring-2 ring-primary/40 bg-primary/5",
        className,
      )}
    >
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("text-xl md:text-2xl font-bold mt-1 break-words", tones[tone] || tones.default)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
