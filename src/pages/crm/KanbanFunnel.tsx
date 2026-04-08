import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, User, DollarSign, TrendingUp, Users, Target, Bot, Zap } from "lucide-react";
import { toast } from "sonner";
import AISmartBadge from "@/components/AISmartBadge";
import { differenceInHours } from "date-fns";

const COLUMNS = ["Qualificação", "Contato Inicial", "Reunião", "Proposta Enviada", "Negociação", "Ganho", "Perdido"];

const COLUMN_COLORS: Record<string, string> = {
  "Qualificação": "border-t-blue-400",
  "Contato Inicial": "border-t-yellow-400",
  "Reunião": "border-t-purple-400",
  "Proposta Enviada": "border-t-orange-400",
  "Negociação": "border-t-teal-400",
  "Ganho": "border-t-green-400",
  "Perdido": "border-t-red-400",
};

export default function KanbanFunnel() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [winModalLead, setWinModalLead] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("leads").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setLeads(data || []);
    });
  }, [user]);

  const handleDrop = async (newStatus: string) => {
    if (!draggedId) return;
    const lead = leads.find(l => l.id === draggedId);

    // If moving to "Ganho", show the AI modal
    if (newStatus === "Ganho" && lead?.status !== "Ganho") {
      setWinModalLead(lead);
      // Update locally first
      setLeads(prev => prev.map(l => l.id === draggedId ? { ...l, status: "Ganho" } : l));
      await supabase.from("leads").update({ status: "Ganho" } as any).eq("id", draggedId);
      setDraggedId(null);
      return;
    }

    const { error } = await supabase.from("leads").update({ status: newStatus } as any).eq("id", draggedId);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === draggedId ? { ...l, status: newStatus } : l));
      toast.success(`Lead movido para ${newStatus}`);
    }
    setDraggedId(null);
  };

  const handleAutoGenerate = async () => {
    if (!winModalLead || !user) return;
    // Insert an ai_action_request for Hunter to generate OS + notify
    await supabase.from("ai_action_requests").insert({
      action_type: "generate_os_from_deal",
      domain: "comercial",
      title: `Gerar OS de Instalação para ${winModalLead.nome}`,
      description: `Lead ${winModalLead.nome} (${winModalLead.empresa || ""}) foi marcado como Ganho. Criar OS de instalação e notificar equipe técnica e financeira no MS Teams.`,
      reason: "Lead movido para Ganho no Kanban",
      risk_level: "low",
      status: "pending",
      requires_approval: false,
      estimated_impact: `Valor: R$ ${Number(winModalLead.valor_estimado || 0).toLocaleString("pt-BR")}`,
    } as any);
    toast.success("Hunter notificado! OS de instalação e notificação no Teams serão gerados automaticamente.");
    setWinModalLead(null);
  };

  // KPIs
  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, l) => sum + (Number(l.valor_estimado) || 0), 0);
  const wonValue = leads.filter(l => l.status === "Ganho").reduce((sum, l) => sum + (Number(l.valor_estimado) || 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round((leads.filter(l => l.status === "Ganho").length / totalLeads) * 100) : 0;

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-primary" /> Funil Comercial</h1>
            <p className="text-sm text-muted-foreground">Arraste os cards para atualizar o status</p>
          </div>
          <Link to="/crm"><Button variant="outline" size="sm" className="gap-1"><ArrowLeft className="w-4 h-4" /> Lista</Button></Link>
        </div>

        {/* Pipeline KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Leads</p>
                <p className="text-lg font-bold">{totalLeads}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-hexa-amber/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-hexa-amber" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline Total</p>
                <p className="text-lg font-bold">R$ {totalValue.toLocaleString("pt-BR")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-hexa-green/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-hexa-green" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ganhos</p>
                <p className="text-lg font-bold text-hexa-green">R$ {wonValue.toLocaleString("pt-BR")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <Target className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversão</p>
                <p className="text-lg font-bold">{conversionRate}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kanban */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colLeads = leads.filter(l => l.status === col);
            const colValue = colLeads.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);
            return (
              <div
                key={col}
                className={`min-w-[260px] flex-shrink-0 bg-muted/30 rounded-xl border-t-4 ${COLUMN_COLORS[col]} p-3`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{col}</h3>
                  <span className="text-xs bg-muted rounded-full px-2 py-0.5">{colLeads.length}</span>
                </div>
                {colValue > 0 && (
                  <p className="text-xs text-muted-foreground mb-2">R$ {colValue.toLocaleString("pt-BR")}</p>
                )}
                <div className="space-y-2">
                  {colLeads.map(lead => {
                    const lastContact = lead.ultimo_contato || lead.created_at;
                    const hoursInactive = differenceInHours(new Date(), new Date(lastContact));
                    const isInactive = hoursInactive > 72 && !["Ganho", "Perdido"].includes(lead.status);
                    return (
                      <Link
                        key={lead.id}
                        to={`/crm/${lead.id}`}
                        draggable
                        onDragStart={() => setDraggedId(lead.id)}
                        className="block p-3 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium truncate">{lead.nome}</p>
                          {isInactive && <AISmartBadge agent="Hunter" />}
                        </div>
                        {lead.empresa && <p className="text-xs text-muted-foreground">{lead.empresa}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          {lead.valor_estimado > 0 && (
                            <span className="text-xs text-hexa-green flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              R$ {Number(lead.valor_estimado).toLocaleString("pt-BR")}
                            </span>
                          )}
                          {lead.origem && (
                            <span className="text-xs text-muted-foreground">{lead.origem}</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Win Modal — Hunter auto-generate */}
        <Dialog open={!!winModalLead} onOpenChange={(open) => { if (!open) setWinModalLead(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-orange-400" /> Hunter — Contrato Fechado! 🎉
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O lead <strong>{winModalLead?.nome}</strong> foi marcado como <strong>Ganho</strong>.
              </p>
              <p className="text-sm">
                Deseja que a IA (Hunter) gere a <strong>Ordem de Serviço de Instalação</strong> e notifique a equipe técnica e financeira no <strong>MS Teams</strong>?
              </p>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setWinModalLead(null)}>
                Apenas Mover Card
              </Button>
              <Button onClick={handleAutoGenerate} className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                <Zap className="w-4 h-4" /> Gerar Tudo Automático
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </HexaLayout>
  );
}
