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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Wrench, Clock } from "lucide-react";
import { format, differenceInHours } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  "Aberto": "bg-blue-100 text-blue-800",
  "Em Atendimento": "bg-yellow-100 text-yellow-800",
  "Pendente Peça": "bg-orange-100 text-orange-800",
  "Concluído": "bg-green-100 text-green-800",
};

export default function WorkOrdersList() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("work_orders").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setOrders(data || []);
      setLoading(false);
    });
  }, [user]);

  const filtered = orders.filter(o =>
    o.numero_os?.toLowerCase().includes(search.toLowerCase()) ||
    o.cliente?.toLowerCase().includes(search.toLowerCase()) ||
    o.equipamento?.toLowerCase().includes(search.toLowerCase())
  );

  const getSlaColor = (os: any) => {
    if (os.status === "Concluído") return "text-hexa-green";
    const hours = differenceInHours(new Date(), new Date(os.created_at));
    const remaining = (os.sla_horas || 48) - hours;
    if (remaining <= 0) return "text-destructive";
    if (remaining <= 8) return "text-hexa-orange";
    return "text-hexa-green";
  };

  const getSlaText = (os: any) => {
    if (os.status === "Concluído") return "✓";
    const hours = differenceInHours(new Date(), new Date(os.created_at));
    const remaining = (os.sla_horas || 48) - hours;
    if (remaining <= 0) return `${Math.abs(remaining)}h atrasado`;
    return `${remaining}h restantes`;
  };

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6 text-primary" /> Manutenção & OS
            </h1>
            <p className="text-sm text-muted-foreground">Ordens de serviço e atendimentos</p>
          </div>
          <Link to="/os/new">
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Abrir OS</Button>
          </Link>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar OS..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground p-6">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Wrench className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma OS encontrada</p>
                <Link to="/os/new"><Button className="mt-3" size="sm">Abrir primeira OS</Button></Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº OS</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(os => (
                    <TableRow key={os.id}>
                      <TableCell className="font-mono text-sm">{os.numero_os || "—"}</TableCell>
                      <TableCell className="font-medium">{os.cliente}</TableCell>
                      <TableCell>{os.equipamento}</TableCell>
                      <TableCell>
                        <span className={`status-badge ${STATUS_COLORS[os.status] || "bg-muted"}`}>{os.status}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium flex items-center gap-1 ${getSlaColor(os)}`}>
                          <Clock className="w-3 h-3" /> {getSlaText(os)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(os.created_at), "dd/MM/yy")}
                      </TableCell>
                      <TableCell>
                        <Link to={`/os/${os.id}`}><Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button></Link>
                      </TableCell>
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
