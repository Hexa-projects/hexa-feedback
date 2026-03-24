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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";

const STATUSES = ["Qualificação", "Contato Inicial", "Reunião", "Proposta Enviada", "Negociação", "Ganho", "Perdido"];

export default function LeadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("leads").select("*").eq("id", id).single(),
      supabase.from("lead_interactions").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]).then(([leadRes, intRes]) => {
      setLead(leadRes.data);
      setInteractions(intRes.data || []);
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
    }).eq("id", lead.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Lead atualizado!" });
    setSaving(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user || !id) return;
    const { data, error } = await supabase.from("lead_interactions").insert({
      lead_id: id, user_id: user.id, tipo: "nota", conteudo: newNote.trim(),
    }).select().single();
    if (!error && data) {
      setInteractions(prev => [data, ...prev]);
      setNewNote("");
    }
  };

  if (loading) return <HexaLayout><p className="text-muted-foreground p-6">Carregando...</p></HexaLayout>;
  if (!lead) return <HexaLayout><p className="text-muted-foreground p-6">Lead não encontrado</p></HexaLayout>;

  return (
    <HexaLayout>
      <div className="max-w-3xl mx-auto space-y-4 animate-slide-up">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/crm")}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <Card>
          <CardHeader><CardTitle>Editar Lead: {lead.nome}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={lead.nome} onChange={e => setLead({ ...lead, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input value={lead.empresa} onChange={e => setLead({ ...lead, empresa: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={lead.telefone} onChange={e => setLead({ ...lead, telefone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={lead.status} onValueChange={v => setLead({ ...lead, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor Estimado</Label>
                <Input type="number" value={lead.valor_estimado} onChange={e => setLead({ ...lead, valor_estimado: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={lead.notas} onChange={e => setLead({ ...lead, notas: e.target.value })} rows={3} />
            </div>
            <Button onClick={handleUpdate} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardContent>
        </Card>

        {/* Interactions */}
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Histórico de Interações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Adicionar nota..." rows={2} className="flex-1" />
              <Button onClick={handleAddNote} size="icon" disabled={!newNote.trim()}><Send className="w-4 h-4" /></Button>
            </div>
            {interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma interação registrada</p>
            ) : (
              <div className="space-y-3">
                {interactions.map(i => (
                  <div key={i.id} className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-sm">{i.conteudo}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(i.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
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
