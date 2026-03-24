import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, Plus, AlertTriangle, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

const ETAPAS = [
  "Entrada Almoxarifado", "Estoque", "Laboratório",
  "Manutenção", "Teste/QA", "Retorno Almoxarifado", "Envio ao Cliente"
];

const ETAPA_COLORS: Record<string, string> = {
  "Entrada Almoxarifado": "border-t-blue-500",
  "Estoque": "border-t-cyan-500",
  "Laboratório": "border-t-purple-500",
  "Manutenção": "border-t-amber-500",
  "Teste/QA": "border-t-indigo-500",
  "Retorno Almoxarifado": "border-t-teal-500",
  "Envio ao Cliente": "border-t-green-500",
};

export default function StockJourney() {
  const { user } = useAuth();
  const [journeys, setJourneys] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", etapa: ETAPAS[0], notas: "" });

  const loadData = async () => {
    const [jRes, pRes] = await Promise.all([
      supabase.from("stock_journeys").select("*, stock_products(nome, hexa_id)").is("concluido_em", null).order("iniciado_em", { ascending: false }),
      supabase.from("stock_products").select("id, nome, hexa_id").order("nome")
    ]);
    setJourneys(jRes.data || []);
    setProducts(pRes.data || []);
    setLoading(false);
  };

  useEffect(() => { if (user) loadData(); }, [user]);

  const handleCreate = async () => {
    if (!form.product_id) { toast.error("Selecione um produto"); return; }
    if (!user) return;
    const { error } = await supabase.from("stock_journeys").insert({
      product_id: form.product_id, etapa: form.etapa, notas: form.notas, responsavel_id: user.id
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Jornada iniciada!");
    setDialogOpen(false);
    setForm({ product_id: "", etapa: ETAPAS[0], notas: "" });
    loadData();
  };

  const advanceEtapa = async (journey: any) => {
    const idx = ETAPAS.indexOf(journey.etapa);
    if (idx >= ETAPAS.length - 1) {
      await supabase.from("stock_journeys").update({ concluido_em: new Date().toISOString() }).eq("id", journey.id);
      toast.success("Jornada concluída!");
    } else {
      const next = ETAPAS[idx + 1];
      await supabase.from("stock_journeys").update({ etapa_anterior: journey.etapa, etapa: next }).eq("id", journey.id);
      toast.success(`Avançou para: ${next}`);
    }
    loadData();
  };

  // Group by etapa
  const grouped = ETAPAS.reduce((acc, etapa) => {
    acc[etapa] = journeys.filter(j => j.etapa === etapa);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" /> Jornada da Peça
            </h1>
            <p className="text-sm text-muted-foreground">Kanban de rastreamento por etapa</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Nova Jornada</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Iniciar Jornada</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Produto</Label>
                  <Select value={form.product_id} onValueChange={v => setForm(p => ({ ...p, product_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Etapa Inicial</Label>
                  <Select value={form.etapa} onValueChange={v => setForm(p => ({ ...p, etapa: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ETAPAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Notas</Label>
                  <Textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} />
                </div>
                <Button onClick={handleCreate} className="w-full">Iniciar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? <p className="text-sm text-muted-foreground p-6">Carregando...</p> : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {ETAPAS.map(etapa => (
              <div key={etapa} className="min-w-[220px] flex-shrink-0">
                <Card className={`border-t-4 ${ETAPA_COLORS[etapa] || "border-t-muted"}`}>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center justify-between">
                      <span>{etapa}</span>
                      <Badge variant="secondary" className="text-[10px]">{grouped[etapa]?.length || 0}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2 min-h-[100px]">
                    {(grouped[etapa] || []).map(j => {
                      const days = differenceInDays(new Date(), new Date(j.iniciado_em));
                      const stale = days > 7;
                      return (
                        <div key={j.id} className={`p-2 rounded border text-xs space-y-1 ${stale ? "border-red-300 bg-red-50/50" : "bg-card"}`}>
                          <p className="font-medium truncate">{j.stock_products?.nome || "—"}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {days}d
                            </span>
                            {stale && <AlertTriangle className="w-3 h-3 text-red-500" />}
                          </div>
                          <Button size="sm" variant="outline" className="w-full h-6 text-[10px]" onClick={() => advanceEtapa(j)}>
                            {ETAPAS.indexOf(etapa) >= ETAPAS.length - 1 ? "Concluir" : "Avançar →"}
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </HexaLayout>
  );
}
