import { useEffect, useMemo, useState } from "react";
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
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Plus, Search, FileText, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    "Esaote": ["E-scan", "S-scan", "O-scan", "O-scan SMART", "G-scan Brio", "Magnifico Open"],
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

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "bg-blue-100 text-blue-800",
  media: "bg-yellow-100 text-yellow-800",
  alta: "bg-orange-100 text-orange-800",
  critica: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  em_analise: "bg-blue-100 text-blue-800",
  aprovada: "bg-green-100 text-green-800",
  recusada: "bg-red-100 text-red-800",
  rascunho: "bg-slate-100 text-slate-800",
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
  prioridade: "media",
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
  const { user } = useAuth();
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
  const [form, setForm] = useState({ ...emptyForm });
  const [detail, setDetail] = useState<any | null>(null);

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

  const fetchCNPJ = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return;
    setCnpjLoading(true);
    try {
      const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/receitaws-proxy?cnpj=${clean}`,
        { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } }
      );
      if (!res.ok) return;
      const data = await res.json();
      setForm((f) => ({
        ...f,
        empresa: data?.nome || f.empresa,
        cep_empresa: data?.cep ? maskCEP(String(data.cep)) : f.cep_empresa,
        rua_empresa: data?.logradouro || f.rua_empresa,
        bairro_empresa: data?.bairro || f.bairro_empresa,
        cidade_empresa: data?.municipio || f.cidade_empresa,
        uf_empresa: data?.uf || f.uf_empresa,
      }));
    } catch {
      // falha silenciosa — mantém campo editável manualmente
    } finally {
      setCnpjLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("commercial_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar solicitações");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    load();
  }, [user]);

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
    const valor = items.reduce((sum, i) => sum + (Number(i.preco) || 0), 0);
    return { total, pendentes, aprovadas, valor };
  }, [items]);

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
      ["prioridade", "Prioridade"],
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
    const { error } = await (supabase as any).from("commercial_requests").insert(payload);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Solicitação criada");
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
          <Button onClick={() => setOpen(true)} className="gap-1">
            <Plus className="mr-2 h-4 w-4" />
            Nova Solicitação
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total" value={kpis.total} />
          <Kpi label="Pendentes" value={kpis.pendentes} tone="amber" />
          <Kpi label="Aprovadas" value={kpis.aprovadas} tone="emerald" />
          <Kpi
            label="Valor total"
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
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="recusada">Recusada</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Tabela */}
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
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
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
                          <Badge className={PRIORIDADE_COLORS[r.prioridade]}>
                            {r.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[r.status]}>
                            {r.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
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
                <Field label="CNPJ">
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={form.cnpj}
                    disabled={cnpjLoading || !!form.cpf.trim()}
                    onChange={(e) => {
                      const masked = maskCNPJ(e.target.value);
                      setForm({ ...form, cnpj: masked });
                      if (isValidCNPJ(masked)) fetchCNPJ(masked);
                    }}
                  />
                </Field>
                <Field label="CPF">
                  <Input
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    disabled={!!form.cnpj.trim()}
                    onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Preencha <strong>CNPJ</strong> (para empresas) <em>ou</em> <strong>CPF</strong> (para pessoa física) — não os dois.
              </p>
            </Section>

            {/* Dados da empresa OU do cliente (condicional) */}
            {form.cnpj.trim() && (
              <Section title="Dados da Empresa">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Field label="Nome da empresa *">
                      <Input
                        value={form.empresa}
                        onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                      />
                    </Field>
                  </div>
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

            {form.cpf.trim() && (
              <Section title="Dados do Cliente">
                <Field label="Nome do cliente *">
                  <Input
                    value={form.cliente_nome}
                    onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
                  />
                </Field>
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
                    <Input
                      value={form.responsavel_comercial}
                      onChange={(e) =>
                        setForm({ ...form, responsavel_comercial: e.target.value })
                      }
                    />
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
                            <Tooltip key={c.sigla}>
                              <TooltipTrigger asChild>
                                <SelectItem value={c.sigla}>{c.sigla}</SelectItem>
                              </TooltipTrigger>
                              <TooltipContent side="right">{c.nome}</TooltipContent>
                            </Tooltip>
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
              </div>
            </Section>

            {/* Outros */}
            <Section title="Outros">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Prioridade">
                  <Select
                    value={form.prioridade}
                    onValueChange={(v) => setForm({ ...form, prioridade: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_analise">Em análise</SelectItem>
                      <SelectItem value="aprovada">Aprovada</SelectItem>
                      <SelectItem value="recusada">Recusada</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Observações">
                    <Textarea
                      rows={3}
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    />
                  </Field>
                </div>
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
                  <ReadField label="Prioridade" value={detail.prioridade} />
                  <ReadField label="Status" value={detail.status?.replace("_", " ")} />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>
              Fechar
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

function Kpi({ label, value, tone = "default" }: { label: string; value: any; tone?: string }) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    cyan: "text-cyan-600",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("text-2xl font-bold mt-1", tones[tone] || tones.default)}>{value}</div>
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
