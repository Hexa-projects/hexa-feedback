import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCw, Settings2 } from "lucide-react";
import HexaLayout from "@/components/HexaLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { startOfMonth, startOfQuarter, startOfWeek, format } from "date-fns";

type Proposal = Record<string, any>;
type Lead = Record<string, any>;

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return toast.info("Não há dados para exportar neste período.");
  const headers = Object.keys(rows[0]);
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(quote).join(";"), ...rows.map(row => headers.map(h => quote(row[h])).join(";"))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function rangeFor(preset: string) {
  const now = new Date();
  if (preset === "week") return startOfWeek(now, { weekStartsOn: 1 });
  if (preset === "quarter") return startOfQuarter(now);
  return startOfMonth(now);
}

export default function CommercialDashboard() {
  const { role } = useAuth();
  const [preset, setPreset] = useState("month");
  const [start, setStart] = useState(format(rangeFor("month"), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staleHours, setStaleHours] = useState(72);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const [proposalRes, leadRes, settingRes] = await Promise.all([
      db.from("proposals").select("*, leads(nome, empresa, email, telefone)").gte("created_at", `${start}T00:00:00`).lte("created_at", `${end}T23:59:59`).is("deleted_at", null),
      db.from("leads").select("*").order("created_at", { ascending: false }),
      db.from("commercial_settings").select("value").eq("key", "stale_lead_hours").maybeSingle(),
    ]);
    if (proposalRes.error) toast.error("Não foi possível carregar as propostas", { description: proposalRes.error.message });
    setProposals(proposalRes.data || []);
    setLeads(leadRes.data || []);
    const configured = Number(settingRes.data?.value);
    if (Number.isFinite(configured) && configured > 0) setStaleHours(configured);
    setLoading(false);
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (value: string) => {
    setPreset(value);
    if (value !== "custom") {
      setStart(format(rangeFor(value), "yyyy-MM-dd"));
      setEnd(format(new Date(), "yyyy-MM-dd"));
    }
  };

  const staleLeads = useMemo(() => leads.filter(lead => {
    const status = String(lead.status || "").toLowerCase();
    if (status.includes("ganho") || status.includes("perdido") || lead.paused_at || lead.deleted_at) return false;
    const reference = new Date(lead.ultimo_contato || lead.created_at).getTime();
    return Date.now() - reference >= staleHours * 3_600_000;
  }), [leads, staleHours]);

  const won = proposals.filter(p => ["aceita", "aprovada"].includes(String(p.status).toLowerCase()));
  const lost = proposals.filter(p => ["recusada", "reprovada", "cancelada"].includes(String(p.status).toLowerCase()));
  const sent = proposals.filter(p => p.sent_at || String(p.status).toLowerCase() === "enviada");
  const totalPipeline = leads.filter(l => !l.deleted_at && !l.paused_at && !String(l.status).toLowerCase().includes("perdido")).reduce((sum, l) => sum + Number(l.valor_estimado || 0), 0);
  const warrantiesExpiring = leads.filter(l => l.warranty_end && new Date(l.warranty_end) >= new Date() && new Date(l.warranty_end).getTime() - Date.now() <= 30 * 86_400_000);

  const byRequester = useMemo(() => {
    const map = new Map<string, { total: number; won: number; lost: number; value: number }>();
    proposals.forEach(p => {
      const key = p.requester_name || "Não informado";
      const current = map.get(key) || { total: 0, won: 0, lost: 0, value: 0 };
      current.total += 1;
      current.value += Number(p.valor || 0);
      if (["aceita", "aprovada"].includes(String(p.status).toLowerCase())) current.won += 1;
      if (["recusada", "reprovada", "cancelada"].includes(String(p.status).toLowerCase())) current.lost += 1;
      map.set(key, current);
    });
    return [...map.entries()].map(([name, values]) => ({ name, ...values })).sort((a, b) => b.total - a.total);
  }, [proposals]);

  const countBy = (key: string) => Object.entries(proposals.reduce<Record<string, number>>((acc, p) => {
    const label = p[key] || "Não informado";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  const byLine = countBy("business_line");
  const byState = countBy("customer_state").slice(0, 10);

  const saveStaleHours = async () => {
    const { error } = await (supabase as any).from("commercial_settings").upsert({
      key: "stale_lead_hours", value: staleHours, description: "Prazo sem contato usado nos indicadores comerciais",
    }, { onConflict: "key" });
    if (error) toast.error(error.message); else toast.success("Prazo comercial atualizado.");
  };

  const exportRows = proposals.map(p => ({
    numero: p.proposal_number, data: format(new Date(p.created_at), "dd/MM/yyyy"), cliente: p.leads?.empresa,
    equipamento: p.equipment, linha: p.business_line, estado: p.customer_state, solicitante: p.requester_name,
    status: p.status, valor: Number(p.valor || 0), enviada_em: p.sent_at ? format(new Date(p.sent_at), "dd/MM/yyyy HH:mm") : "",
  }));

  return (
    <HexaLayout>
      <div className="space-y-4 pb-8">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-primary" /> Dashboard Comercial</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento de propostas, conversão, carteira e origem da demanda.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={preset} onValueChange={applyPreset}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="week">Esta semana</SelectItem><SelectItem value="month">Este mês</SelectItem><SelectItem value="quarter">Este trimestre</SelectItem><SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent></Select>
            <Input aria-label="Data inicial" type="date" value={start} onChange={e => { setPreset("custom"); setStart(e.target.value); }} className="w-40" />
            <Input aria-label="Data final" type="date" value={end} onChange={e => { setPreset("custom"); setEnd(e.target.value); }} className="w-40" />
            <Button variant="outline" size="icon" title="Atualizar dados" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
            <Button variant="outline" onClick={() => downloadCsv(exportRows, `comercial-${start}-${end}.csv`)}><Download className="w-4 h-4 mr-2" /> Excel</Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {[
            ["Propostas enviadas", sent.length], ["Aprovadas", won.length], ["Perdidas", lost.length],
            ["Conversão", sent.length ? `${Math.round((won.length / sent.length) * 100)}%` : "0%"],
            ["Total do funil", money(totalPipeline)], [`Sem contato +${staleHours}h`, staleLeads.length], ["Garantias a vencer", warrantiesExpiring.length],
          ].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold mt-1">{value}</p></CardContent></Card>)}
        </section>

        {role === "admin" && <Card><CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1"><Label htmlFor="stale-hours">Prazo para lead sem contato</Label><Input id="stale-hours" type="number" min={1} value={staleHours} onChange={e => setStaleHours(Number(e.target.value))} className="w-40" /></div>
          <Button variant="outline" onClick={saveStaleHours}><Settings2 className="w-4 h-4 mr-2" /> Salvar prazo em horas</Button>
          <p className="text-xs text-muted-foreground sm:pb-2">O indicador considera o último contato e ignora negócios pausados, ganhos ou perdidos.</p>
        </CardContent></Card>}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Resultado por solicitante ou parceiro</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Solicitante</TableHead><TableHead>Total</TableHead><TableHead>Ganhas</TableHead><TableHead>Perdidas</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader><TableBody>
            {byRequester.map(row => <TableRow key={row.name}><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.total}</TableCell><TableCell>{row.won}</TableCell><TableCell>{row.lost}</TableCell><TableCell>{money(row.value)}</TableCell></TableRow>)}
          </TableBody></Table></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Propostas por linha de negócio</CardTitle></CardHeader><CardContent className="space-y-3">
            {byLine.map(([label, count]) => <div key={label}><div className="flex justify-between text-sm"><span className="capitalize">{label}</span><strong>{count}</strong></div><div className="h-2 bg-muted mt-1"><div className="h-full bg-primary" style={{ width: `${proposals.length ? (count / proposals.length) * 100 : 0}%` }} /></div></div>)}
          </CardContent></Card>
          <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Estados com mais solicitações</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {byState.map(([state, count]) => <div key={state} className="border p-3"><p className="text-xs text-muted-foreground">{state}</p><p className="text-lg font-semibold">{count}</p></div>)}
          </CardContent></Card>
        </div>
      </div>
    </HexaLayout>
  );
}
