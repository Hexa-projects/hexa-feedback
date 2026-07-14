import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText, Mail, Plus, Search, Trash2 } from "lucide-react";
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
import { differenceInDays, format } from "date-fns";

const blank = { titulo: "", descricao: "", valor: "", lead_id: "", status: "Rascunho", validade_dias: "30", equipment: "", business_line: "equipamento_novo", requester_name: "", customer_state: "" };
const statusVariant = (status: string) => ["Aceita", "Aprovada"].includes(status) ? "default" : ["Recusada", "Cancelada"].includes(status) ? "destructive" : "secondary";

export default function ProposalsList() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [emailProposal, setEmailProposal] = useState<any | null>(null);
  const [recipient, setRecipient] = useState("");
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [proposalRes, leadRes] = await Promise.all([
      (supabase as any).from("proposals").select("*, leads(nome, empresa, email, telefone)").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("leads").select("id, nome, empresa, email").order("nome"),
    ]);
    if (proposalRes.error) toast.error(proposalRes.error.message);
    setProposals(proposalRes.data || []); setLeads(leadRes.data || []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const filtered = useMemo(() => proposals.filter(p => [p.proposal_number, p.titulo, p.leads?.empresa, p.equipment, p.requester_name].some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))), [proposals, search]);

  const save = async () => {
    if (!user || !form.titulo.trim()) return toast.error("Informe o título da proposta.");
    setBusy(true);
    const { error } = await (supabase as any).from("proposals").insert({ ...form, valor: Number(form.valor || 0), validade_dias: Number(form.validade_dias || 30), lead_id: form.lead_id || null, user_id: user.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    setForm(blank); setFormOpen(false); load(); toast.success("Proposta criada com numeração automática.");
  };

  const updateStatus = async (proposal: any, status: string) => {
    const { error } = await (supabase as any).from("proposals").update({ status }).eq("id", proposal.id);
    if (error) toast.error(error.message); else { load(); toast.success("Situação atualizada."); }
  };

  const moveToTrash = async (proposal: any) => {
    if (!user || !confirm(`Mover a proposta ${proposal.proposal_number || proposal.titulo} para a lixeira?`)) return;
    const now = new Date().toISOString();
    const [{ error }] = await Promise.all([
      (supabase as any).from("proposals").update({ deleted_at: now, deleted_by: user.id }).eq("id", proposal.id),
      (supabase as any).from("commercial_audit_log").insert({ entity_type: "proposal", entity_id: proposal.id, action: "moved_to_trash", actor_id: user.id, metadata: { proposal_number: proposal.proposal_number } }),
    ]);
    if (error) toast.error(error.message); else { load(); toast.success("Proposta movida para a lixeira."); }
  };

  const openEmail = (proposal: any) => { setEmailProposal(proposal); setRecipient(proposal.leads?.email || proposal.last_email_to || ""); };
  const sendEmail = async () => {
    if (!emailProposal || !recipient.includes("@")) return toast.error("Informe um e-mail válido.");
    setBusy(true);
    const { error } = await supabase.functions.invoke("send-proposal-email", { body: { proposal_id: emailProposal.id, recipient } });
    setBusy(false);
    if (error) return toast.error("Falha ao enviar pelo Outlook", { description: error.message });
    setEmailProposal(null); load(); toast.success("Proposta enviada e registrada no histórico.");
  };

  const printProposal = (proposal: any) => {
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return toast.error("Permita pop-ups para gerar o PDF.");
    const expiry = proposal.expires_at ? format(new Date(proposal.expires_at), "dd/MM/yyyy") : `${proposal.validade_dias || 30} dias`;
    win.document.write(`<!doctype html><html><head><title>${proposal.proposal_number || "Proposta"}</title><style>@page{size:A4;margin:18mm}body{font:14px Arial;color:#222}header{border-bottom:3px solid #f58220;padding-bottom:16px;margin-bottom:28px}h1{font-size:24px}h2{color:#f58220}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px;background:#f5f5f5}.value{font-size:24px;font-weight:bold;margin:24px 0}.footer{margin-top:60px;border-top:1px solid #ddd;padding-top:12px;color:#666}</style></head><body><header><strong style="font-size:22px">HEXAMEDICAL</strong><br><span>Soluções em equipamentos médicos</span></header><h1>Proposta Comercial</h1><div class="meta"><span><b>Número:</b> ${proposal.proposal_number || "—"}</span><span><b>Data:</b> ${format(new Date(proposal.created_at), "dd/MM/yyyy")}</span><span><b>Cliente:</b> ${proposal.leads?.empresa || proposal.leads?.nome || "—"}</span><span><b>Validade:</b> ${expiry}</span><span><b>Equipamento/serviço:</b> ${proposal.equipment || "—"}</span><span><b>Linha:</b> ${proposal.business_line || "—"}</span></div><h2>${proposal.titulo}</h2><p>${String(proposal.descricao || "").replace(/\n/g, "<br>")}</p><div class="value">${Number(proposal.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div><p>Esta proposta está sujeita às condições comerciais e técnicas registradas no HexaOS.</p><div class="footer">Hexamedical · Documento gerado pelo HexaOS</div><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  return <HexaLayout><div className="space-y-4 pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Propostas</h1><p className="text-sm text-muted-foreground">Documentos padronizados, validade, envio e histórico.</p></div><Button onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-2" /> Nova proposta</Button></header>
    <section className="grid gap-3 sm:grid-cols-4">{[["Total", proposals.length], ["Enviadas", proposals.filter(p => p.sent_at).length], ["Aprovadas", proposals.filter(p => ["Aceita", "Aprovada"].includes(p.status)).length], ["Vencidas", proposals.filter(p => p.expires_at && new Date(p.expires_at) < new Date() && !["Aceita", "Aprovada"].includes(p.status)).length]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></CardContent></Card>)}</section>
    <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar número, empresa, equipamento ou solicitante" /></div>
    <Card><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Cliente / título</TableHead><TableHead>Equipamento</TableHead><TableHead>Valor</TableHead><TableHead>Validade</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{filtered.map(p => {
      const days = p.expires_at ? differenceInDays(new Date(p.expires_at), new Date()) : null;
      return <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.proposal_number || "Gerando..."}</TableCell><TableCell><p className="font-medium">{p.leads?.empresa || p.leads?.nome || "Sem cliente"}</p><p className="text-xs text-muted-foreground">{p.titulo}</p></TableCell><TableCell>{p.equipment || "—"}</TableCell><TableCell>{Number(p.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell><TableCell><span className={days !== null && days <= 7 ? "text-destructive font-medium" : ""}>{p.expires_at ? format(new Date(p.expires_at), "dd/MM/yyyy") : `${p.validade_dias} dias`}</span>{days !== null && days >= 0 && days <= 7 && <p className="text-xs text-destructive">Vence em {days} dia(s)</p>}</TableCell><TableCell><Select value={p.status} onValueChange={value => updateStatus(p, value)}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{["Rascunho", "Enviada", "Em análise", "Aceita", "Recusada", "Cancelada"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Visualizar" onClick={() => setPreview(p)}><Eye className="w-4 h-4" /></Button><Button variant="ghost" size="icon" title="Gerar PDF" onClick={() => printProposal(p)}><Download className="w-4 h-4" /></Button><Button variant="ghost" size="icon" title="Enviar pelo Outlook" onClick={() => openEmail(p)}><Mail className="w-4 h-4" /></Button><Button variant="ghost" size="icon" title="Mover para lixeira" onClick={() => moveToTrash(p)}><Trash2 className="w-4 h-4" /></Button></div></TableCell></TableRow>;
    })}</TableBody></Table></CardContent></Card>

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Nova proposta institucional</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Field label="Cliente"><Select value={form.lead_id} onValueChange={lead_id => setForm({ ...form, lead_id })}><SelectTrigger><SelectValue placeholder="Selecionar lead" /></SelectTrigger><SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.empresa || l.nome}</SelectItem>)}</SelectContent></Select></Field><Field label="Título *"><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></Field><Field label="Equipamento ou serviço"><Input value={form.equipment} onChange={e => setForm({ ...form, equipment: e.target.value })} /></Field><Field label="Linha de negócio"><Select value={form.business_line} onValueChange={business_line => setForm({ ...form, business_line })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[["equipamento_novo","Equipamento novo"],["equipamento_usado","Equipamento usado"],["servico","Serviço"],["reparo","Reparo"],["peca","Peça"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field><Field label="Solicitante ou parceiro"><Input value={form.requester_name} onChange={e => setForm({ ...form, requester_name: e.target.value })} /></Field><Field label="UF do cliente"><Input maxLength={2} value={form.customer_state} onChange={e => setForm({ ...form, customer_state: e.target.value.toUpperCase() })} /></Field><Field label="Valor"><Input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></Field><Field label="Validade (dias)"><Input type="number" min={1} value={form.validade_dias} onChange={e => setForm({ ...form, validade_dias: e.target.value })} /></Field><div className="sm:col-span-2"><Field label="Descrição e condições"><Textarea rows={6} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button onClick={save} disabled={busy}>Criar proposta</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!preview} onOpenChange={open => !open && setPreview(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{preview?.proposal_number} · {preview?.titulo}</DialogTitle></DialogHeader>{preview && <div className="space-y-3"><div className="grid grid-cols-2 gap-3 bg-muted p-3 text-sm"><span><b>Cliente:</b> {preview.leads?.empresa || preview.leads?.nome || "—"}</span><span><b>Validade:</b> {preview.expires_at ? format(new Date(preview.expires_at), "dd/MM/yyyy") : "—"}</span><span><b>Equipamento:</b> {preview.equipment || "—"}</span><span><b>Solicitante:</b> {preview.requester_name || "—"}</span></div><p className="whitespace-pre-wrap text-sm">{preview.descricao}</p><p className="text-xl font-bold">{Number(preview.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p><Badge variant={statusVariant(preview.status) as any}>{preview.status}</Badge></div>}<DialogFooter><Button onClick={() => preview && printProposal(preview)}><Download className="w-4 h-4 mr-2" /> Gerar PDF</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!emailProposal} onOpenChange={open => !open && setEmailProposal(null)}><DialogContent><DialogHeader><DialogTitle>Enviar proposta pelo Outlook</DialogTitle></DialogHeader><Field label="Destinatário"><Input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} /></Field><p className="text-xs text-muted-foreground">O envio será feito pela conta corporativa configurada no Microsoft Graph e ficará registrado no histórico.</p><DialogFooter><Button variant="outline" onClick={() => setEmailProposal(null)}>Cancelar</Button><Button onClick={sendEmail} disabled={busy}><Mail className="w-4 h-4 mr-2" /> Enviar</Button></DialogFooter></DialogContent></Dialog>
  </div></HexaLayout>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
