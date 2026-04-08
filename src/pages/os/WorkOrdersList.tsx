import { useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";

type FilterType = "all" | "open" | "in_progress" | "done";

export default function WorkOrdersList() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const { data: orders = [] } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("work_orders").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = orders.filter((o: any) => {
    if (filter === "open" && o.status !== "aberta") return false;
    if (filter === "in_progress" && o.status !== "em_andamento") return false;
    if (filter === "done" && o.status !== "concluida") return false;
    if (search && !o.cliente?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { aberta: "bg-blue-500/20 text-blue-300", em_andamento: "bg-yellow-500/20 text-yellow-300", concluida: "bg-emerald-500/20 text-emerald-300" };
    return m[s] || "bg-muted text-muted-foreground";
  };

  const slaColor = (o: any) => {
    if (!o.prazo_sla) return "text-muted-foreground";
    if (Date.now() > new Date(o.prazo_sla).getTime() && o.status !== "concluida") return "text-red-400";
    return "text-emerald-400";
  };

  return (
    <HexaLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><h1 className="text-2xl font-bold">Ordens de Serviço</h1><p className="text-sm text-muted-foreground">Vigiado por Gear</p></div>
          <Link to="/os/new"><Button size="sm" className="text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Nova OS</Button></Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs bg-muted/30 border-border/40" />
          </div>
          {(["all", "open", "in_progress", "done"] as FilterType[]).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="text-[10px] h-7" onClick={() => setFilter(f)}>
              {{ all: "Todas", open: "Abertas", in_progress: "Em Andamento", done: "Concluídas" }[f]}
            </Button>
          ))}
        </div>
        <Card className="cyber-card">
          <Table>
            <TableHeader><TableRow className="border-border/30">
              <TableHead className="text-xs">Cliente</TableHead><TableHead className="text-xs">Equipamento</TableHead>
              <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">SLA</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((o: any) => (
                <TableRow key={o.id} className="border-border/20 hover:bg-muted/20 cursor-pointer" onClick={() => window.location.href = `/os/${o.id}`}>
                  <TableCell className="text-sm font-medium">{o.cliente}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.equipamento}</TableCell>
                  <TableCell><Badge className={`text-[10px] border-0 ${statusBadge(o.status)}`}>{o.status}</Badge></TableCell>
                  <TableCell className={`text-xs ${slaColor(o)}`}>{o.prazo_sla ? new Date(o.prazo_sla).toLocaleDateString("pt-BR") : "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">Nenhuma OS</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </HexaLayout>
  );
}
