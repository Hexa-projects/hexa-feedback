import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Lightbulb, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

export default function AuditDashboard() {
  const { data: insights = [] } = useQuery({
    queryKey: ["focus-insights"],
    queryFn: async () => {
      const { data } = await supabase.from("focus_ai_insights").select("*").order("created_at", { ascending: false }).limit(30);
      return data || [];
    },
  });

  const { data: onboardingCount } = useQuery({
    queryKey: ["onboarding-count"],
    queryFn: async () => {
      const { count } = await supabase.from("onboarding_responses" as any).select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const typeIcon = (tipo: string | null) => {
    if (tipo === "alerta") return <AlertTriangle className="w-4 h-4 text-red-400" />;
    if (tipo === "oportunidade") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (tipo === "gargalo") return <Target className="w-4 h-4 text-yellow-400" />;
    return <Lightbulb className="w-4 h-4 text-blue-400" />;
  };

  const prioColor = (p: string | null) => {
    if (p === "Alta" || p === "Crítica") return "bg-red-500/20 text-red-300";
    if (p === "Média") return "bg-yellow-500/20 text-yellow-300";
    return "bg-emerald-500/20 text-emerald-300";
  };

  return (
    <HexaLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Auditoria & Onboarding</h1>
          <p className="text-sm text-muted-foreground">Vigiado por Focus AI</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="cyber-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{onboardingCount}</p>
              <p className="text-xs text-muted-foreground">Onboardings</p>
            </CardContent>
          </Card>
          <Card className="cyber-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{insights.filter((i: any) => i.tipo === "gargalo").length}</p>
              <p className="text-xs text-muted-foreground">Gargalos</p>
            </CardContent>
          </Card>
          <Card className="cyber-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{insights.filter((i: any) => i.tipo === "alerta").length}</p>
              <p className="text-xs text-muted-foreground">Alertas</p>
            </CardContent>
          </Card>
          <Card className="cyber-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{insights.filter((i: any) => i.tipo === "oportunidade").length}</p>
              <p className="text-xs text-muted-foreground">Oportunidades</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3">
          <Link to="/onboarding" className="text-xs text-primary hover:underline">→ Formulário de Onboarding</Link>
          <Link to="/daily" className="text-xs text-primary hover:underline">→ Daily Forms</Link>
        </div>

        {/* Insights / Gargalos */}
        <Card className="cyber-card cyber-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mapa de Gargalos & Insights</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 p-3">
                {insights.map((ins: any) => (
                  <div key={ins.id} className="cyber-card p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      {typeIcon(ins.tipo)}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{ins.titulo}</p>
                        {ins.descricao && <p className="text-xs text-muted-foreground mt-0.5">{ins.descricao}</p>}
                      </div>
                      <Badge className={`text-[10px] border-0 ${prioColor(ins.prioridade)}`}>{ins.prioridade}</Badge>
                    </div>
                    {ins.acao_recomendada && (
                      <p className="text-xs text-primary/80 pl-6">→ {ins.acao_recomendada}</p>
                    )}
                  </div>
                ))}
                {insights.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum insight ainda</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
