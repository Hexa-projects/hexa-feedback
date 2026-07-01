import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus2, Search, ShieldCheck } from "lucide-react";
import type { QualityCase } from "./qualityTypes";
import { formatDate, isCaseOverdue, ORIGENS, priorityBadgeClass, STATUS_LABELS, STATUS_OPTIONS, statusBadgeClass } from "./qualityUtils";

export default function QualityCasesList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<QualityCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [tipo, setTipo] = useState("all");
  const [prioridade, setPrioridade] = useState("all");
  const [origem, setOrigem] = useState("all");

  useEffect(() => {
    (supabase as any).from("quality_cases").select("*").order("created_at", { ascending: false }).then(({ data }: any) => {
      setCases(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => cases.filter(item => {
    const haystack = [item.codigo, item.titulo, item.cliente, item.equipamento, item.serial_lote, item.referencia].filter(Boolean).join(" ").toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
      && (status === "all" || item.status === status)
      && (tipo === "all" || item.tipo === tipo)
      && (prioridade === "all" || item.prioridade === prioridade)
      && (origem === "all" || item.origem === origem);
  }), [cases, search, status, tipo, prioridade, origem]);

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" /> RACP
            </h1>
            <p className="text-sm text-muted-foreground">{filtered.length} registros encontrados</p>
          </div>
          <Link to="/quality/cases/new"><Button size="sm" className="gap-1"><FilePlus2 className="w-4 h-4" /> Nova RACP</Button></Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar codigo, cliente, equipamento, serial..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos status</SelectItem>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos tipos</SelectItem><SelectItem value="corretiva">Corretiva</SelectItem><SelectItem value="preventiva">Preventiva</SelectItem><SelectItem value="ambas">Ambas</SelectItem></SelectContent>
          </Select>
          <Select value={prioridade} onValueChange={setPrioridade}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Prioridade</SelectItem><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Critica</SelectItem></SelectContent>
          </Select>
          <Select value={origem} onValueChange={setOrigem}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas origens</SelectItem>{ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? <p className="p-6 text-sm text-muted-foreground">Carregando...</p> : filtered.length === 0 ? (
              <div className="text-center py-12">
                <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma RACP encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Titulo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => {
                    const overdue = isCaseOverdue(item);
                    return (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => navigate(`/quality/cases/${item.id}`)}>
                        <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{item.titulo}</p>
                          <p className="text-xs text-muted-foreground">{item.cliente || item.equipamento || item.referencia}</p>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{item.tipo}</TableCell>
                        <TableCell className="text-sm">{item.origem}</TableCell>
                        <TableCell><Badge className={priorityBadgeClass(item.prioridade)}>{item.prioridade}</Badge></TableCell>
                        <TableCell><Badge className={statusBadgeClass(item.status, overdue)}>{overdue ? "Atrasada" : STATUS_LABELS[item.status]}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(item.data_limite)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
