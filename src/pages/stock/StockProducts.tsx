import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, LayoutGrid, List, AlertTriangle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "Disponível": "bg-green-100 text-green-800",
  "Em Manutenção": "bg-yellow-100 text-yellow-800",
  "Teste/QA": "bg-purple-100 text-purple-800",
  "Aguardando Peça": "bg-orange-100 text-orange-800",
  "Envio ao Cliente": "bg-blue-100 text-blue-800",
  "Indisponível": "bg-red-100 text-red-800",
};

type ViewMode = "table" | "cards";
type FilterMode = "all" | "criticos" | "sem_estoque" | "estoque_baixo" | "manutencao";

export default function StockProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [catFilter, setCatFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("stock_products").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setProducts(data || []);
      setLoading(false);
    });
  }, [user]);

  const categories = [...new Set(products.map(p => p.categoria))].sort();

  const filtered = products.filter(p => {
    const matchSearch = !search || [p.nome, p.serial_number, p.part_number, p.hexa_id].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const matchCat = catFilter === "all" || p.categoria === catFilter;
    let matchFilter = true;
    if (filter === "criticos") matchFilter = p.quantidade === 0;
    if (filter === "sem_estoque") matchFilter = p.quantidade === 0;
    if (filter === "estoque_baixo") matchFilter = p.quantidade > 0 && p.quantidade <= (p.quantidade_minima || 0);
    if (filter === "manutencao") matchFilter = p.status === "Em Manutenção";
    return matchSearch && matchCat && matchFilter;
  });

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" /> Catálogo de Produtos
            </h1>
            <p className="text-sm text-muted-foreground">{products.length} produtos cadastrados</p>
          </div>
          <Link to="/stock/products/new">
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Novo Produto</Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, S/N, P/N, HEXA ID..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={v => setFilter(v as FilterMode)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="criticos">Críticos</SelectItem>
              <SelectItem value="sem_estoque">Sem Estoque</SelectItem>
              <SelectItem value="estoque_baixo">Estoque Baixo</SelectItem>
              <SelectItem value="manutencao">Em Manutenção</SelectItem>
            </SelectContent>
          </Select>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setViewMode("table")}><List className="w-4 h-4" /></Button>
            <Button variant={viewMode === "cards" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setViewMode("cards")}><LayoutGrid className="w-4 h-4" /></Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Carregando...</p>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="text-center py-12">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum produto encontrado</p>
          </CardContent></Card>
        ) : viewMode === "table" ? (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>S/N</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Localização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => window.location.href = `/stock/products/${p.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.foto_url ? <img src={p.foto_url} className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></div>}
                        <div>
                          <p className="font-medium text-sm">{p.nome}</p>
                          {p.hexa_id && <p className="text-xs text-muted-foreground">{p.hexa_id}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.categoria}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.serial_number || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className={`font-semibold text-sm ${p.quantidade === 0 ? "text-red-600" : p.quantidade <= (p.quantidade_minima || 0) ? "text-amber-600" : ""}`}>
                          {p.quantidade}
                        </span>
                        {p.quantidade === 0 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                      </div>
                    </TableCell>
                    <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "bg-muted"}`}>{p.status}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.localizacao || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => (
              <Link key={p.id} to={`/stock/products/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {p.foto_url ? <img src={p.foto_url} className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 rounded bg-muted flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.categoria}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-lg font-bold ${p.quantidade === 0 ? "text-red-600" : ""}`}>{p.quantidade} un</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "bg-muted"}`}>{p.status}</span>
                    </div>
                    {p.hexa_id && <p className="text-xs text-muted-foreground">HEXA: {p.hexa_id}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </HexaLayout>
  );
}
