import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Wrench, Clock } from "lucide-react";
import { format, differenceInHours } from "date-fns";
import AISmartBadge from "@/components/AISmartBadge";

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
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {os.numero_os || "—"}
                          {getSlaColor(os) === "text-destructive" && <AISmartBadge agent="Gear" />}
                        </div>
                      </TableCell>
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
