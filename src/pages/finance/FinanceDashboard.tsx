import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Plus, Search, ArrowUpCircle, ArrowDownCircle
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = {
  receita: ["Contrato", "Serviço Avulso", "Manutenção", "Venda de Peça", "Outro"],
  despesa: ["Salários", "Aluguel", "Insumos", "Logística", "Marketing", "Outro"],
};

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipo: "receita",
    categoria: "",
    descricao: "",
    valor: "",
    data_vencimento: "",
    cliente: "",
    referencia: "",
    status: "pendente",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("financial_records")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRecords(data || []);
        setLoading(false);
      });
  }, [user]);

  const totals = records.reduce(
    (acc, r) => {
      const val = Number(r.valor) || 0;
      if (r.tipo === "receita") {
        acc.receita += val;
        if (r.status === "pago") acc.receitaPaga += val;
        if (r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) < new Date())
          acc.inadimplente += val;
      } else {
        acc.despesa += val;
        if (r.status === "pago") acc.despesaPaga += val;
      }
      return acc;
    },
    { receita: 0, receitaPaga: 0, despesa: 0, despesaPaga: 0, inadimplente: 0 }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) return toast.error("Preencha descrição e valor");
    const { data, error } = await supabase
      .from("financial_records")
      .insert({
        ...form,
        valor: parseFloat(form.valor) || 0,
        data_vencimento: form.data_vencimento || null,
        user_id: user!.id,
      } as any)
      .select()
      .single();
    if (error) toast.error("Erro ao salvar");
    else {
      setRecords((prev) => [data, ...prev]);
      setShowForm(false);
      setForm({ tipo: "receita", categoria: "", descricao: "", valor: "", data_vencimento: "", cliente: "", referencia: "", status: "pendente" });
      toast.success("Registro financeiro criado!");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("financial_records").update({ status, data_pagamento: status === "pago" ? new Date().toISOString() : null } as any).eq("id", id);
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status, data_pagamento: status === "pago" ? new Date().toISOString() : null } : r)));
    toast.success("Status atualizado");
  };

  const filtered = records.filter(
    (r) =>
      r.descricao.toLowerCase().includes(search.toLowerCase()) ||
      r.cliente?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-primary" /> Financeiro
            </h1>
            <p className="text-muted-foreground text-sm">Receitas, custos e inadimplência.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Registro
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-hexa-green/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-hexa-green" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita Total</p>
                <p className="text-lg font-bold text-hexa-green">{fmt(totals.receita)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesa Total</p>
                <p className="text-lg font-bold text-destructive">{fmt(totals.despesa)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                <p className={`text-lg font-bold ${totals.receita - totals.despesa >= 0 ? "text-hexa-green" : "text-destructive"}`}>
                  {fmt(totals.receita - totals.despesa)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-hexa-amber/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-hexa-amber" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inadimplência</p>
                <p className="text-lg font-bold text-hexa-amber">{fmt(totals.inadimplente)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Novo Registro Financeiro</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, categoria: "" })}>
                      <option value="receita">Receita</option>
                      <option value="despesa">Despesa</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                      <option value="">Selecione...</option>
                      {CATEGORIES[form.tipo as keyof typeof CATEGORIES].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Descrição *</Label>
                    <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente / Fornecedor</Label>
                    <Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento</Label>
                    <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="gap-2"><Plus className="w-4 h-4" /> Salvar</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Records */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar registros..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-muted-foreground p-6 text-center">Carregando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground p-6 text-center">Nenhum registro encontrado.</p>
            ) : (
              <div className="divide-y">
                {filtered.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-4 hover:bg-muted/30">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${r.tipo === "receita" ? "bg-hexa-green/10" : "bg-destructive/10"}`}>
                      {r.tipo === "receita" ? <ArrowUpCircle className="w-4 h-4 text-hexa-green" /> : <ArrowDownCircle className="w-4 h-4 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.categoria}{r.cliente ? ` • ${r.cliente}` : ""}
                        {r.data_vencimento && ` • Venc: ${new Date(r.data_vencimento).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <p className={`text-sm font-bold ${r.tipo === "receita" ? "text-hexa-green" : "text-destructive"}`}>
                      {r.tipo === "receita" ? "+" : "-"} {fmt(Number(r.valor))}
                    </p>
                    <Badge
                      className={`cursor-pointer ${
                        r.status === "pago" ? "bg-hexa-green/10 text-hexa-green" : r.status === "cancelado" ? "bg-destructive/10 text-destructive" : "bg-hexa-amber/10 text-hexa-amber"
                      }`}
                      onClick={() => updateStatus(r.id, r.status === "pago" ? "pendente" : "pago")}
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
