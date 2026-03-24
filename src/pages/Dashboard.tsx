import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/supabase-store";
import { SETORES } from "@/types/forms";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Users, ClipboardList, Repeat, AlertTriangle, Lightbulb, Wrench, Mic, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis,
} from "recharts";

const COLORS = ["#2a9d8f", "#e76f51", "#264653", "#e9c46a", "#f4a261", "#606c76", "#a855f7"];

const ESFORCO_MAP: Record<string, number> = { "Baixo": 1, "Médio": 2, "Alto": 3 };
const BENEFICIO_MAP: Record<string, number> = { "Tempo": 3, "Custo": 4, "Qualidade": 3, "Receita": 5, "Satisfação": 2 };

export default function Dashboard() {
  const [stats, setStats] = useState<any>({ daily: [], processes: [], bottlenecks: [], suggestions: [], toolMappings: [] });
  const [profilesCount, setProfilesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterSetor, setFilterSetor] = useState("Todos");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    Promise.all([db.getStats(), db.getProfilesCount()]).then(([s, c]) => {
      setStats(s);
      setProfilesCount(c);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const inRange = (date: string) => {
      if (!date) return true;
      const d = new Date(date);
      if (filterFrom && d < new Date(filterFrom)) return false;
      if (filterTo && d > new Date(filterTo + "T23:59:59")) return false;
      return true;
    };
    const bySector = (item: any, sectorField = "setor") =>
      filterSetor === "Todos" || item[sectorField] === filterSetor;

    return {
      daily: stats.daily.filter((d: any) => bySector(d) && inRange(d.created_at)),
      processes: stats.processes.filter((p: any) => inRange(p.created_at)),
      bottlenecks: stats.bottlenecks.filter((b: any) => inRange(b.created_at)),
      suggestions: stats.suggestions.filter((s: any) => bySector(s, "setor_impactado") && inRange(s.created_at)),
      toolMappings: stats.toolMappings.filter((t: any) => inRange(t.created_at)),
    };
  }, [stats, filterSetor, filterFrom, filterTo]);

  // Charts data
  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.daily.forEach((d: any) => { map[d.setor] = (map[d.setor] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered.daily]);

  const topProcesses = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.processes.forEach((p: any) => { map[p.processo] = (map[p.processo] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filtered.processes]);

  const urgencyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.bottlenecks.forEach((b: any) => { map[b.urgencia] = (map[b.urgencia] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered.bottlenecks]);

  const topBottlenecksBySector = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.bottlenecks.forEach((b: any) => {
      (b.impactos || []).forEach((imp: string) => { map[imp] = (map[imp] || 0) + 1; });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered.bottlenecks]);

  // Effort × Impact matrix for suggestions
  const effortImpactData = useMemo(() => {
    return filtered.suggestions.map((s: any) => ({
      name: (s.ideia || "").slice(0, 30),
      esforco: ESFORCO_MAP[s.esforco] || 2,
      impacto: BENEFICIO_MAP[s.beneficio] || 3,
      beneficio: s.beneficio,
      fullIdea: s.ideia,
    }));
  }, [filtered.suggestions]);

  // Most hated tools (lowest satisfaction)
  const mostHatedTools = useMemo(() => {
    const satisfactionOrder = ["Péssimo", "Ruim", "Regular", "Bom", "Ótimo"];
    return [...filtered.toolMappings]
      .sort((a: any, b: any) => satisfactionOrder.indexOf(a.satisfacao) - satisfactionOrder.indexOf(b.satisfacao))
      .slice(0, 5);
  }, [filtered.toolMappings]);

  // Tools most used
  const toolUsageData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.toolMappings.forEach((t: any) => { map[t.nome_ferramenta] = (map[t.nome_ferramenta] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtered.toolMappings]);

  // % audio contributions
  const audioStats = useMemo(() => {
    const total = filtered.daily.length + filtered.processes.length + filtered.bottlenecks.length + filtered.suggestions.length;
    // We check for transcricao_audio field presence as a proxy
    const withAudio = [
      ...filtered.daily.filter((d: any) => d.transcricao_audio),
      ...filtered.processes.filter((p: any) => p.transcricao_audio),
      ...filtered.bottlenecks.filter((b: any) => b.transcricao_audio),
      ...filtered.suggestions.filter((s: any) => s.transcricao_audio),
    ].length;
    return { total, withAudio, pct: total > 0 ? Math.round((withAudio / total) * 100) : 0 };
  }, [filtered]);

  // Financial impact estimate (based on time reported)
  const financialImpact = useMemo(() => {
    let totalMinutes = 0;
    filtered.processes.forEach((p: any) => {
      const match = (p.tempo_medio || "").match(/(\d+)/);
      if (match) {
        const mins = parseInt(match[1]);
        const freq = p.frequencia === "Diário" ? 22 : p.frequencia === "Semanal" ? 4 : p.frequencia === "Mensal" ? 1 : 2;
        totalMinutes += mins * freq;
      }
    });
    const hoursPerMonth = Math.round(totalMinutes / 60);
    const costPerHour = 50; // estimated R$/hour
    return { hoursPerMonth, costPerMonth: hoursPerMonth * costPerHour };
  }, [filtered.processes]);

  const handleExport = (format: "json" | "csv") => {
    const exportData = filterSetor === "Todos" ? stats : filtered;
    const data = { ...exportData, exportedAt: new Date().toISOString(), filters: { setor: filterSetor, from: filterFrom, to: filterTo } };
    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `hexamedical_export_${filterSetor}_${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const rows = [["Tipo", "Data", "Setor", "Conteúdo", "Urgência", "Benefício", "Esforço"]];
      exportData.daily.forEach((d: any) => rows.push(["Dia a Dia", d.created_at, d.setor, d.atividades_principais, "", "", ""]));
      exportData.toolMappings.forEach((t: any) => rows.push(["Ferramenta", t.created_at, "", `${t.nome_ferramenta} (${t.categoria}) - ${t.satisfacao}`, "", "", ""]));
      exportData.processes.forEach((p: any) => rows.push(["Processo", p.created_at, "", p.processo, "", "", ""]));
      exportData.bottlenecks.forEach((b: any) => rows.push(["Gargalo", b.created_at, "", b.descricao, b.urgencia, "", ""]));
      exportData.suggestions.forEach((s: any) => rows.push(["Sugestão", s.created_at, s.setor_impactado, s.ideia, "", s.beneficio, s.esforco]));
      const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `hexamedical_export_${filterSetor}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const cards = [
    { icon: Users, label: "Colaboradores", value: profilesCount, color: "text-hexa-teal" },
    { icon: ClipboardList, label: "Registros diários", value: filtered.daily.length, color: "text-hexa-navy" },
    { icon: Wrench, label: "Ferramentas", value: filtered.toolMappings.length, color: "text-primary" },
    { icon: Repeat, label: "Processos", value: filtered.processes.length, color: "text-hexa-purple" },
    { icon: AlertTriangle, label: "Gargalos", value: filtered.bottlenecks.length, color: "text-hexa-orange" },
    { icon: Lightbulb, label: "Sugestões", value: filtered.suggestions.length, color: "text-hexa-yellow" },
  ];

  if (loading) return <HexaLayout><p className="text-center text-muted-foreground py-12">Carregando dashboard...</p></HexaLayout>;

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        {/* Header + Filters */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="w-4 h-4 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("json")}><Download className="w-4 h-4 mr-1" />JSON</Button>
          </div>
        </div>

        <div className="hexa-card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={filterSetor} onValueChange={setFilterSetor}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" className="w-40" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" className="w-40" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          {(filterSetor !== "Todos" || filterFrom || filterTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterSetor("Todos"); setFilterFrom(""); setFilterTo(""); }}>Limpar</Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {cards.map(c => (
            <div key={c.label} className="hexa-card p-4">
              <c.icon className={`w-5 h-5 ${c.color} mb-2`} />
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Impact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="hexa-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-hexa-orange" />
              <span className="text-xs font-medium text-muted-foreground">Impacto Financeiro Estimado</span>
            </div>
            <p className="text-2xl font-bold text-hexa-orange">{financialImpact.hoursPerMonth}h/mês</p>
            <p className="text-sm text-muted-foreground">≈ R$ {financialImpact.costPerMonth.toLocaleString("pt-BR")}/mês em processos repetitivos</p>
          </div>
          <div className="hexa-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-hexa-purple" />
              <span className="text-xs font-medium text-muted-foreground">Contribuições com Áudio</span>
            </div>
            <p className="text-2xl font-bold text-hexa-purple">{audioStats.pct}%</p>
            <p className="text-sm text-muted-foreground">{audioStats.withAudio} de {audioStats.total} envios</p>
          </div>
          <div className="hexa-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-hexa-red" />
              <span className="text-xs font-medium text-muted-foreground">Gargalos Críticos</span>
            </div>
            <p className="text-2xl font-bold text-hexa-red">
              {filtered.bottlenecks.filter((b: any) => b.urgencia === "Crítica" || b.urgencia === "Alta").length}
            </p>
            <p className="text-sm text-muted-foreground">urgência alta ou crítica</p>
          </div>
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
                  <Bar dataKey="value" fill="hsl(30 90% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>}
          </div>

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
            ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>}
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="hexa-card p-5">
            <h3 className="font-semibold mb-4">Impactos Reportados</h3>
            {topBottlenecksBySector.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topBottlenecksBySector} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 18% 88%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(0 72% 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>}
          </div>

          <div className="hexa-card p-5">
            <h3 className="font-semibold mb-4">Matriz Esforço × Impacto (Sugestões)</h3>
            {effortImpactData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 18% 88%)" />
                  <XAxis type="number" dataKey="esforco" name="Esforço" domain={[0, 4]} tick={{ fontSize: 11 }} label={{ value: "Esforço →", position: "insideBottom", offset: -5, fontSize: 10 }} />
                  <YAxis type="number" dataKey="impacto" name="Impacto" domain={[0, 6]} tick={{ fontSize: 11 }} label={{ value: "Impacto →", angle: -90, position: "insideLeft", fontSize: 10 }} />
                  <ZAxis range={[80, 200]} />
                  <Tooltip content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-card p-2 rounded border shadow text-xs">
                        <p className="font-medium">{d.fullIdea?.slice(0, 60)}</p>
                        <p>Benefício: {d.beneficio} | Esforço: {["", "Baixo", "Médio", "Alto"][d.esforco]}</p>
                      </div>
                    );
                  }} />
                  <Scatter data={effortImpactData} fill="hsl(30 90% 50%)" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>}
          </div>
        </div>

        {/* Top Processes */}
        <div className="hexa-card p-5">
          <h3 className="font-semibold mb-4">Top Processos Repetitivos</h3>
          {topProcesses.length > 0 ? (
            <div className="space-y-2">
              {topProcesses.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex-1 bg-secondary rounded-full h-6 overflow-hidden">
                    <div className="h-full rounded-full flex items-center px-3 text-xs font-medium text-primary-foreground"
                      style={{ width: `${Math.max(30, (p.count / (topProcesses[0]?.count || 1)) * 100)}%`, background: "hsl(30 90% 50%)" }}>
                      {p.name}
                    </div>
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{p.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
        </div>

        {/* Most hated tools */}
        <div className="hexa-card p-5">
          <h3 className="font-semibold mb-4">🔥 Ferramentas Mais Odiadas</h3>
          {mostHatedTools.length > 0 ? (
            <div className="space-y-3">
              {mostHatedTools.map((t: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-secondary/50 border">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4 text-destructive" />
                    <span className="font-medium text-sm">{t.nome_ferramenta}</span>
                    <span className={`hexa-badge ${
                      t.satisfacao === "Péssimo" || t.satisfacao === "Ruim" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"
                    }`}>{t.satisfacao}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.problemas || "Sem problemas descritos"}</p>
                  {t.como_seria_ideal && <p className="text-xs mt-1 text-primary"><strong>Ideal:</strong> {t.como_seria_ideal}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
        </div>

        {/* Tools most used */}
        <div className="hexa-card p-5">
          <h3 className="font-semibold mb-4">Ferramentas Mais Usadas</h3>
          {toolUsageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={toolUsageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 18% 88%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(152 55% 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>}
        </div>
      </div>
    </HexaLayout>
  );
}
