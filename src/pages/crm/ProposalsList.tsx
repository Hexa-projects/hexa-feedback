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
  Plus, Search, FileText, DollarSign, Eye, ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  Rascunho: "bg-muted text-muted-foreground",
  Enviada: "bg-blue-100 text-blue-800",
  Aceita: "bg-green-100 text-green-800",
  Recusada: "bg-red-100 text-red-800",
};

export default function ProposalsList() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", valor: "", lead_id: "", status: "Rascunho", validade_dias: "30",
  });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      supabase.from("proposals").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("id, nome, empresa"),
    ]).then(([pRes, lRes]) => {
      setProposals(pRes.data || []);
      setLeads(lRes.data || []);
      setLoading(false);
    });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return toast.error("Informe o título");
    const { data, error } = await supabase.from("proposals").insert({
      titulo: form.titulo,
      descricao: form.descricao,
      valor: parseFloat(form.valor) || 0,
      lead_id: form.lead_id || null,
      status: form.status,
      validade_dias: parseInt(form.validade_dias) || 30,
      user_id: user!.id,
    } as any).select().single();
    if (error) return toast.error(error.message);
    setProposals(prev => [data, ...prev]);
    setShowForm(false);
    setForm({ titulo: "", descricao: "", valor: "", lead_id: "", status: "Rascunho", validade_dias: "30" });
    toast.success("Proposta criada!");
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("proposals").update({ status } as any).eq("id", id);
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    toast.success("Status atualizado");
  };

  const filtered = proposals.filter(p =>
    p.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    p.descricao?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValor = proposals.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const aceitas = proposals.filter(p => p.status === "Aceita").length;
  const taxaConversao = proposals.length > 0 ? Math.round((aceitas / proposals.length) * 100) : 0;

  const getLeadName = (id: string) => leads.find(l => l.id === id)?.nome || "—";

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Propostas
            </h1>
            <p className="text-sm text-muted-foreground">Gerencie propostas comerciais</p>
          </div>
          <div className="flex gap-2">
            <Link to="/crm"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="w-4 h-4" /> CRM</Button></Link>
            <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-1"><Plus className="w-4 h-4" /> Nova Proposta</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{proposals.length}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Valor Total</p><p className="text-lg font-bold text-primary">R$ {totalValor.toLocaleString("pt-BR")}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Taxa Conversão</p><p className="text-lg font-bold text-hexa-green">{taxaConversao}%</p></CardContent></Card>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Nova Proposta</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Manutenção preventiva RM Siemens" />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead vinculado</Label>
                    <Select value={form.lead_id} onValueChange={v => setForm({ ...form, lead_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar lead..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome} {l.empresa ? `(${l.empresa})` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Validade (dias)</Label>
                    <Input type="number" value={form.validade_dias} onChange={e => setForm({ ...form, validade_dias: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} />
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
          <Input placeholder="Buscar proposta..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma proposta encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.titulo}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.lead_id ? getLeadName(p.lead_id) : "—"}</TableCell>
                      <TableCell className="font-medium text-primary">R$ {Number(p.valor || 0).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || "bg-muted"}`}>{p.status}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.status === "Rascunho" && <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus(p.id, "Enviada")}>Enviar</Button>}
                          {p.status === "Enviada" && (
                            <>
                              <Button size="sm" variant="outline" className="text-xs h-7 text-green-600" onClick={() => updateStatus(p.id, "Aceita")}>Aceitar</Button>
                              <Button size="sm" variant="outline" className="text-xs h-7 text-red-600" onClick={() => updateStatus(p.id, "Recusada")}>Recusar</Button>
                            </>
                          )}
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
