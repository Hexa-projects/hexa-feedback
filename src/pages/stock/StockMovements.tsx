import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Search, Plus, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const TIPO_ICONS: Record<string, any> = {
  entrada: ArrowDownToLine,
  saida: ArrowUpFromLine,
  ajuste: RefreshCw,
};
const TIPO_COLORS: Record<string, string> = {
  entrada: "text-green-600 bg-green-50",
  saida: "text-red-600 bg-red-50",
  ajuste: "text-blue-600 bg-blue-50",
};

export default function StockMovements() {
  const { user } = useAuth();
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", tipo: "entrada", quantidade: 1, motivo: "", notas: "" });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("stock_movements").select("*, stock_products(nome, hexa_id)").order("created_at", { ascending: false }),
      supabase.from("stock_products").select("id, nome, hexa_id, quantidade").order("nome")
    ]).then(([movRes, prodRes]) => {
      setMovements(movRes.data || []);
      setProducts(prodRes.data || []);
      setLoading(false);
    });
  }, [user]);

  const filtered = movements.filter(m => {
    const matchSearch = !search || m.stock_products?.nome?.toLowerCase().includes(search.toLowerCase()) || m.motivo?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = tipoFilter === "all" || m.tipo === tipoFilter;
    return matchSearch && matchTipo;
  });

  const handleSubmit = async () => {
    if (!form.product_id) { toast.error("Selecione um produto"); return; }
    if (!user) return;
    const { error } = await supabase.from("stock_movements").insert({
      product_id: form.product_id, tipo: form.tipo, quantidade: form.quantidade,
      motivo: form.motivo, notas: form.notas, operador_id: user.id
    });
    if (error) { toast.error(error.message); return; }

    // Update product quantity
    const product = products.find(p => p.id === form.product_id);
    if (product) {
      const delta = form.tipo === "entrada" ? form.quantidade : form.tipo === "saida" ? -form.quantidade : 0;
      await supabase.from("stock_products").update({ quantidade: Math.max(0, product.quantidade + delta) }).eq("id", form.product_id);
    }

    toast.success("Movimentação registrada!");
    setDialogOpen(false);
    setForm({ product_id: "", tipo: "entrada", quantidade: 1, motivo: "", notas: "" });
    // reload
    const { data } = await supabase.from("stock_movements").select("*, stock_products(nome, hexa_id)").order("created_at", { ascending: false });
    setMovements(data || []);
  };

  const exportCSV = () => {
    const rows = [["Data", "Produto", "Tipo", "Qtd", "Motivo", "Referência"].join(",")];
    filtered.forEach(m => {
      rows.push([
        format(new Date(m.created_at), "dd/MM/yyyy HH:mm"),
        m.stock_products?.nome || "",
        m.tipo, m.quantidade, m.motivo || "", m.referencia || ""
      ].map(v => `"${v}"`).join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `movimentacoes_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
  };

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowDownToLine className="w-6 h-6 text-primary" /> Movimentações
            </h1>
            <p className="text-sm text-muted-foreground">Histórico de entradas, saídas e ajustes</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={exportCSV}><Download className="w-4 h-4" /> CSV</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Registrar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Produto *</Label>
                    <Select value={form.product_id} onValueChange={v => setForm(p => ({ ...p, product_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                      <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.nome} {p.hexa_id ? `(${p.hexa_id})` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo</Label>
                      <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">Entrada</SelectItem>
                          <SelectItem value="saida">Saída</SelectItem>
                          <SelectItem value="ajuste">Ajuste</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Quantidade</Label>
                      <Input type="number" min={1} value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: parseInt(e.target.value) || 1 }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Motivo</Label>
                    <Input value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex: Reposição, Envio OS #123" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notas</Label>
                    <Textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} />
                  </div>
                  <Button onClick={handleSubmit} className="w-full">Registrar Movimentação</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
              <SelectItem value="ajuste">Ajustes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card><CardContent className="p-4">
          {loading ? <p className="text-sm text-muted-foreground py-6">Carregando...</p> :
          filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação encontrada</p> :
          <div className="space-y-2">
            {filtered.map(m => {
              const Icon = TIPO_ICONS[m.tipo] || RefreshCw;
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TIPO_COLORS[m.tipo] || "bg-muted"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.stock_products?.nome || "Produto removido"}</p>
                    <p className="text-xs text-muted-foreground">{m.motivo || "Sem motivo"}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={m.tipo === "entrada" ? "border-green-300 text-green-700" : m.tipo === "saida" ? "border-red-300 text-red-700" : ""}>
                      {m.tipo === "entrada" ? "+" : m.tipo === "saida" ? "-" : "±"}{m.quantidade}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(m.created_at), "dd/MM HH:mm")}</p>
                  </div>
                </div>
              );
            })}
          </div>}
        </CardContent></Card>
      </div>
    </HexaLayout>
  );
}
