import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, AlertTriangle, Wrench, Clock, FlaskConical, TrendingUp,
  ArrowDownToLine, ArrowUpFromLine, BarChart3, Brain, Plus, Box,
  CheckCircle, Truck
} from "lucide-react";
import { toast } from "sonner";

interface Stats {
  total: number;
  criticos: number;
  estoqueBaixo: number;
  emManutencao: number;
  aguardandoPeca: number;
  testeQA: number;
  envioCliente: number;
  categorias: number;
  osLab: number;
  entradasHoje: number;
  saidasHoje: number;
  ajustesHoje: number;
}

export default function StockDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    total: 0, criticos: 0, estoqueBaixo: 0, emManutencao: 0,
    aguardandoPeca: 0, testeQA: 0, envioCliente: 0, categorias: 0,
    osLab: 0, entradasHoje: 0, saidasHoje: 0, ajustesHoje: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user]);

  const loadStats = async () => {
    const [productsRes, movementsRes, labRes] = await Promise.all([
      supabase.from("stock_products").select("*"),
      supabase.from("stock_movements").select("*").gte("created_at", new Date().toISOString().split("T")[0]),
      supabase.from("lab_parts").select("id").in("status", ["Entrada", "Em Reparo", "Em Teste"])
    ]);

    const products = productsRes.data || [];
    const movements = movementsRes.data || [];
    const cats = new Set(products.map(p => p.categoria));

    setStats({
      total: products.length,
      criticos: products.filter(p => p.quantidade === 0).length,
      estoqueBaixo: products.filter(p => p.quantidade > 0 && p.quantidade <= (p.quantidade_minima || 0)).length,
      emManutencao: products.filter(p => p.status === "Em Manutenção").length,
      aguardandoPeca: products.filter(p => p.status === "Aguardando Peça").length,
      testeQA: products.filter(p => p.status === "Teste/QA").length,
      envioCliente: products.filter(p => p.status === "Envio ao Cliente").length,
      categorias: cats.size,
      osLab: labRes.data?.length || 0,
      entradasHoje: movements.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.quantidade, 0),
      saidasHoje: movements.filter(m => m.tipo === "saida").reduce((s, m) => s + m.quantidade, 0),
      ajustesHoje: movements.filter(m => m.tipo === "ajuste").length,
    });
    setLoading(false);
  };

  const handleAIAnalysis = () => {
    toast.info("Análise IA de estoque iniciada. Insights serão gerados em breve.");
  };

  const widgets = [
    { label: "Itens Críticos", value: stats.criticos, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Estoque Baixo", value: stats.estoqueBaixo, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Em Manutenção", value: stats.emManutencao, icon: Wrench, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Aguardando Peça", value: stats.aguardandoPeca, icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Teste/QA", value: stats.testeQA, icon: CheckCircle, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Envio ao Cliente", value: stats.envioCliente, icon: Truck, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  return (
    <HexaLayout>
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" /> Estoque Inteligente
            </h1>
            <p className="text-sm text-muted-foreground">Controle completo de peças técnicas</p>
          </div>
          <div className="flex gap-2">
            <Link to="/stock/products/new">
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Produto</Button>
            </Link>
            <Link to="/stock/movements/new">
              <Button size="sm" variant="outline" className="gap-1"><ArrowDownToLine className="w-4 h-4" /> Movimentação</Button>
            </Link>
          </div>
        </div>

        {/* Main stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {widgets.map(w => (
            <Card key={w.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`w-10 h-10 rounded-lg ${w.bg} flex items-center justify-center`}>
                  <w.icon className={`w-5 h-5 ${w.color}`} />
                </div>
                <span className="text-2xl font-bold">{loading ? "—" : w.value}</span>
                <span className="text-xs text-muted-foreground">{w.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Box className="w-4 h-4 text-primary" /> Resumo Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total de Produtos</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Categorias</span>
                <span className="font-semibold">{stats.categorias}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">OS Laboratório</span>
                <Badge variant="secondary">{stats.osLab}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Resumo do Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><ArrowDownToLine className="w-3 h-3" /> Entradas</span>
                <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">{stats.entradasHoje}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><ArrowUpFromLine className="w-3 h-3" /> Saídas</span>
                <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">{stats.saidasHoje}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ajustes</span>
                <Badge variant="outline">{stats.ajustesHoje}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" /> IA de Estoque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Análise inteligente de consumo, reposição e detecção de padrões de falha.
              </p>
              <Button size="sm" className="w-full gap-1" onClick={handleAIAnalysis}>
                <Brain className="w-4 h-4" /> Iniciar Análise com IA
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: "/stock/products", label: "Catálogo", icon: Package, desc: "Todos os produtos" },
            { to: "/stock/movements", label: "Movimentações", icon: ArrowDownToLine, desc: "Entradas e saídas" },
            { to: "/stock/journey", label: "Jornada da Peça", icon: TrendingUp, desc: "Kanban de etapas" },
            { to: "/stock/equipment", label: "Equipamentos", icon: Wrench, desc: "Instalados em clientes" },
          ].map(q => (
            <Link key={q.to} to={q.to}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <q.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{q.label}</p>
                    <p className="text-xs text-muted-foreground">{q.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </HexaLayout>
  );
}
