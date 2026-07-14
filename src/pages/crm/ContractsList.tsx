import { useEffect, useMemo, useState } from "react";
import { Briefcase, Plus, Search } from "lucide-react";
import HexaLayout from "@/components/HexaLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

const STAGES = [
  ["pendente_aprovacao_gestao", "Pendente de aprovação da gestão"],
  ["pendente_confeccao_juridico", "Pendente de confecção pelo jurídico"],
  ["pendente_cliente", "Pendente de aprovação, validação ou assinatura do cliente"],
  ["ganho", "Ganho"], ["perdido", "Perdido"],
] as const;
const blank = { titulo: "", descricao: "", valor_total: "", lead_id: "", proposal_id: "", data_inicio: "", data_fim: "", signer_name: "", signer_cpf: "", stage: "pendente_aprovacao_gestao" };

export default function ContractsList() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loss, setLoss] = useState<any | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [form, setForm] = useState(blank);

  const load = async () => {
    const [c, l, p] = await Promise.all([
      (supabase as any).from("contracts").select("*, leads(nome, empresa), proposals(proposal_number, titulo)").order("created_at", { ascending: false }),
      supabase.from("leads").select("id, nome, empresa").order("nome"),
      (supabase as any).from("proposals").select("id, proposal_number, titulo, lead_id, valor").in("status", ["Aceita", "Aprovada"]).order("created_at", { ascending: false }),
    ]);
    if (c.error) toast.error(c.error.message);
    setContracts(c.data || []); setLeads(l.data || []); setProposals(p.data || []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const filtered = useMemo(() => contracts.filter(c => [c.contract_number, c.titulo, c.leads?.empresa, c.proposals?.proposal_number].some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))), [contracts, search]);
  const stageLabel = (value: string) => STAGES.find(([id]) => id === value)?.[1] || value;

  const save = async () => {
    if (!user || !form.titulo.trim()) return toast.error("Informe o título do contrato.");
    const { error } = await (supabase as any).from("contracts").insert({ ...form, lead_id: form.lead_id || null, proposal_id: form.proposal_id || null, valor_total: Number(form.valor_total || 0), data_inicio: form.data_inicio || null, data_fim: form.data_fim || null, user_id: user.id, status: "pendente" });
    if (error) return toast.error(error.message);
    setOpen(false); setForm(blank); load(); toast.success("Contrato criado e encaminhado à gestão.");
  };

  const changeStage = async (contract: any, stage: string) => {
    if (stage === "perdido") { setLoss(contract); return; }
    const patch: any = { stage, status: stage === "ganho" ? "ativo" : "pendente" };
    if (stage === "ganho") patch.approved_at = new Date().toISOString();
    const { error } = await (supabase as any).from("contracts").update(patch).eq("id", contract.id);
    if (error) toast.error(error.message); else load();
  };

  const confirmLoss = async () => {
    if (!lossReason.trim()) return toast.error("O motivo da perda é obrigatório.");
    const { error } = await (supabase as any).from("contracts").update({ stage: "perdido", status: "cancelado", loss_reason: lossReason }).eq("id", loss.id);
    if (error) toast.error(error.message); else { setLoss(null); setLossReason(""); load(); toast.success("Perda registrada com motivo."); }
  };

  return <HexaLayout><div className="space-y-4 pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="w-6 h-6 text-primary" /> Contratos</h1><p className="text-sm text-muted-foreground">Fluxo de aprovação, jurídico, cliente e assinatura.</p></div><Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Novo contrato</Button></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{STAGES.map(([id, label]) => <Card key={id}><CardContent className="p-4"><p className="text-xs text-muted-foreground leading-snug min-h-8">{label}</p><p className="text-xl font-bold">{contracts.filter(c => c.stage === id).length}</p></CardContent></Card>)}</section>
    <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar contrato, proposta ou cliente" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <Card><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Contrato</TableHead><TableHead>Cliente</TableHead><TableHead>Proposta</TableHead><TableHead>Valor</TableHead><TableHead>Vigência</TableHead><TableHead>Etapa</TableHead></TableRow></TableHeader><TableBody>{filtered.map(c => <TableRow key={c.id}><TableCell><p className="font-mono text-xs">{c.contract_number || "Gerando..."}</p><p className="font-medium text-sm">{c.titulo}</p></TableCell><TableCell>{c.leads?.empresa || c.leads?.nome || "—"}</TableCell><TableCell className="font-mono text-xs">{c.proposals?.proposal_number || "—"}</TableCell><TableCell>{Number(c.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell><TableCell className="text-xs">{c.data_inicio ? format(new Date(c.data_inicio), "dd/MM/yyyy") : "—"}{c.data_fim ? ` a ${format(new Date(c.data_fim), "dd/MM/yyyy")}` : ""}</TableCell><TableCell><Select value={c.stage || "pendente_aprovacao_gestao"} onValueChange={stage => changeStage(c, stage)}><SelectTrigger className="min-w-64"><SelectValue /></SelectTrigger><SelectContent>{STAGES.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select>{c.loss_reason && <p className="text-xs text-destructive mt-1">Motivo: {c.loss_reason}</p>}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Field label="Título *"><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></Field><Field label="Cliente"><Select value={form.lead_id} onValueChange={lead_id => setForm({ ...form, lead_id })}><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger><SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.empresa || l.nome}</SelectItem>)}</SelectContent></Select></Field><Field label="Proposta aprovada"><Select value={form.proposal_id} onValueChange={proposal_id => { const p = proposals.find(x => x.id === proposal_id); setForm({ ...form, proposal_id, lead_id: p?.lead_id || form.lead_id, valor_total: String(p?.valor || form.valor_total) }); }}><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger><SelectContent>{proposals.map(p => <SelectItem key={p.id} value={p.id}>{p.proposal_number || p.titulo}</SelectItem>)}</SelectContent></Select></Field><Field label="Valor total"><Input type="number" value={form.valor_total} onChange={e => setForm({ ...form, valor_total: e.target.value })} /></Field><Field label="Início"><Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></Field><Field label="Fim"><Input type="date" value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })} /></Field><Field label="Nome completo do signatário"><Input value={form.signer_name} onChange={e => setForm({ ...form, signer_name: e.target.value })} /></Field><Field label="CPF do signatário"><Input value={form.signer_cpf} onChange={e => setForm({ ...form, signer_cpf: e.target.value })} /></Field><div className="sm:col-span-2"><Field label="Objeto e observações"><Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Criar contrato</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!loss} onOpenChange={v => !v && setLoss(null)}><DialogContent><DialogHeader><DialogTitle>Registrar contrato perdido</DialogTitle></DialogHeader><Field label="Motivo obrigatório"><Textarea value={lossReason} onChange={e => setLossReason(e.target.value)} rows={4} /></Field><DialogFooter><Button variant="outline" onClick={() => setLoss(null)}>Cancelar</Button><Button variant="destructive" onClick={confirmLoss}>Confirmar perda</Button></DialogFooter></DialogContent></Dialog>
  </div></HexaLayout>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
