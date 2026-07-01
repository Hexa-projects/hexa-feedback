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
import { AlertCircle, FilePlus2, Search } from "lucide-react";
import type { QualityRnc, QualityRncStatus } from "./qualityTypes";
import { formatDate, priorityBadgeClass, RNC_ORIGENS, RNC_STATUS_LABELS, RNC_STATUS_OPTIONS, rncStatusBadgeClass } from "./qualityUtils";

export default function QualityRncList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<QualityRnc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [origem, setOrigem] = useState("all");

  useEffect(() => {
    (supabase as any).from("quality_rncs").select("*").order("created_at", { ascending: false }).then(({ data }: any) => {
      setItems(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => items.filter(item => {
    const text = [item.codigo, item.cliente_fornecedor, item.descricao_item, item.codigo_item, item.lote_serial, item.descricao_nao_conformidade].filter(Boolean).join(" ").toLowerCase();
    return (!search || text.includes(search.toLowerCase()))
      && (status === "all" || item.status === status)
      && (origem === "all" || item.origem === origem);
  }), [items, search, status, origem]);

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><AlertCircle className="w-6 h-6 text-primary" /> RNC</h1>
            <p className="text-sm text-muted-foreground">Relatorios de nao conformidade, disposicao e reinspecao</p>
          </div>
          <Link to="/quality/rnc/new"><Button size="sm" className="gap-1"><FilePlus2 className="w-4 h-4" /> Nova RNC</Button></Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar RNC, item, cliente/fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos status</SelectItem>{RNC_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{RNC_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={origem} onValueChange={setOrigem}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas origens</SelectItem>{RNC_ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? <p className="p-6 text-sm text-muted-foreground">Carregando...</p> : filtered.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma RNC encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Cliente/Fornecedor</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Disposicao</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Emissao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => navigate(`/quality/rnc/${item.id}`)}>
                      <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                      <TableCell className="text-sm">{item.cliente_fornecedor || "-"}</TableCell>
                      <TableCell><p className="text-sm font-medium">{item.descricao_item || "-"}</p><p className="text-xs text-muted-foreground">{item.codigo_item || item.lote_serial}</p></TableCell>
                      <TableCell className="text-sm">{item.origem}</TableCell>
                      <TableCell className="text-sm">{item.disposicao || "-"}</TableCell>
                      <TableCell><Badge className={rncStatusBadgeClass(item.status)}>{RNC_STATUS_LABELS[item.status as QualityRncStatus]}</Badge></TableCell>
                      <TableCell><Badge className={priorityBadgeClass(item.prioridade)}>{item.prioridade}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(item.data_emissao)}</TableCell>
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
