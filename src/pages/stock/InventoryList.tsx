import { useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Boxes, Search, AlertTriangle } from "lucide-react";

export default function InventoryList() {
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory").select("*").order("name");
      return data || [];
    },
  });

  const filtered = items.filter((i: any) =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <HexaLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Inventário</h1>
          <p className="text-sm text-muted-foreground">Vigiado por Tracker</p>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar peça ou SKU..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs bg-muted/30 border-border/40" />
        </div>

        <Card className="cyber-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30">
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Qtd</TableHead>
                <TableHead className="text-xs">Mín</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item: any) => {
                const isLow = item.current_quantity <= item.min_quantity;
                return (
                  <TableRow key={item.id} className="border-border/20">
                    <TableCell className="text-sm font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{item.sku || "—"}</TableCell>
                    <TableCell className={`text-sm font-medium ${isLow ? "text-red-400" : "text-foreground"}`}>{item.current_quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.min_quantity}</TableCell>
                    <TableCell>
                      {isLow ? (
                        <Badge className="bg-red-500/20 text-red-300 border-0 text-[10px] gap-1">
                          <AlertTriangle className="w-3 h-3" /> Baixo
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">Nenhum item</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </HexaLayout>
  );
}
