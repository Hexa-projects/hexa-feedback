import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, FileText, Wrench, FlaskConical, Plus, ClipboardList,
  AlertTriangle, Clock, TrendingUp, ArrowRight
} from "lucide-react";

export default function HomePage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ leads: 0, osAbertas: 0, pecasReparo: 0, propostas: 0 });
  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("status", "Aberto"),
      supabase.from("lab_parts").select("id", { count: "exact", head: true }).neq("status", "Pronta"),
      supabase.from("proposals").select("id", { count: "exact", head: true }),
      supabase.from("work_orders").select("*").order("created_at", { ascending: false }).limit(5),
    ]).then(([leads, os, parts, props, recent]) => {
      setStats({
        leads: leads.count || 0,
        osAbertas: os.count || 0,
        pecasReparo: parts.count || 0,
        propostas: props.count || 0,
      });
      setRecentOS(recent.data || []);
      setLoading(false);
    });
  }, [user]);

  const quickActions = [
    { label: "Novo Lead", icon: Plus, to: "/crm/new", color: "bg-primary" },
    { label: "Abrir OS", icon: ClipboardList, to: "/os/new", color: "bg-hexa-green" },
    { label: "Registrar Peça", icon: FlaskConical, to: "/lab/new", color: "bg-hexa-purple" },
    { label: "Nova Proposta", icon: FileText, to: "/crm/proposals/new", color: "bg-hexa-amber-dark" },
  ];

  const summaryCards = [
    { label: "Leads Ativos", value: stats.leads, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "OS Abertas", value: stats.osAbertas, icon: Wrench, color: "text-hexa-amber", bg: "bg-hexa-amber/10" },
    { label: "Peças em Reparo", value: stats.pecasReparo, icon: FlaskConical, color: "text-hexa-purple", bg: "bg-hexa-purple/10" },
    { label: "Propostas", value: stats.propostas, icon: FileText, color: "text-hexa-green", bg: "bg-hexa-green/10" },
  ];

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Aberto": return "status-badge-open";
      case "Em Atendimento": return "status-badge-progress";
      case "Concluído": return "status-badge-done";
      default: return "status-badge-open";
    }
  };

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold">
            Olá, {profile?.nome?.split(" ")[0] || "Usuário"} 👋
          </h1>
          <p className="text-muted-foreground text-sm">Aqui está o resumo do seu dia.</p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 flex-wrap">
          {quickActions.map(a => (
            <Link key={a.label} to={a.to}>
              <Button variant="outline" className="gap-2 h-10">
                <a.icon className="w-4 h-4" />
                {a.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map(c => (
            <Card key={c.label} className="border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? "..." : c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent OS */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-lg">Ordens de Serviço Recentes</CardTitle>
            <Link to="/os">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Carregando...</p>
            ) : recentOS.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma OS registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {recentOS.map(os => (
                  <Link
                    key={os.id}
                    to={`/os/${os.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{os.numero_os || "Sem número"} — {os.cliente}</p>
                        <p className="text-xs text-muted-foreground">{os.equipamento}</p>
                      </div>
                    </div>
                    <span className={getStatusClass(os.status)}>{os.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
