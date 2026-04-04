import { useEffect, useState, useCallback } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, TrendingUp, Clock, AlertTriangle, RefreshCw,
  CheckCircle2, BarChart3, Zap
} from "lucide-react";
import { toast } from "sonner";

export default function OpenClawKpiDashboard() {
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [kpiRes, actionsRes] = await Promise.all([
      supabase.from("kpi_snapshots").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("action_queue").select("*").eq("status", "pending").eq("requires_review", true).order("created_at", { ascending: false }).limit(10),
    ]);

    const kpiMap: Record<string, number> = {};
    (kpiRes.data || []).forEach((k: any) => {
      if (!kpiMap[k.kpi_key]) kpiMap[k.kpi_key] = k.value;
    });
    setKpis(kpiMap);
    setPendingActions((actionsRes.data || []) as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleComputeKpis = async () => {
    setComputing(true);
    const { data, error } = await supabase.functions.invoke("compute-kpis");
    if (error) toast.error("Erro ao recalcular KPIs");
    else {
      toast.success("KPIs recalculados com sucesso");
      setKpis(data?.kpis || {});
    }
    await loadData();
    setComputing(false);
  };

  const kpiCards = [
    { key: "ops_events_total", label: "Eventos Hoje", icon: Activity, color: "text-blue-600" },
    { key: "ops_events_week", label: "Eventos (7d)", icon: BarChart3, color: "text-indigo-600" },
    { key: "agent_success_rate", label: "Taxa Sucesso Agente", icon: CheckCircle2, color: "text-green-600", suffix: "%" },
    { key: "avg_time_to_close", label: "Tempo Médio (min)", icon: Clock, color: "text-amber-600" },
    { key: "needs_review_count", label: "Aguardando Revisão", icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <HexaLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              Dashboard KPIs — OpenClaw
            </h1>
            <p className="text-sm text-muted-foreground">Indicadores operacionais em tempo real do agente autônomo.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleComputeKpis} disabled={computing} size="sm" className="gap-1">
              {computing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Recalcular KPIs
            </Button>
            <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {kpiCards.map(k => (
            <Card key={k.key}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <k.icon className={`w-8 h-8 ${k.color}`} />
                  <div>
                    <p className="text-2xl font-bold">
                      {kpis[k.key] !== undefined ? kpis[k.key] : "—"}
                      {k.suffix && kpis[k.key] !== undefined ? k.suffix : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending Review */}
        {pendingActions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Ações Aguardando Revisão ({pendingActions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingActions.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Badge variant="outline" className="text-xs">{a.action_type}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={async () => {
                          await supabase.from("action_queue").update({ status: "approved" }).eq("id", a.id);
                          toast.success("Ação aprovada");
                          loadData();
                        }}>Aprovar</Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive"
                        onClick={async () => {
                          await supabase.from("action_queue").update({ status: "rejected" }).eq("id", a.id);
                          toast.info("Ação rejeitada");
                          loadData();
                        }}>Rejeitar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </HexaLayout>
  );
}
