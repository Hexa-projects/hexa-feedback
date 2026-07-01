import { useEffect, useMemo, useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { QualityAction, QualityCase } from "./qualityTypes";
import { isActionOverdue } from "./qualityUtils";

const COLORS = ["#2563eb", "#f59e0b", "#16a34a", "#dc2626", "#7c3aed", "#0891b2"];

export default function QualityReports() {
  const [cases, setCases] = useState<QualityCase[]>([]);
  const [actions, setActions] = useState<QualityAction[]>([]);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    Promise.all([
      (supabase as any).from("quality_cases").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("quality_actions").select("*"),
    ]).then(([caseRes, actionRes]) => {
      setCases(caseRes.data || []);
      setActions(actionRes.data || []);
    });
  }, []);

  const filtered = useMemo(() => {
    if (period === "all") return cases;
    const days = Number(period);
    const since = new Date();
    since.setDate(since.getDate() - days);
    return cases.filter(item => new Date(item.created_at) >= since);
  }, [cases, period]);

  const byStatus = useMemo(() => groupData(filtered, "status"), [filtered]);
  const byOrigin = useMemo(() => groupData(filtered, "origem"), [filtered]);
  const effective = filtered.filter(c => c.status === "eficaz" || c.status === "encerrada").length;
  const effectivenessRate = filtered.length ? Math.round((effective / filtered.length) * 100) : 0;
  const overdueActions = actions.filter(isActionOverdue).length;
  const averageCloseDays = useMemo(() => {
    const closed = filtered.filter(c => c.closed_at);
    if (!closed.length) return 0;
    const total = closed.reduce((sum, item) => sum + Math.max(0, Math.round((new Date(item.closed_at!).getTime() - new Date(item.created_at).getTime()) / 86400000)), 0);
    return Math.round(total / closed.length);
  }, [filtered]);

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-primary" /> Relatorios da Qualidade</h1>
            <p className="text-sm text-muted-foreground">Indicadores de RACP, eficacia e atrasos</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Ultimos 30 dias</SelectItem>
              <SelectItem value="90">Ultimos 90 dias</SelectItem>
              <SelectItem value="180">Ultimos 180 dias</SelectItem>
              <SelectItem value="all">Todo periodo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric title="Total RACP" value={filtered.length} />
          <Metric title="Taxa eficacia" value={`${effectivenessRate}%`} />
          <Metric title="Acoes atrasadas" value={overdueActions} />
          <Metric title="Tempo medio" value={`${averageCloseDays}d`} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Por status</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStatus}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#2563eb" /></BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Por origem</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={byOrigin} dataKey="value" nameKey="name" outerRadius={95} label>{byOrigin.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </HexaLayout>
  );
}

function groupData(rows: QualityCase[], key: keyof QualityCase) {
  const map = new Map<string, number>();
  rows.forEach(row => {
    const value = String(row[key] || "Nao informado");
    map.set(value, (map.get(value) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="text-xl font-bold">{value}</p></CardContent></Card>;
}
