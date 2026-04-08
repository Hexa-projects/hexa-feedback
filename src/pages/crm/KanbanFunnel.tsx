import { useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Target, Clock } from "lucide-react";

const STAGES = [
  { id: "prospeccao", label: "Prospecção", color: "border-blue-500/40" },
  { id: "qualificacao", label: "Qualificação", color: "border-cyan-500/40" },
  { id: "proposta", label: "Proposta", color: "border-purple-500/40" },
  { id: "negociacao", label: "Negociação", color: "border-yellow-500/40" },
  { id: "ganho", label: "Ganho", color: "border-emerald-500/40" },
  { id: "perdido", label: "Perdido", color: "border-red-500/40" },
];

export default function KanbanFunnel() {
  const queryClient = useQueryClient();
  const [winModal, setWinModal] = useState<any>(null);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-kanban"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads-kanban"] }),
  });

  const confirmWin = async (auto: boolean) => {
    if (!winModal) return;
    await updateLead.mutateAsync({ id: winModal.id, status: "ganho" });
    if (auto) {
      await supabase.from("ai_action_requests").insert({
        action_type: "auto_generate_post_sale",
        domain: "comercial",
        title: `Gerar OS e Faturamento para ${winModal.nome}`,
        reason: "Lead convertido. Hunter sugere gerar OS de instalação.",
        risk_level: "low",
        status: "pending",
      });
      toast.success("OS e notificações serão geradas pelo Hunter");
    }
    setWinModal(null);
    toast.success("Lead movido para Ganho!");
  };

  const getDays = (lead: any) => {
    const d = lead.updated_at || lead.created_at;
    return d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;
  };

  return (
    <HexaLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Kanban CRM</h1>
          <p className="text-sm text-muted-foreground">Vigiado por Hunter</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageLeads = leads.filter((l: any) => (l.status || "prospeccao") === stage.id);
            return (
              <div key={stage.id} className={`min-w-[250px] w-[250px] shrink-0 cyber-card ${stage.color} p-3`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stage.label}</h3>
                  <Badge variant="outline" className="text-[10px] border-border/40">{stageLeads.length}</Badge>
                </div>
                <ScrollArea className="h-[calc(100vh-220px)]">
                  <div className="space-y-2">
                    {stageLeads.map((lead: any) => {
                      const days = getDays(lead);
                      const stale = days > 3;
                      return (
                        <Card key={lead.id} className="cyber-card hover:border-primary/30 transition-colors">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium">{lead.nome}</p>
                              {stale && <Target className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                            </div>
                            {lead.empresa && <p className="text-xs text-muted-foreground">{lead.empresa}</p>}
                            <div className="flex items-center justify-between">
                              {lead.valor_estimado ? <span className="text-xs font-medium text-emerald-400">R$ {Number(lead.valor_estimado).toLocaleString("pt-BR")}</span> : <span />}
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" /><span className={stale ? "text-orange-400" : ""}>{days}d</span>
                              </div>
                            </div>
                            {stage.id === "negociacao" && (
                              <Button size="sm" variant="outline" className="h-6 text-[10px] w-full border-emerald-500/30 text-emerald-400"
                                onClick={() => setWinModal(lead)}>Marcar como Ganho</Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>
      <Dialog open={!!winModal} onOpenChange={() => setWinModal(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-orange-400" />Hunter detectou novo contrato</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja gerar OS de Instalação e notificar equipe?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => confirmWin(false)} className="text-xs">Apenas Mover</Button>
            <Button onClick={() => confirmWin(true)} className="text-xs bg-emerald-600 hover:bg-emerald-700">Gerar Tudo Automático</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HexaLayout>
  );
}
