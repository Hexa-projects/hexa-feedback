import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Users } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  "Qualificação": "bg-blue-100 text-blue-800",
  "Contato Inicial": "bg-yellow-100 text-yellow-800",
  "Reunião": "bg-purple-100 text-purple-800",
  "Proposta Enviada": "bg-orange-100 text-orange-800",
  "Negociação": "bg-teal-100 text-teal-800",
  "Ganho": "bg-green-100 text-green-800",
  "Perdido": "bg-red-100 text-red-800",
};

export default function LeadsList() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeads(data || []);
        setLoading(false);
      });
  }, [user]);

  const filtered = leads.filter(l =>
    l.nome.toLowerCase().includes(search.toLowerCase()) ||
    l.empresa?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> CRM & Vendas
            </h1>
            <p className="text-sm text-muted-foreground">Gerencie seus leads e oportunidades</p>
          </div>
          <div className="flex gap-2">
            <Link to="/crm/kanban">
              <Button variant="outline" size="sm">Funil Kanban</Button>
            </Link>
            <Link to="/crm/new">
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Lead</Button>
            </Link>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar lead..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground p-6">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum lead encontrado</p>
                <Link to="/crm/new"><Button className="mt-3" size="sm">Criar primeiro lead</Button></Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor Est.</TableHead>
                    <TableHead>Último Contato</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.nome}</TableCell>
                      <TableCell>{lead.empresa}</TableCell>
                      <TableCell>
                        <span className={`status-badge ${STATUS_COLORS[lead.status] || "bg-muted"}`}>
                          {lead.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {lead.valor_estimado > 0
                          ? `R$ ${Number(lead.valor_estimado).toLocaleString("pt-BR")}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.ultimo_contato ? format(new Date(lead.ultimo_contato), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Link to={`/crm/${lead.id}`}>
                          <Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button>
                        </Link>
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
