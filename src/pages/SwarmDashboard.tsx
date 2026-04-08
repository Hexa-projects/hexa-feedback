import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Target, Wrench, Package, DollarSign, CheckCircle, XCircle, Clock, Activity } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Agent {
  id: string;
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  role: string;
  status: "monitoring" | "executing" | "idle";
}

const AGENTS: Agent[] = [
  { id: "focus", name: "Focus AI", icon: Brain, color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20", role: "Orquestrador & Estratégia", status: "monitoring" },
  { id: "hunter", name: "Hunter", icon: Target, color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20", role: "Vigiar Leads & Contratos", status: "monitoring" },
  { id: "gear", name: "Gear", icon: Wrench, color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", role: "SLAs de OS & Técnicos", status: "monitoring" },
  { id: "tracker", name: "Tracker", icon: Package, color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20", role: "Peças & Estoque", status: "monitoring" },
  { id: "ledger", name: "Ledger", icon: DollarSign, color: "text-yellow-400", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20", role: "Faturamento & Rentabilidade", status: "idle" },
];

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card className={`cyber-card ${agent.borderColor} cyber-glow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg ${agent.bgColor} flex items-center justify-center`}>
            <agent.icon className={`w-5 h-5 ${agent.color}`} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${agent.status === "monitoring" ? "bg-emerald-400 animate-pulse" : agent.status === "executing" ? "bg-blue-400 animate-pulse" : "bg-muted-foreground/40"}`} />
            <span className="text-[10px] text-muted-foreground capitalize">
              {agent.status === "monitoring" ? "Monitorando" : agent.status === "executing" ? "Executando" : "Standby"}
            </span>
          </div>
        </div>
        <h3 className={`text-sm font-semibold ${agent.color}`}>{agent.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{agent.role}</p>
      </CardContent>
    </Card>
  );
}

export default function SwarmDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch logs
  const { data: logs = [] } = useQuery({
    queryKey: ["focus-ai-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("focus_ai_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 8000,
  });

  // Fetch pending approvals
  const { data: approvals = [] } = useQuery({
    queryKey: ["ai-approvals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_action_requests")
        .select("*")
        .in("status", ["pending", "pending_approval"])
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 10000,
  });

  const updateApproval = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("ai_action_requests")
        .update({ status, approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-approvals"] });
      toast.success("Ação atualizada");
    },
  });

  const agentBadge = (tipo: string) => {
    if (tipo?.includes("hunter") || tipo?.includes("comercial")) return { label: "Hunter", cls: "bg-orange-500/20 text-orange-300" };
    if (tipo?.includes("gear") || tipo?.includes("operac")) return { label: "Gear", cls: "bg-blue-500/20 text-blue-300" };
    if (tipo?.includes("tracker") || tipo?.includes("estoque")) return { label: "Tracker", cls: "bg-emerald-500/20 text-emerald-300" };
    if (tipo?.includes("ledger") || tipo?.includes("financ")) return { label: "Ledger", cls: "bg-yellow-500/20 text-yellow-300" };
    return { label: "Focus", cls: "bg-purple-500/20 text-purple-300" };
  };

  const riskColor = (risk: string | null) => {
    if (risk === "high" || risk === "critical") return "text-red-400";
    if (risk === "medium") return "text-yellow-400";
    return "text-emerald-400";
  };

  return (
    <HexaLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">The Swarm</h1>
          <p className="text-sm text-muted-foreground">Centro de Comando Multi-Agentes</p>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {AGENTS.map(a => <AgentCard key={a.id} agent={a} />)}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Timeline */}
          <Card className="cyber-card cyber-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Timeline Proativa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y divide-border/30">
                  {logs.length === 0 && (
                    <p className="text-xs text-muted-foreground p-4">Nenhum log recente.</p>
                  )}
                  {logs.map((log: any) => {
                    const badge = agentBadge(log.tipo);
                    return (
                      <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                        <Badge className={`text-[10px] shrink-0 mt-0.5 ${badge.cls} border-0`}>{badge.label}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground/90">{log.mensagem}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Approval Queue */}
          <Card className="cyber-card cyber-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                Fila de Aprovações
                {approvals.length > 0 && (
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-0 text-[10px]">{approvals.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 p-3">
                  {approvals.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Nenhuma aprovação pendente.</p>
                  )}
                  {approvals.map((req: any) => (
                    <div key={req.id} className="cyber-card p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{req.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{req.description || req.reason}</p>
                        </div>
                        <span className={`text-[10px] font-medium ${riskColor(req.risk_level)}`}>
                          {req.risk_level?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">{req.domain}</Badge>
                        <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">{req.action_type}</Badge>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-xs"
                          onClick={() => updateApproval.mutate({ id: req.id, status: "approved" })}>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                          onClick={() => updateApproval.mutate({ id: req.id, status: "rejected" })}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </HexaLayout>
  );
}
