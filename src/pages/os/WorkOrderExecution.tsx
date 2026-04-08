import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wrench, Play, Camera, CheckCircle, Package, Upload } from "lucide-react";

export default function WorkOrderExecution() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [parts, setParts] = useState<{ name: string; qty: number }[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [notes, setNotes] = useState("");

  const { data: order } = useQuery({
    queryKey: ["work-order", id],
    queryFn: async () => {
      const { data } = await supabase.from("work_orders").select("*").eq("id", id).single();
      return data;
    },
    enabled: !!id,
  });

  const checklist = [
    "Inspeção visual do equipamento",
    "Verificar alimentação elétrica",
    "Testar funcionalidade básica",
    "Verificar nível de fluidos / refrigeração",
    "Registrar leitura de sensores",
    "Executar procedimento de reparo",
    "Teste pós-manutenção",
    "Limpeza do local",
  ];

  const allChecked = checklist.every((_, i) => checkedItems[i]);
  const hasParts = parts.length > 0;
  const canFinish = allChecked;

  const startWork = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("work_orders").update({ status: "em_andamento" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["work-order", id] }); toast.success("Trabalho iniciado"); },
  });

  const finishWork = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("work_orders").update({
        status: "concluida",
        notas: notes,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OS finalizada!"); navigate("/os"); },
  });

  const addPart = () => {
    if (!partSearch.trim()) return;
    setParts(p => [...p, { name: partSearch.trim(), qty: 1 }]);
    setPartSearch("");
  };

  if (!order) return <HexaLayout><div className="text-center text-muted-foreground py-12">Carregando...</div></HexaLayout>;

  return (
    <HexaLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <Card className="cyber-card cyber-glow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge className="bg-blue-500/20 text-blue-300 border-0 text-xs">{order.status}</Badge>
              <Wrench className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-lg font-bold">{order.cliente}</h2>
            <p className="text-sm text-muted-foreground">{order.equipamento}</p>
            {order.defeito_relatado && <p className="text-xs text-red-400 mt-1">Defeito: {order.defeito_relatado}</p>}
          </CardContent>
        </Card>

        {/* Check-in */}
        {order.status === "aberta" && (
          <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700" onClick={() => startWork.mutate()}>
            <Play className="w-4 h-4 mr-2" /> Iniciar Trabalho
          </Button>
        )}

        {/* Checklist */}
        <Card className="cyber-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklist Obrigatório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.map((item, i) => (
              <label key={i} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/20 cursor-pointer">
                <Checkbox checked={!!checkedItems[i]} onCheckedChange={(v) => setCheckedItems(p => ({ ...p, [i]: !!v }))} />
                <span className="text-sm">{item}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        {/* Consumo de Peças */}
        <Card className="cyber-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" /> Consumo de Peças
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Buscar peça ou bipar código..." value={partSearch} onChange={e => setPartSearch(e.target.value)}
                className="bg-muted/30 border-border/40 text-sm" onKeyDown={e => e.key === "Enter" && addPart()} />
              <Button size="sm" variant="outline" onClick={addPart} className="text-xs shrink-0">Adicionar</Button>
            </div>
            {parts.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 bg-muted/20 rounded text-sm">
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground">x{p.qty}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notas */}
        <Card className="cyber-card">
          <CardContent className="p-4">
            <Textarea placeholder="Observações finais..." value={notes} onChange={e => setNotes(e.target.value)}
              className="bg-muted/30 border-border/40 min-h-[80px] text-sm" />
          </CardContent>
        </Card>

        {/* Finalizar */}
        <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" disabled={!canFinish}
          onClick={() => finishWork.mutate()}>
          <CheckCircle className="w-4 h-4 mr-2" /> Finalizar OS
        </Button>
      </div>
    </HexaLayout>
  );
}
