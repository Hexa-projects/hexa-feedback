import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase-store";
import HexaLayout from "@/components/HexaLayout";
import { ClipboardList, Repeat, AlertTriangle, Lightbulb, Wrench } from "lucide-react";

export default function HistoryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    daily: any[]; processes: any[]; bottlenecks: any[]; suggestions: any[]; tools: any[];
  }>({ daily: [], processes: [], bottlenecks: [], suggestions: [], tools: [] });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      db.getDailyForms(user.id),
      db.getProcesses(user.id),
      db.getBottlenecks(user.id),
      db.getSuggestions(user.id),
      db.getToolMappings(user.id),
    ]).then(([daily, processes, bottlenecks, suggestions, tools]) => {
      setData({ daily, processes, bottlenecks, suggestions, tools });
      setLoading(false);
    });
  }, [user]);

  const allItems = [
    ...data.daily.map(d => ({ type: "daily" as const, date: d.created_at, title: (d.atividades_principais || "").slice(0, 80) })),
    ...data.tools.map(t => ({ type: "tool" as const, date: t.created_at, title: `${t.nome_ferramenta} — ${t.categoria}` })),
    ...data.processes.map(p => ({ type: "process" as const, date: p.created_at, title: p.processo })),
    ...data.bottlenecks.map(b => ({ type: "bottleneck" as const, date: b.created_at, title: (b.descricao || "").slice(0, 80) })),
    ...data.suggestions.map(s => ({ type: "suggestion" as const, date: s.created_at, title: (s.ideia || "").slice(0, 80) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const icons = {
    daily: <ClipboardList className="w-4 h-4 text-hexa-teal" />,
    tool: <Wrench className="w-4 h-4 text-primary" />,
    process: <Repeat className="w-4 h-4 text-hexa-purple" />,
    bottleneck: <AlertTriangle className="w-4 h-4 text-hexa-orange" />,
    suggestion: <Lightbulb className="w-4 h-4 text-hexa-yellow" />,
  };
  const labels = { daily: "Dia a Dia", tool: "Ferramenta", process: "Processo", bottleneck: "Gargalo", suggestion: "Sugestão" };

  if (loading) return <HexaLayout><p className="text-center text-muted-foreground py-12">Carregando...</p></HexaLayout>;

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <h1 className="text-2xl font-bold">Meu Histórico</h1>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {([["daily", data.daily.length], ["tool", data.tools.length], ["process", data.processes.length], ["bottleneck", data.bottlenecks.length], ["suggestion", data.suggestions.length]] as const).map(([type, count]) => (
            <div key={type} className="hexa-card p-4 text-center">
              <div className="flex justify-center mb-2">{icons[type]}</div>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground">{labels[type]}</p>
            </div>
          ))}
        </div>

        {allItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhum envio ainda. Comece preenchendo um formulário!</p>
        ) : (
          <div className="space-y-2">
            {allItems.map((item, i) => (
              <div key={i} className="hexa-card p-4 flex items-start gap-3">
                <div className="mt-0.5">{icons[item.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title || "Sem título"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="hexa-badge bg-secondary text-secondary-foreground">{labels[item.type]}</span>
                    <span className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </HexaLayout>
  );
}
