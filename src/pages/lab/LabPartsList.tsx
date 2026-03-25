import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FlaskConical, Clock, Wrench, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  Entrada: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Em Reparo": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Em Teste": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Pronta: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const ETAPAS_LAB = ["recebimento", "analise", "reparo", "teste", "liberado"];
const ETAPA_LABELS: Record<string, string> = {
  recebimento: "Recebimento",
  analise: "Análise",
  reparo: "Reparo",
  teste: "Teste",
  liberado: "Liberado",
};

const TIPOS_PECA = ["bobina", "placa", "fonte", "periferico", "outro"];

export default function LabPartsList() {
  const { user } = useAuth();
  const [parts, setParts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    if (!user) return;
    supabase.from("lab_parts").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setParts(data || []);
      setLoading(false);
    });
  }, [user]);

  const updateEtapa = async (partId: string, etapa: string) => {
    const statusMap: Record<string, string> = {
      recebimento: "Entrada",
      analise: "Em Reparo",
      reparo: "Em Reparo",
      teste: "Em Teste",
      liberado: "Pronta",
    };
    await supabase.from("lab_parts").update({
      etapa_atual: etapa,
      status: statusMap[etapa] || "Entrada",
    } as any).eq("id", partId);
    setParts(prev => prev.map(p => p.id === partId ? { ...p, etapa_atual: etapa, status: statusMap[etapa] } : p));
    toast.success(`Etapa atualizada para ${ETAPA_LABELS[etapa]}`);
  };

  const filtered = parts.filter(p => {
    const matchSearch = p.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      p.equipamento_origem?.toLowerCase().includes(search.toLowerCase()) ||
      p.serial_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // KPIs
  const total = parts.length;
  const emReparo = parts.filter(p => p.status === "Em Reparo").length;
  const prontas = parts.filter(p => p.status === "Pronta").length;
  const avgTime = parts.filter(p => p.tempo_total_min > 0).reduce((sum, p) => sum + (p.tempo_total_min || 0), 0) / (parts.filter(p => p.tempo_total_min > 0).length || 1);

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-primary" /> Laboratório de Peças
            </h1>
            <p className="text-sm text-muted-foreground">OS de bancada: análise, reparo, teste e liberação</p>
          </div>
          <Link to="/lab/new">
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Registrar Peça</Button>
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-hexa-amber/10 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-hexa-amber" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Reparo</p>
                <p className="text-lg font-bold">{emReparo}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-hexa-green/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-hexa-green" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prontas</p>
                <p className="text-lg font-bold">{prontas}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tempo Médio</p>
                <p className="text-lg font-bold">{Math.round(avgTime)} min</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar peça, equipamento, serial..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {["todos", "Entrada", "Em Reparo", "Em Teste", "Pronta"].map(s => (
              <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="text-xs">
                {s === "todos" ? "Todos" : s}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
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
                    <TableHead>Tipo</TableHead>
                    <TableHead>Equipamento Origem</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => {
                    const etapaIdx = ETAPAS_LAB.indexOf(p.etapa_atual || "recebimento");
                    const nextEtapa = ETAPAS_LAB[etapaIdx + 1];
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.descricao}</p>
                            {p.serial_number && <p className="text-xs text-muted-foreground font-mono">{p.serial_number}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{p.tipo_peca || "outro"}</TableCell>
                        <TableCell className="text-sm">{p.equipamento_origem}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {ETAPAS_LAB.map((e, i) => (
                              <div key={e} className={`w-2 h-2 rounded-full ${i <= etapaIdx ? "bg-primary" : "bg-muted"}`} title={ETAPA_LABELS[e]} />
                            ))}
                            <span className="ml-1 text-xs">{ETAPA_LABELS[p.etapa_atual || "recebimento"]}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || "bg-muted"}`}>
                            {p.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.data_entrada ? format(new Date(p.data_entrada), "dd/MM/yy") : "—"}
                        </TableCell>
                        <TableCell>
                          {nextEtapa && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateEtapa(p.id, nextEtapa)}>
                              → {ETAPA_LABELS[nextEtapa]}
                            </Button>
                          )}
                        </TableCell>
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
