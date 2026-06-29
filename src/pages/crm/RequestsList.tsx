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
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  telefone: "",
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
      if (data?.nome) {
        setForm((f) => ({ ...f, empresa: data.nome }));
      }
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
    const required: [string, string][] = [
      ["tipo", "Tipo"],
      ["empresa", "Empresa"],
      ["cnpj", "CNPJ"],
      ["telefone", "Telefone"],
      ["cep", "CEP"],
      ["rua", "Rua"],
      ["bairro", "Bairro"],
      ["cidade", "Cidade"],
      ["complemento", "Complemento"],
      ["contato", "Contato"],
      ["responsavel_comercial", "Vendedor(a)"],
      ["email_1", "E-mail 1"],
      ["equipamento", "Equipamento"],
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
    if (!isValidCNPJ(form.cnpj)) return toast.error("CNPJ inválido (use 00.000.000/0000-00)");
    if (!isValidPhone(form.telefone)) return toast.error("Telefone inválido");
    setSaving(true);
    const enderecoCompleto = `${form.rua}, ${form.complemento} - ${form.bairro}, ${form.cidade}${form.uf ? "/" + form.uf : ""} - CEP ${form.cep}`;
    const payload: any = {
      ...form,
      endereco: enderecoCompleto,
      preco: parseCurrency(form.preco),
      comissao: parsePercent(form.comissao),
      origem: form.origem === "Outro" ? form.origem_outro : form.origem,
      user_id: user!.id,
    };
    // Remove campos que não existem na tabela
    delete payload.cep; delete payload.rua; delete payload.bairro;
    delete payload.cidade; delete payload.uf; delete payload.complemento;
    delete payload.origem_outro;
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
                      <TableRow key={r.id}>
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
                <Field label="CNPJ *">
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
              </div>
            </Section>

            {/* Dados da empresa */}
            <Section title="Dados da Empresa">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome da empresa *">
                  <Input
                    value={form.empresa}
                    onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  />
                </Field>
                <Field label="Telefone *">
                  <Input
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
                  />
                </Field>
                <Field label="CEP *">
                  <Input
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={(e) => {
                      const v = maskCEP(e.target.value);
                      setForm({ ...form, cep: v });
                      if (v.replace(/\D/g, "").length === 8) fetchCEP(v);
                    }}
                  />
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
                <Field label="Contato *">
                  <Input
                    value={form.contato}
                    onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  />
                </Field>
                <Field label="Vendedor(a) *">
                  <Input
                    value={form.responsavel_comercial}
                    onChange={(e) =>
                      setForm({ ...form, responsavel_comercial: e.target.value })
                    }
                  />
                </Field>
                <Field label="E-mail 1">
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
              </div>
            </Section>

            {/* Equipamento */}
            <Section title="Equipamento e Proposta">
              <div className="space-y-4">
                <Field label="Equipamento">
                  <Input
                    value={form.equipamento}
                    onChange={(e) => setForm({ ...form, equipamento: e.target.value })}
                  />
                </Field>
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
    </HexaLayout>
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
