import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye, Users, Phone, Clock, AlertTriangle } from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  "Qualificação": "bg-blue-100 text-blue-800",
  "Contato Inicial": "bg-yellow-100 text-yellow-800",
  "Reunião": "bg-purple-100 text-purple-800",
  "Proposta Enviada": "bg-orange-100 text-orange-800",
  "Negociação": "bg-teal-100 text-teal-800",
  "Ganho": "bg-green-100 text-green-800",
  "Perdido": "bg-red-100 text-red-800",
};

export default function LeadsList() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [followUpLeadId, setFollowUpLeadId] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpType, setFollowUpType] = useState("ligacao");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeads(data || []);
        setLoading(false);
      });
  }, [user]);

  const filtered = leads.filter(l =>
    l.nome.toLowerCase().includes(search.toLowerCase()) ||
    l.empresa?.toLowerCase().includes(search.toLowerCase())
  );

  const handleFollowUp = async () => {
    if (!followUpNote.trim() || !user || !followUpLeadId) return;
    setSending(true);
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: followUpLeadId,
      user_id: user.id,
      tipo: followUpType,
      conteudo: followUpNote.trim(),
    } as any);
    if (!error) {
      // Update ultimo_contato
      await supabase.from("leads").update({ ultimo_contato: new Date().toISOString() } as any).eq("id", followUpLeadId);
      setLeads(prev => prev.map(l => l.id === followUpLeadId ? { ...l, ultimo_contato: new Date().toISOString() } : l));
      toast.success("Follow-up registrado!");
      setFollowUpLeadId(null);
      setFollowUpNote("");
    } else {
      toast.error("Erro ao registrar follow-up");
    }
    setSending(false);
  };

  // KPIs
  const activeLeads = leads.filter(l => !["Ganho", "Perdido"].includes(l.status)).length;
  const slaAtRisk = leads.filter(l => {
    if (["Ganho", "Perdido"].includes(l.status)) return false;
    const last = l.ultimo_contato || l.created_at;
    return differenceInHours(new Date(), new Date(last)) > 48;
  }).length;

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> CRM & Vendas
            </h1>
            <p className="text-sm text-muted-foreground">Gerencie seus leads e oportunidades</p>
          </div>
          <div className="flex gap-2">
            <Link to="/crm/kanban">
              <Button variant="outline" size="sm">Funil Kanban</Button>
            </Link>
            <Link to="/crm/new">
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Lead</Button>
            </Link>
          </div>
        </div>

        {/* Mini KPIs */}
        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline" className="text-sm py-1 px-3 gap-1">
            <Users className="w-3.5 h-3.5" /> {activeLeads} ativos
          </Badge>
          <Badge variant={slaAtRisk > 0 ? "destructive" : "outline"} className="text-sm py-1 px-3 gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {slaAtRisk} SLA em risco
          </Badge>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar lead..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground p-6">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum lead encontrado</p>
                <Link to="/crm/new"><Button className="mt-3" size="sm">Criar primeiro lead</Button></Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor Est.</TableHead>
                    <TableHead>Último Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(lead => {
                    const lastContact = lead.ultimo_contato || lead.created_at;
                    const hoursAgo = differenceInHours(new Date(), new Date(lastContact));
                    const isAtRisk = hoursAgo > 48 && !["Ganho", "Perdido"].includes(lead.status);
                    return (
                      <TableRow key={lead.id} className={isAtRisk ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">
                          {lead.nome}
                          {isAtRisk && <AlertTriangle className="w-3.5 h-3.5 text-destructive inline ml-1" />}
                        </TableCell>
                        <TableCell>{lead.empresa}</TableCell>
                        <TableCell>
                          <span className={`status-badge ${STATUS_COLORS[lead.status] || "bg-muted"}`}>
                            {lead.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {lead.valor_estimado > 0
                            ? `R$ ${Number(lead.valor_estimado).toLocaleString("pt-BR")}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lead.ultimo_contato ? format(new Date(lead.ultimo_contato), "dd/MM/yyyy") : "—"}
                          {isAtRisk && <span className="text-destructive ml-1 text-xs">({Math.floor(hoursAgo / 24)}d)</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => setFollowUpLeadId(lead.id)}
                            >
                              <Phone className="w-3 h-3" /> Follow-up
                            </Button>
                            <Link to={`/crm/${lead.id}`}>
                              <Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Follow-up Dialog */}
        <Dialog open={!!followUpLeadId} onOpenChange={(open) => { if (!open) setFollowUpLeadId(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="w-4 h-4" /> Follow-up Rápido
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Lead: <strong>{leads.find(l => l.id === followUpLeadId)?.nome}</strong>
              </p>
              <Select value={followUpType} onValueChange={setFollowUpType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ligacao">📞 Ligação</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="email">📧 E-mail</SelectItem>
                  <SelectItem value="reuniao">📅 Reunião</SelectItem>
                  <SelectItem value="nota">📝 Nota</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={followUpNote}
                onChange={e => setFollowUpNote(e.target.value)}
                placeholder="Descreva o que foi feito..."
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setFollowUpLeadId(null)}>Cancelar</Button>
                <Button onClick={handleFollowUp} disabled={sending || !followUpNote.trim()}>
                  {sending ? "Registrando..." : "Registrar Follow-up"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </HexaLayout>
  );
}
