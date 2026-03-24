import { store } from "@/lib/store";
import AppLayout from "@/components/AppLayout";
import { ClipboardList, Repeat, AlertTriangle, Lightbulb, Wrench } from "lucide-react";

export default function HistoryPage() {
  const user = store.getCurrentUser();
  const stats = store.getStats();

  const myDaily = stats.daily.filter(d => d.userId === user?.id);
  const myProcesses = stats.processes.filter(p => p.userId === user?.id);
  const myBottlenecks = stats.bottlenecks.filter(b => b.userId === user?.id);
  const mySuggestions = stats.suggestions.filter(s => s.userId === user?.id);
  const myTools = stats.toolMappings.filter(t => t.userId === user?.id);

  const allItems = [
    ...myDaily.map(d => ({ type: "daily" as const, date: d.createdAt, title: d.atividadesPrincipais.slice(0, 80) })),
    ...myTools.map(t => ({ type: "tool" as const, date: t.createdAt, title: `${t.nomeFerramentaOuPlanilha} — ${t.categoria}` })),
    ...myProcesses.map(p => ({ type: "process" as const, date: p.createdAt, title: p.processo })),
    ...myBottlenecks.map(b => ({ type: "bottleneck" as const, date: b.createdAt, title: b.descricao.slice(0, 80) })),
    ...mySuggestions.map(s => ({ type: "suggestion" as const, date: s.createdAt, title: s.ideia.slice(0, 80) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const icons = {
    daily: <ClipboardList className="w-4 h-4 text-hexa-teal" />,
    tool: <Wrench className="w-4 h-4 text-primary" />,
    process: <Repeat className="w-4 h-4 text-hexa-purple" />,
    bottleneck: <AlertTriangle className="w-4 h-4 text-hexa-orange" />,
    suggestion: <Lightbulb className="w-4 h-4 text-hexa-yellow" />,
  };

  const labels = { daily: "Dia a Dia", tool: "Ferramenta", process: "Processo", bottleneck: "Gargalo", suggestion: "Sugestão" };

  return (
    <AppLayout>
      <div className="space-y-6 animate-slide-up">
        <h1 className="text-2xl font-bold">Meu Histórico</h1>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {([["daily", myDaily.length], ["tool", myTools.length], ["process", myProcesses.length], ["bottleneck", myBottlenecks.length], ["suggestion", mySuggestions.length]] as const).map(([type, count]) => (
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
    </AppLayout>
  );
}
