import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Lightbulb, Loader2, Target } from "lucide-react";

const DOMAIN_META: Record<string, { label: string; color: string; icon: any }> = {
  comercial: { label: "Comercial", color: "border-l-orange-500", icon: Target },
  operacoes: { label: "Operações", color: "border-l-blue-500", icon: AlertTriangle },
  laboratorio: { label: "Laboratório", color: "border-l-green-500", icon: AlertTriangle },
  financeiro: { label: "Financeiro", color: "border-l-yellow-500", icon: AlertTriangle },
  general: { label: "Geral", color: "border-l-purple-500", icon: Lightbulb },
};

const PRIORITY_BADGE: Record<string, string> = {
  Alta: "bg-red-500/20 text-red-400 border-red-500/30",
  Média: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Baixa: "bg-green-500/20 text-green-400 border-green-500/30",
  Crítica: "bg-red-600/20 text-red-300 border-red-600/30",
};

export default function GargalosMap() {
  const queryClient = useQueryClient();

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ["focus_ai_insights", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("focus_ai_insights")
        .select("*")
        .neq("status", "resolvido")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("focus_ai_insights")
        .update({ status: "resolvido" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["focus_ai_insights"] });
      toast.success("Gargalo marcado como resolvido");
    },
    onError: () => toast.error("Erro ao resolver gargalo"),
  });

  const grouped = insights.reduce((acc, insight) => {
    const d = insight.domain || "general";
    if (!acc[d]) acc[d] = [];
    acc[d].push(insight);
    return acc;
  }, {} as Record<string, typeof insights>);

  const domainOrder = ["comercial", "operacoes", "laboratorio", "financeiro", "general"];
  const sortedDomains = domainOrder.filter(d => grouped[d]);

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold">Mapa de Gargalos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Insights detectados pela IA, agrupados por setor. Resolva ou arquive cada item.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedDomains.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <p className="text-lg font-medium">Tudo limpo!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Nenhum gargalo pendente foi detectado pela IA.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sortedDomains.map(domain => {
              const meta = DOMAIN_META[domain] || DOMAIN_META.general;
              const items = grouped[domain];
              return (
                <div key={domain} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <meta.icon className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      {meta.label}
                    </h2>
                    <Badge variant="secondary" className="text-[10px] h-5">{items.length}</Badge>
                  </div>
                  <ScrollArea className="max-h-[70vh]">
                    <div className="space-y-3 pr-2">
                      {items.map(insight => (
                        <Card key={insight.id} className={`border-l-4 ${meta.color} bg-card/50`}>
                          <CardContent className="py-4 px-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium text-sm leading-tight">{insight.titulo}</h3>
                              {insight.prioridade && (
                                <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_BADGE[insight.prioridade] || ""}`}>
                                  {insight.prioridade}
                                </Badge>
                              )}
                            </div>
                            {insight.causa_provavel && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/70">Causa:</span> {insight.causa_provavel}
                              </p>
                            )}
                            {insight.acao_recomendada && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/70">Ação:</span> {insight.acao_recomendada}
                              </p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-2 h-8 text-xs"
                              onClick={() => resolve.mutate(insight.id)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Resolver / Arquivar
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </HexaLayout>
  );
}
