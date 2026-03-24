import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FlaskConical } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  "Entrada": "bg-blue-100 text-blue-800",
  "Em Reparo": "bg-yellow-100 text-yellow-800",
  "Em Teste": "bg-purple-100 text-purple-800",
  "Pronta": "bg-green-100 text-green-800",
};

export default function LabPartsList() {
  const { user } = useAuth();
  const [parts, setParts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("lab_parts").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setParts(data || []);
      setLoading(false);
    });
  }, [user]);

  const filtered = parts.filter(p =>
    p.descricao?.toLowerCase().includes(search.toLowerCase()) ||
    p.equipamento_origem?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-primary" /> Laboratório de Peças
            </h1>
            <p className="text-sm text-muted-foreground">Peças em reparo e estoque</p>
          </div>
          <Link to="/lab/new">
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Registrar Peça</Button>
          </Link>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar peça..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma peça encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Equipamento Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Previsão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.descricao}</TableCell>
                      <TableCell>{p.equipamento_origem}</TableCell>
                      <TableCell>
                        <span className={`status-badge ${STATUS_COLORS[p.status] || "bg-muted"}`}>{p.status}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.data_entrada ? format(new Date(p.data_entrada), "dd/MM/yy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.previsao_conclusao ? format(new Date(p.previsao_conclusao), "dd/MM/yy") : "—"}
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
