import { useMemo } from "react";
import { store } from "@/lib/store";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Download, Users, ClipboardList, Repeat, AlertTriangle, Lightbulb, Wrench } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#2a9d8f", "#e76f51", "#264653", "#e9c46a", "#f4a261", "#606c76", "#a855f7"];

export default function Dashboard() {
  const stats = store.getStats();

  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    stats.daily.forEach(d => { map[d.setor] = (map[d.setor] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [stats.daily]);

  const topProcesses = useMemo(() => {
    const map: Record<string, number> = {};
    stats.processes.forEach(p => { map[p.processo] = (map[p.processo] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [stats.processes]);

  const urgencyData = useMemo(() => {
    const map: Record<string, number> = {};
    stats.bottlenecks.forEach(b => { map[b.urgencia] = (map[b.urgencia] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [stats.bottlenecks]);

  const toolCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    stats.toolMappings.forEach(t => { map[t.categoria] = (map[t.categoria] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [stats.toolMappings]);

  const toolSatisfactionData = useMemo(() => {
    const map: Record<string, number> = {};
    stats.toolMappings.forEach(t => { map[t.satisfacao] = (map[t.satisfacao] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [stats.toolMappings]);

  const toolsWantReplace = useMemo(() => {
    return stats.toolMappings.filter(t => t.gostariaSubstituir);
  }, [stats.toolMappings]);

  const handleExport = (format: "json" | "csv") => {
    const data = store.exportAll();
    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `hexamedical_export_${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const rows = [["Tipo", "Data", "Setor", "Conteúdo"]];
      data.daily.forEach(d => rows.push(["Dia a Dia", d.createdAt, d.setor, d.atividadesPrincipais]));
      data.toolMappings.forEach(t => rows.push(["Ferramenta", t.createdAt, "", `${t.nomeFerramentaOuPlanilha} (${t.categoria}) - ${t.finalidade}`]));
      data.processes.forEach(p => rows.push(["Processo", p.createdAt, "", p.processo]));
      data.bottlenecks.forEach(b => rows.push(["Gargalo", b.createdAt, "", b.descricao]));
      data.suggestions.forEach(s => rows.push(["Sugestão", s.createdAt, s.setorImpactado, s.ideia]));
      const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `hexamedical_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const cards = [
    { icon: Users, label: "Colaboradores", value: store.getUsers().length, color: "text-hexa-teal" },
    { icon: ClipboardList, label: "Registros diários", value: stats.daily.length, color: "text-hexa-navy" },
    { icon: Wrench, label: "Ferramentas mapeadas", value: stats.toolMappings.length, color: "text-primary" },
    { icon: Repeat, label: "Processos", value: stats.processes.length, color: "text-hexa-purple" },
    { icon: AlertTriangle, label: "Gargalos", value: stats.bottlenecks.length, color: "text-hexa-orange" },
    { icon: Lightbulb, label: "Sugestões", value: stats.suggestions.length, color: "text-hexa-yellow" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
              <Download className="w-4 h-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
              <Download className="w-4 h-4 mr-1" />JSON
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {cards.map(c => (
            <div key={c.label} className="hexa-card p-4">
              <c.icon className={`w-5 h-5 ${c.color} mb-2`} />
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="hexa-card p-5">
            <h3 className="font-semibold mb-4">Contribuições por Setor</h3>
            {sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sectorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 18% 88%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(174 62% 40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados ainda</p>}
          </div>

          <div className="hexa-card p-5">
            <h3 className="font-semibold mb-4">Ferramentas por Categoria</h3>
            {toolCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={toolCategoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 18% 88%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(30 90% 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados ainda</p>}
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="hexa-card p-5">
            <h3 className="font-semibold mb-4">Gargalos por Urgência</h3>
            {urgencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={urgencyData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {urgencyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados ainda</p>}
          </div>

          <div className="hexa-card p-5">
            <h3 className="font-semibold mb-4">Satisfação com Ferramentas Atuais</h3>
            {toolSatisfactionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={toolSatisfactionData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {toolSatisfactionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados ainda</p>}
          </div>
        </div>

        {/* Top processes */}
        <div className="hexa-card p-5">
          <h3 className="font-semibold mb-4">Top Processos Repetitivos</h3>
          {topProcesses.length > 0 ? (
            <div className="space-y-2">
              {topProcesses.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex-1 bg-secondary rounded-full h-6 overflow-hidden">
                    <div className="h-full rounded-full flex items-center px-3 text-xs font-medium text-primary-foreground" style={{ width: `${Math.max(30, (p.count / (topProcesses[0]?.count || 1)) * 100)}%`, background: "hsl(174 62% 40%)" }}>
                      {p.name}
                    </div>
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{p.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados ainda</p>}
        </div>

        {/* Tools wanting replacement */}
        <div className="hexa-card p-5">
          <h3 className="font-semibold mb-4">🔄 Ferramentas que Querem Substituição ({toolsWantReplace.length})</h3>
          {toolsWantReplace.length > 0 ? (
            <div className="space-y-3">
              {toolsWantReplace.map((t, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary/50 border">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{t.nomeFerramentaOuPlanilha}</span>
                    <span className="hexa-badge bg-destructive/10 text-destructive">{t.satisfacao}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.problemas || "Sem problemas descritos"}</p>
                  {t.comoSeriaIdeal && (
                    <p className="text-xs mt-1 text-primary"><strong>Ideal:</strong> {t.comoSeriaIdeal}</p>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ferramenta marcada para substituição ainda</p>}
        </div>
      </div>
    </AppLayout>
  );
}
