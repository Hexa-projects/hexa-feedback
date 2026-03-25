import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Save, MessageSquare, Send, FileText, Plus,
  DollarSign, Calendar, User, Phone, Mail, Building2
} from "lucide-react";
import { format } from "date-fns";

const STATUSES = ["Qualificação", "Contato Inicial", "Reunião", "Proposta Enviada", "Negociação", "Ganho", "Perdido"];
const STATUS_COLORS: Record<string, string> = {
  "Qualificação": "bg-blue-100 text-blue-800",
  "Contato Inicial": "bg-yellow-100 text-yellow-800",
  "Reunião": "bg-purple-100 text-purple-800",
  "Proposta Enviada": "bg-orange-100 text-orange-800",
  "Negociação": "bg-teal-100 text-teal-800",
  "Ganho": "bg-green-100 text-green-800",
  "Perdido": "bg-red-100 text-red-800",
};

export default function LeadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("nota");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Proposal form
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalForm, setProposalForm] = useState({ titulo: "", descricao: "", valor: "" });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("leads").select("*").eq("id", id).single(),
      supabase.from("lead_interactions").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("proposals").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]).then(([leadRes, intRes, propRes, contRes]) => {
      setLead(leadRes.data);
      setInteractions(intRes.data || []);
      setProposals(propRes.data || []);
      setContracts(contRes.data || []);
      setLoading(false);
    });
  }, [id]);

  const handleUpdate = async () => {
    if (!lead) return;
    setSaving(true);
    const { error } = await supabase.from("leads").update({
      nome: lead.nome, empresa: lead.empresa, email: lead.email,
      telefone: lead.telefone, status: lead.status,
      valor_estimado: lead.valor_estimado, notas: lead.notas,
      ultimo_contato: new Date().toISOString(),
    } as any).eq("id", lead.id);
    if (error) toast.error(error.message);
    else toast.success("Lead atualizado!");
    setSaving(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user || !id) return;
    const { data, error } = await supabase.from("lead_interactions").insert({
      lead_id: id, user_id: user.id, tipo: noteType, conteudo: newNote.trim(),
    } as any).select().single();
    if (!error && data) {
      setInteractions(prev => [data, ...prev]);
      setNewNote("");
    }
  };

  const createProposal = async () => {
    if (!proposalForm.titulo.trim() || !user || !id) return;
    const { data, error } = await supabase.from("proposals").insert({
      lead_id: id, user_id: user.id, titulo: proposalForm.titulo,
      descricao: proposalForm.descricao, valor: parseFloat(proposalForm.valor) || 0,
    } as any).select().single();
    if (!error && data) {
      setProposals(prev => [data, ...prev]);
      setShowProposalForm(false);
      setProposalForm({ titulo: "", descricao: "", valor: "" });
      toast.success("Proposta criada!");
    }
  };

  if (loading) return <HexaLayout><p className="text-muted-foreground p-6">Carregando...</p></HexaLayout>;
  if (!lead) return <HexaLayout><p className="text-muted-foreground p-6">Lead não encontrado</p></HexaLayout>;

  return (
    <HexaLayout>
      <div className="max-w-4xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/crm")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{lead.nome}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              {lead.empresa && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{lead.empresa}</span>}
              {lead.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{lead.email}</span>}
              {lead.telefone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.telefone}</span>}
            </div>
          </div>
          <Badge className={STATUS_COLORS[lead.status] || "bg-muted"}>{lead.status}</Badge>
        </div>

        {/* Quick KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor Estimado</p>
              <p className="text-lg font-bold text-primary">R$ {Number(lead.valor_estimado || 0).toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Propostas</p>
              <p className="text-lg font-bold">{proposals.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Contratos</p>
              <p className="text-lg font-bold">{contracts.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dados" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({interactions.length})</TabsTrigger>
            <TabsTrigger value="propostas">Propostas ({proposals.length})</TabsTrigger>
            <TabsTrigger value="contratos">Contratos ({contracts.length})</TabsTrigger>
          </TabsList>

          {/* Dados Tab */}
          <TabsContent value="dados">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={lead.nome || ""} onChange={e => setLead({ ...lead, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Input value={lead.empresa || ""} onChange={e => setLead({ ...lead, empresa: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input value={lead.email || ""} onChange={e => setLead({ ...lead, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={lead.telefone || ""} onChange={e => setLead({ ...lead, telefone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={lead.status} onValueChange={v => setLead({ ...lead, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Estimado</Label>
                    <Input type="number" value={lead.valor_estimado || ""} onChange={e => setLead({ ...lead, valor_estimado: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea value={lead.notas || ""} onChange={e => setLead({ ...lead, notas: e.target.value })} rows={3} />
                </div>
                <Button onClick={handleUpdate} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent value="historico">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex gap-2">
                  <Select value={noteType} onValueChange={setNoteType}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nota">Nota</SelectItem>
                      <SelectItem value="ligacao">Ligação</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="reuniao">Reunião</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Adicionar interação..." rows={2} className="flex-1" />
                  <Button onClick={handleAddNote} size="icon" disabled={!newNote.trim()}><Send className="w-4 h-4" /></Button>
                </div>
                {interactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma interação registrada</p>
                ) : (
                  <div className="space-y-3">
                    {interactions.map(i => (
                      <div key={i.id} className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] capitalize">{i.tipo}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(i.created_at), "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm">{i.conteudo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Propostas Tab */}
          <TabsContent value="propostas">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <Button variant="outline" size="sm" onClick={() => setShowProposalForm(!showProposalForm)} className="gap-1">
                  <Plus className="w-4 h-4" /> Nova Proposta
                </Button>
                {showProposalForm && (
                  <div className="p-4 rounded-lg border space-y-3">
                    <Input value={proposalForm.titulo} onChange={e => setProposalForm({ ...proposalForm, titulo: e.target.value })} placeholder="Título da proposta" />
                    <Textarea value={proposalForm.descricao} onChange={e => setProposalForm({ ...proposalForm, descricao: e.target.value })} placeholder="Descrição" rows={2} />
                    <Input type="number" value={proposalForm.valor} onChange={e => setProposalForm({ ...proposalForm, valor: e.target.value })} placeholder="Valor (R$)" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createProposal}>Criar Proposta</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowProposalForm(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
                {proposals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma proposta vinculada</p>
                ) : (
                  <div className="space-y-2">
                    {proposals.map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{p.titulo}</p>
                          <p className="text-xs text-muted-foreground">{p.descricao}</p>
                        </div>
                        <p className="text-sm font-bold text-primary">R$ {Number(p.valor || 0).toLocaleString("pt-BR")}</p>
                        <Badge variant="outline" className="text-xs">{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contratos Tab */}
          <TabsContent value="contratos">
            <Card>
              <CardContent className="space-y-4 pt-6">
                {contracts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum contrato vinculado a este lead</p>
                ) : (
                  <div className="space-y-2">
                    {contracts.map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.titulo}</p>
                          <p className="text-xs text-muted-foreground">{c.tipo} • Início: {c.data_inicio ? format(new Date(c.data_inicio), "dd/MM/yyyy") : "—"}</p>
                        </div>
                        <p className="text-sm font-bold text-hexa-green">R$ {Number(c.valor_mensal || 0).toLocaleString("pt-BR")}/mês</p>
                        <Badge className={c.status === "ativo" ? "bg-hexa-green/10 text-hexa-green" : "bg-muted text-muted-foreground"}>{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HexaLayout>
  );
}
