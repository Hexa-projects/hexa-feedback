import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Search, FileSignature, DollarSign, ArrowLeft, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-100 text-green-800",
  vencido: "bg-red-100 text-red-800",
  cancelado: "bg-muted text-muted-foreground",
  renovacao: "bg-blue-100 text-blue-800",
};

export default function ContractsList() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", valor_mensal: "", valor_total: "",
    lead_id: "", tipo: "mensal", data_inicio: "", data_fim: "",
  });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("id, nome, empresa"),
    ]).then(([cRes, lRes]) => {
      setContracts(cRes.data || []);
      setLeads(lRes.data || []);
      setLoading(false);
    });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return toast.error("Informe o título");
    const { data, error } = await supabase.from("contracts").insert({
      titulo: form.titulo,
      descricao: form.descricao,
      valor_mensal: parseFloat(form.valor_mensal) || 0,
      valor_total: parseFloat(form.valor_total) || 0,
      lead_id: form.lead_id || null,
      tipo: form.tipo,
      data_inicio: form.data_inicio || new Date().toISOString(),
      data_fim: form.data_fim || null,
      user_id: user!.id,
    } as any).select().single();
    if (error) return toast.error(error.message);
    setContracts(prev => [data, ...prev]);
    setShowForm(false);
    setForm({ titulo: "", descricao: "", valor_mensal: "", valor_total: "", lead_id: "", tipo: "mensal", data_inicio: "", data_fim: "" });
    toast.success("Contrato criado!");
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("contracts").update({ status } as any).eq("id", id);
    setContracts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    toast.success("Status atualizado");
  };

  const filtered = contracts.filter(c =>
    c.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    c.descricao?.toLowerCase().includes(search.toLowerCase())
  );

  const totalMensal = contracts.filter(c => c.status === "ativo").reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0);
  const ativos = contracts.filter(c => c.status === "ativo").length;
  const getLeadName = (id: string) => leads.find(l => l.id === id)?.nome || "—";

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSignature className="w-6 h-6 text-primary" /> Contratos
            </h1>
            <p className="text-sm text-muted-foreground">Gestão de contratos recorrentes</p>
          </div>
          <div className="flex gap-2">
            <Link to="/crm"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="w-4 h-4" /> CRM</Button></Link>
            <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Contrato</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Ativos</p><p className="text-lg font-bold text-hexa-green">{ativos}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Receita Recorrente</p><p className="text-lg font-bold text-primary">R$ {totalMensal.toLocaleString("pt-BR")}/mês</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total Contratos</p><p className="text-lg font-bold">{contracts.length}</p></CardContent></Card>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Novo Contrato</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Contrato Manutenção Hospital X" />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead / Cliente</Label>
                    <Select value={form.lead_id} onValueChange={v => setForm({ ...form, lead_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome} {l.empresa ? `(${l.empresa})` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Mensal (R$)</Label>
                    <Input type="number" step="0.01" value={form.valor_mensal} onChange={e => setForm({ ...form, valor_mensal: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                        <SelectItem value="avulso">Avulso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit"><Plus className="w-4 h-4 mr-1" /> Criar</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar contrato..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FileSignature className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum contrato encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.titulo}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.lead_id ? getLeadName(c.lead_id) : "—"}</TableCell>
                      <TableCell className="font-medium text-primary">R$ {Number(c.valor_mensal || 0).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-sm capitalize">{c.tipo}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || "bg-muted"}`}>{c.status}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.data_inicio ? format(new Date(c.data_inicio), "dd/MM/yy") : "—"}
                        {c.data_fim ? ` → ${format(new Date(c.data_fim), "dd/MM/yy")}` : ""}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {c.status === "ativo" && <Button size="sm" variant="outline" className="text-xs h-7 text-red-600" onClick={() => updateStatus(c.id, "cancelado")}>Cancelar</Button>}
                          {c.status === "vencido" && <Button size="sm" variant="outline" className="text-xs h-7 text-blue-600" onClick={() => updateStatus(c.id, "renovacao")}>Renovar</Button>}
                          {c.status === "cancelado" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus(c.id, "ativo")}>Reativar</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
