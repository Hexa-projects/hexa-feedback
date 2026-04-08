import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function FinanceDashboard() {
  const { data: records = [] } = useQuery({
    queryKey: ["financial-records"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_records").select("*").order("created_at", { ascending: true });
      return data || [];
    },
  });

  const monthly = records.reduce((acc: Record<string, { month: string; receita: number; custo: number }>, r: any) => {
    const d = new Date(r.data_vencimento || r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = { month: key, receita: 0, custo: 0 };
    if (r.tipo === "receita") acc[key].receita += Number(r.valor) || 0;
    else acc[key].custo += Number(r.valor) || 0;
    return acc;
  }, {});
  const chartData = Object.values(monthly).sort((a, b) => (a as any).month.localeCompare((b as any).month));
  const totalR = records.filter((r: any) => r.tipo === "receita").reduce((s: number, r: any) => s + (Number(r.valor) || 0), 0);
  const totalC = records.filter((r: any) => r.tipo !== "receita").reduce((s: number, r: any) => s + (Number(r.valor) || 0), 0);

  return (
    <HexaLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Dashboard Financeiro</h1><p className="text-sm text-muted-foreground">Vigiado por Ledger</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="cyber-card"><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-400" /></div>
            <div><p className="text-xs text-muted-foreground">Receita</p><p className="text-lg font-bold text-emerald-400">R$ {totalR.toLocaleString("pt-BR")}</p></div>
          </CardContent></Card>
          <Card className="cyber-card"><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-400" /></div>
            <div><p className="text-xs text-muted-foreground">Custos</p><p className="text-lg font-bold text-red-400">R$ {totalC.toLocaleString("pt-BR")}</p></div>
          </CardContent></Card>
          <Card className="cyber-card"><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Margem</p><p className={`text-lg font-bold ${totalR - totalC >= 0 ? "text-emerald-400" : "text-red-400"}`}>R$ {(totalR - totalC).toLocaleString("pt-BR")}</p></div>
          </CardContent></Card>
        </div>
        <Card className="cyber-card cyber-glow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Receita vs Custo (Mensal)</CardTitle></CardHeader>
          <CardContent><div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                <XAxis dataKey="month" tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(222 40% 8%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" name="Receita" fill="hsl(152 55% 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="custo" name="Custo" fill="hsl(0 72% 52%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div></CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
