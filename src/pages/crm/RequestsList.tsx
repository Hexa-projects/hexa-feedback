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
import { Plus, Search, FileText, Check, ChevronsUpDown } from "lucide-react";
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
  baixa: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  media: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  alta: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critica: "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  em_analise: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  aprovada: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  recusada: "bg-red-500/20 text-red-300 border-red-500/30",
  rascunho: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const emptyForm = {
  tipo: "",
  empresa: "",
  cnpj: "",
  telefone: "",
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
  prioridade: "media",
  status: "pendente",
  observacoes: "",
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
  const [form, setForm] = useState({ ...emptyForm });

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
    if (!form.tipo) return toast.error("Selecione o tipo da solicitação");
    if (!form.empresa.trim()) return toast.error("Informe a empresa");
    setSaving(true);
    const payload: any = {
      ...form,
      preco: form.preco ? parseFloat(form.preco) : null,
      comissao: form.comissao ? parseFloat(form.comissao) : null,
      user_id: user!.id,
    };
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
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FileText className="text-cyan-400" />
              Solicitações
            </h1>
            <p className="text-slate-400 mt-1">
              Registre e acompanhe solicitações comerciais de clientes.
            </p>
          </div>
          <Button
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Solicitação
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Buscar por empresa, equipamento ou tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-950/50 border-slate-800"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48 bg-slate-950/50 border-slate-800">
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
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">
              {loading ? "Carregando..." : `${filtered.length} solicitação(ões)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
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
                    <TableRow key={r.id} className="border-slate-800">
                      <TableCell className="font-medium text-slate-200 max-w-[240px] truncate">
                        {r.tipo}
                      </TableCell>
                      <TableCell>{r.empresa}</TableCell>
                      <TableCell className="text-slate-400">{r.equipamento || "-"}</TableCell>
                      <TableCell>
                        {r.preco
                          ? Number(r.preco).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={PRIORIDADE_COLORS[r.prioridade]}>
                          {r.prioridade}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[r.status]}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {format(new Date(r.created_at), "dd/MM/yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                        Nenhuma solicitação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal nova solicitação */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Nova Solicitação</DialogTitle>
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
                        className="w-full justify-between bg-slate-950/50 border-slate-800 font-normal"
                      >
                        <span className={cn("truncate", !form.tipo && "text-slate-500")}>
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
                <Field label="Empresa *">
                  <Input
                    value={form.empresa}
                    onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            {/* Dados da empresa */}
            <Section title="Dados da Empresa">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="CNPJ">
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Endereço">
                    <Input
                      value={form.endereco}
                      onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Contato">
                  <Input
                    value={form.contato}
                    onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  />
                </Field>
                <Field label="Responsável comercial">
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
                <Field label="Preço (R$)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.preco}
                    onChange={(e) => setForm({ ...form, preco: e.target.value })}
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
                <Field label="Frete">
                  <Select
                    value={form.frete}
                    onValueChange={(v) => setForm({ ...form, frete: v })}
                  >
                    <SelectTrigger className="bg-slate-950/50 border-slate-800">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CIF">CIF</SelectItem>
                      <SelectItem value="FOB">FOB</SelectItem>
                      <SelectItem value="Incluso">Incluso</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Comissão (%)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.comissao}
                    onChange={(e) => setForm({ ...form, comissao: e.target.value })}
                  />
                </Field>
                <Field label="Origem">
                  <Select
                    value={form.origem}
                    onValueChange={(v) => setForm({ ...form, origem: v })}
                  >
                    <SelectTrigger className="bg-slate-950/50 border-slate-800">
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
                    <SelectTrigger className="bg-slate-950/50 border-slate-800">
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
                    <SelectTrigger className="bg-slate-950/50 border-slate-800">
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
              <Button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                {saving ? "Salvando..." : "Criar Solicitação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </HexaLayout>
  );
}

function Kpi({ label, value, tone = "slate" }: { label: string; value: any; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "text-white",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    cyan: "text-cyan-300",
  };
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className={cn("text-2xl font-bold mt-1", tones[tone])}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-300">{label}</Label>
      {children}
    </div>
  );
}
