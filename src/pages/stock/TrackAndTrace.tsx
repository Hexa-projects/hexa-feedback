import { useState } from "react";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Scan, Search, Package, Wrench, ArrowRight } from "lucide-react";

export default function TrackAndTrace() {
  const [serial, setSerial] = useState("");
  const [searchSerial, setSearchSerial] = useState("");

  // Search stock movements and lab parts for this serial
  const { data: movements = [] } = useQuery({
    queryKey: ["trace", searchSerial],
    queryFn: async () => {
      if (!searchSerial) return [];
      const { data } = await supabase.from("stock_movements" as any).select("*")
        .or(`serial_number.eq.${searchSerial},notas.ilike.%${searchSerial}%`)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!searchSerial,
  });

  const { data: labParts = [] } = useQuery({
    queryKey: ["trace-lab", searchSerial],
    queryFn: async () => {
      if (!searchSerial) return [];
      const { data } = await supabase.from("lab_parts").select("*")
        .eq("serial_number", searchSerial);
      return data || [];
    },
    enabled: !!searchSerial,
  });

  const handleSearch = () => setSearchSerial(serial.trim());

  // Build timeline from combined data
  const timeline = [
    ...movements.map((m: any) => ({
      date: m.created_at,
      label: m.tipo_movimento || m.movement_type || "Movimentação",
      detail: m.notas || m.notes || "",
      type: "movement" as const,
    })),
    ...labParts.map((p: any) => ({
      date: p.created_at,
      label: `Laboratório: ${p.etapa_atual}`,
      detail: p.descricao,
      type: "lab" as const,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <HexaLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Jornada da Peça</h1>
          <p className="text-sm text-muted-foreground">Rastreio por Serial Number</p>
        </div>

        <div className="flex gap-2">
          <Input placeholder="Digite o Serial Number..." value={serial} onChange={e => setSerial(e.target.value)}
            className="bg-muted/30 border-border/40" onKeyDown={e => e.key === "Enter" && handleSearch()} />
          <Button onClick={handleSearch}><Search className="w-4 h-4 mr-1" /> Buscar</Button>
        </div>

        {searchSerial && (
          <Card className="cyber-card cyber-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scan className="w-4 h-4 text-emerald-400" />
                Timeline — {searchSerial}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum registro encontrado para este serial.</p>
              ) : (
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-border/40" />
                  {timeline.map((event, i) => (
                    <div key={i} className="relative">
                      <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 ${
                        event.type === "lab" ? "border-purple-400 bg-purple-400/20" : "border-emerald-400 bg-emerald-400/20"
                      }`} />
                      <div className="cyber-card p-3">
                        <div className="flex items-center justify-between mb-1">
                          <Badge className={`text-[10px] border-0 ${
                            event.type === "lab" ? "bg-purple-500/20 text-purple-300" : "bg-emerald-500/20 text-emerald-300"
                          }`}>{event.label}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(event.date).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </HexaLayout>
  );
}
