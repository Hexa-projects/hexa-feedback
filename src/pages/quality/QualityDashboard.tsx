import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Clock, FilePlus2, ShieldCheck, Target, TimerReset } from "lucide-react";
import type { QualityAction, QualityCase, QualityRnc } from "./qualityTypes";
import { formatDate, isActionOverdue, isCaseOverdue, priorityBadgeClass, STATUS_LABELS, statusBadgeClass } from "./qualityUtils";

export default function QualityDashboard() {
  const [cases, setCases] = useState<QualityCase[]>([]);
  const [rncs, setRncs] = useState<QualityRnc[]>([]);
  const [actions, setActions] = useState<QualityAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      (supabase as any).from("quality_cases").select("*").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("quality_rncs").select("*").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("quality_actions").select("*").order("due_date", { ascending: true }).limit(50),
    ]).then(([caseRes, rncRes, actionRes]) => {
      setCases(caseRes.data || []);
      setRncs(rncRes.data || []);
      setActions(actionRes.data || []);
      setLoading(false);
    });
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    return {
      abertas: cases.filter(c => ["aberta", "em_analise"].includes(c.status)).length,
      rncsAbertas: rncs.filter(r => r.status !== "encerrada" && r.status !== "cancelada").length,
      emAcao: cases.filter(c => c.status === "em_acao").length,
      atrasadas: cases.filter(c => isCaseOverdue(c)).length + actions.filter(a => isActionOverdue(a)).length,
      eficacia: cases.filter(c => c.status === "aguardando_eficacia").length,
      encerradasMes: cases.filter(c => c.closed_at && new Date(c.closed_at).getMonth() === now.getMonth() && new Date(c.closed_at).getFullYear() === now.getFullYear()).length,
      ineficazes: cases.filter(c => c.status === "ineficaz").length,
    };
  }, [cases, rncs, actions]);

  const pendingActions = actions.filter(a => a.status !== "concluida" && a.status !== "cancelada").slice(0, 6);

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" /> Qualidade
            </h1>
            <p className="text-sm text-muted-foreground">RACP, eficacia e rastreabilidade de acoes corretivas e preventivas</p>
          </div>
          <div className="flex gap-2">
            <Link to="/quality/effectiveness"><Button variant="outline" size="sm" className="gap-1"><Target className="w-4 h-4" /> Eficacia</Button></Link>
            <Link to="/quality/cases/new"><Button size="sm" className="gap-1"><FilePlus2 className="w-4 h-4" /> Nova RACP</Button></Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {([
            ["Abertas", metrics.abertas, ShieldCheck, "text-primary", "bg-primary/10"],
            ["RNC abertas", metrics.rncsAbertas, AlertTriangle, "text-red-600", "bg-red-500/10"],
            ["Em acao", metrics.emAcao, Clock, "text-hexa-amber", "bg-hexa-amber/10"],
            ["Atrasadas", metrics.atrasadas, AlertTriangle, "text-destructive", "bg-destructive/10"],
            ["Eficacia", metrics.eficacia, Target, "text-blue-600", "bg-blue-500/10"],
            ["Encerradas mes", metrics.encerradasMes, CheckCircle2, "text-hexa-green", "bg-hexa-green/10"],
            ["Ineficazes", metrics.ineficazes, TimerReset, "text-red-600", "bg-red-500/10"],
          ] as Array<[string, number, React.ComponentType<{ className?: string }>, string, string]>).map(([label, value, Icon, color, bg]) => (
            <Card key={label}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <p className="text-lg font-bold">{value as number}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Ultimas RACPs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <p className="p-6 text-sm text-muted-foreground">Carregando...</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Titulo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Prazo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.slice(0, 8).map(item => (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => window.location.href = `/quality/cases/${item.id}`}>
                        <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                        <TableCell className="font-medium">{item.titulo}</TableCell>
                        <TableCell><Badge className={statusBadgeClass(item.status, isCaseOverdue(item))}>{isCaseOverdue(item) ? "Atrasada" : STATUS_LABELS[item.status]}</Badge></TableCell>
                        <TableCell><Badge className={priorityBadgeClass(item.prioridade)}>{item.prioridade}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(item.data_limite)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Acoes pendentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingActions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhuma acao pendente.</p>
              ) : pendingActions.map(action => (
                <div key={action.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{action.tipo}</Badge>
                    {isActionOverdue(action) && <Badge className="bg-red-100 text-red-800">Atrasada</Badge>}
                  </div>
                  <p className="text-sm font-medium line-clamp-2">{action.descricao}</p>
                  <p className="text-xs text-muted-foreground">Prazo: {formatDate(action.due_date)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </HexaLayout>
  );
}
