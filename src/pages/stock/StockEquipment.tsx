import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Plus, Search, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

export default function StockEquipment() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "", modelo: "", serial_number: "", cliente: "", localizacao: "",
    data_instalacao: "", proxima_manutencao: "", notas: ""
  });

  const loadData = async () => {
    const { data } = await supabase.from("installed_equipment").select("*").order("created_at", { ascending: false });
    setEquipment(data || []);
    setLoading(false);
  };

  useEffect(() => { if (user) loadData(); }, [user]);

  const filtered = equipment.filter(e =>
    !search || [e.nome, e.modelo, e.serial_number, e.cliente].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async () => {
    if (!form.nome.trim() || !form.cliente.trim()) { toast.error("Nome e cliente são obrigatórios"); return; }
    if (!user) return;
    const { error } = await supabase.from("installed_equipment").insert({
      ...form,
      data_instalacao: form.data_instalacao || null,
      proxima_manutencao: form.proxima_manutencao || null,
      user_id: user.id
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Equipamento cadastrado!");
    setDialogOpen(false);
    setForm({ nome: "", modelo: "", serial_number: "", cliente: "", localizacao: "", data_instalacao: "", proxima_manutencao: "", notas: "" });
    loadData();
  };

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" /> Equipamentos Instalados
            </h1>
            <p className="text-sm text-muted-foreground">Equipamentos ativos em clientes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Equipamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Cadastrar Equipamento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Modelo</Label><Input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>S/N</Label><Input value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Cliente *</Label><Input value={form.cliente} onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Localização</Label><Input value={form.localizacao} onChange={e => setForm(p => ({ ...p, localizacao: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Data Instalação</Label><Input type="date" value={form.data_instalacao} onChange={e => setForm(p => ({ ...p, data_instalacao: e.target.value }))} /></div>
                  <div className="space-y-1 col-span-2"><Label>Próxima Manutenção</Label><Input type="date" value={form.proxima_manutencao} onChange={e => setForm(p => ({ ...p, proxima_manutencao: e.target.value }))} /></div>
                </div>
                <div className="space-y-1"><Label>Notas</Label><Textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} /></div>
                <Button onClick={handleSave} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar equipamento..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card><CardContent className="p-0">
          {loading ? <p className="p-6 text-sm text-muted-foreground">Carregando...</p> :
          filtered.length === 0 ? <div className="text-center py-12"><Wrench className="w-10 h-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Nenhum equipamento</p></div> :
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>S/N</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Próx. Manutenção</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => {
                const needsMaint = e.proxima_manutencao && differenceInDays(new Date(e.proxima_manutencao), new Date()) <= 30;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{e.nome}</p>
                      {e.modelo && <p className="text-xs text-muted-foreground">{e.modelo}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{e.cliente}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.serial_number || "—"}</TableCell>
                    <TableCell><Badge variant={e.status === "Ativo" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">
                          {e.proxima_manutencao ? format(new Date(e.proxima_manutencao), "dd/MM/yy") : "—"}
                        </span>
                        {needsMaint && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>}
        </CardContent></Card>
      </div>
    </HexaLayout>
  );
}
