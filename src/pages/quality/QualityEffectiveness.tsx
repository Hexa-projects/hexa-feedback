import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import type { QualityCase } from "./qualityTypes";
import { formatDate, priorityBadgeClass, STATUS_LABELS, statusBadgeClass } from "./qualityUtils";

export default function QualityEffectiveness() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<QualityCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any)
      .from("quality_cases")
      .select("*")
      .in("status", ["aguardando_eficacia", "ineficaz"])
      .order("data_verificacao", { ascending: true })
      .then(({ data }: any) => {
        setCases(data || []);
        setLoading(false);
      });
  }, []);

  const groups = useMemo(() => {
    const today = new Date();
    return {
      atrasadas: cases.filter(c => c.data_verificacao && differenceInCalendarDays(new Date(c.data_verificacao), today) < 0),
      hoje: cases.filter(c => c.data_verificacao && differenceInCalendarDays(new Date(c.data_verificacao), today) === 0),
      proximas: cases.filter(c => !c.data_verificacao || differenceInCalendarDays(new Date(c.data_verificacao), today) > 0),
      ineficazes: cases.filter(c => c.status === "ineficaz"),
    };
  }, [cases]);

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-primary" /> Verificacao de eficacia</h1>
          <p className="text-sm text-muted-foreground">Fila de RACPs aguardando validacao ou nova acao</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric title="Atrasadas" value={groups.atrasadas.length} tone="destructive" />
          <Metric title="Hoje" value={groups.hoje.length} tone="amber" />
          <Metric title="Proximas" value={groups.proximas.length} tone="primary" />
          <Metric title="Ineficazes" value={groups.ineficazes.length} tone="destructive" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Casos para verificar</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? <p className="p-6 text-sm text-muted-foreground">Carregando...</p> : cases.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhuma RACP aguardando eficacia.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Titulo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Verificacao</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                      <TableCell className="font-medium">{item.titulo}</TableCell>
                      <TableCell><Badge className={statusBadgeClass(item.status)}>{STATUS_LABELS[item.status]}</Badge></TableCell>
                      <TableCell><Badge className={priorityBadgeClass(item.prioridade)}>{item.prioridade}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(item.data_verificacao)}</TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => navigate(`/quality/cases/${item.id}`)}>Registrar</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}

function Metric({ title, value, tone }: { title: string; value: number; tone: "primary" | "amber" | "destructive" }) {
  const color = tone === "destructive" ? "text-destructive" : tone === "amber" ? "text-hexa-amber" : "text-primary";
  return <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{title}</p><p className={`text-xl font-bold ${color}`}>{value}</p></CardContent></Card>;
}
