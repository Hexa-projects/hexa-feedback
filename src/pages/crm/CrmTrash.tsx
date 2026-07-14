import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, Loader2, Building2, Users, FileText, Handshake } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Org = {
  id: string;
  name: string | null;
  cnpj: string | null;
  raw_payload: any;
  deleted_at: string | null;
};

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  organization_rd_id: string | null;
  deleted_at: string | null;
};

const TRASH_MARKER_RE = /^\[TRASH_PREV:([^|\]]+)\|([^\]]+)\]\n?/;
const TRASH_LEAD_MARKER_RE = /^\[TRASH_LEAD_PREV:([^|\]]*)\|([^\]]+)\]\n?/;

function parseTrashInfo(obs: string | null | undefined) {
  const raw = String(obs || "");
  const m = raw.match(TRASH_MARKER_RE);
  if (!m) return { prevStatus: "pendente", deletedAt: null as string | null, cleanObs: raw };
  return { prevStatus: m[1] || "pendente", deletedAt: m[2] || null, cleanObs: raw.replace(TRASH_MARKER_RE, "") };
}

function parseLeadTrashInfo(notas: string | null | undefined) {
  const raw = String(notas || "");
  const m = raw.match(TRASH_LEAD_MARKER_RE);
  if (!m) return { prevStatus: "Novo Negócio", deletedAt: null as string | null, cleanNotas: raw };
  return { prevStatus: m[1] || "Novo Negócio", deletedAt: m[2] || null, cleanNotas: raw.replace(TRASH_LEAD_MARKER_RE, "") };
}

function isCeoOrAdmin(role: string, funcao?: string | null): boolean {
  if (role === "admin") return true;
  const f = (funcao || "").toLowerCase();
  return /ceo|chief executive|s[óo]cio|diretor executivo|fundador/.test(f);
}

type ConfirmState =
  | { kind: "org"; id: string }
  | { kind: "contact"; id: string }
  | { kind: "request"; id: string }
  | { kind: "lead"; id: string }
  | null;

export default function CrmTrash() {
  const { role, profile } = useAuth();
  const allowed = isCeoOrAdmin(role, profile?.funcao) || role === "gestor";

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orgsById, setOrgsById] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: orgData }, { data: contactData }, reqRes, leadRes, profileRes] = await Promise.all([
      (supabase as any)
        .from("rd_organizations")
        .select("id, rd_id, name, cnpj, raw_payload, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      (supabase as any)
        .from("rd_contacts")
        .select("id, name, email, phone, organization_rd_id, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      (supabase as any)
        .from("commercial_requests")
        .select("*")
        .eq("status", "lixeira")
        .order("updated_at", { ascending: false }),
      (supabase as any)
        .from("leads")
        .select("*")
        .eq("status", "lixeira")
        .order("updated_at", { ascending: false }),
      supabase.from("profiles").select("id, nome"),
    ]);
    setOrgs((orgData as Org[]) || []);
    setContacts((contactData as Contact[]) || []);
    setRequests(reqRes.data || []);
    setLeads(leadRes.data || []);
    const profileMap: Record<string, string> = {};
    (profileRes.data || []).forEach((p: any) => { profileMap[p.id] = p.nome || p.id; });
    setProfilesById(profileMap);

    const orgIds = Array.from(new Set(((contactData as any[]) || []).map(c => c.organization_rd_id).filter(Boolean)));
    if (orgIds.length) {
      const { data: linkedOrgs } = await (supabase as any)
        .from("rd_organizations")
        .select("rd_id, name")
        .in("rd_id", orgIds);
      const map: Record<string, string> = {};
      (linkedOrgs || []).forEach((o: any) => { if (o.rd_id) map[o.rd_id] = o.name || ""; });
      setOrgsById(map);
    } else {
      setOrgsById({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <Navigate to="/home" replace />;

  const restoreOrg = async (o: Org) => {
    setBusyId(o.id);
    const { error } = await (supabase as any).from("rd_organizations").update({ deleted_at: null }).eq("id", o.id);
    setBusyId(null);
    if (error) return toast.error("Erro ao restaurar: " + error.message);
    setOrgs(prev => prev.filter(x => x.id !== o.id));
    toast.success("Empresa restaurada");
  };
  const purgeOrg = async (id: string) => {
    setBusyId(id);
    const { error } = await (supabase as any).from("rd_organizations").delete().eq("id", id);
    setBusyId(null);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    setOrgs(prev => prev.filter(x => x.id !== id));
    toast.success("Empresa excluída permanentemente");
  };
  const restoreContact = async (c: Contact) => {
    setBusyId(c.id);
    const { error } = await (supabase as any).from("rd_contacts").update({ deleted_at: null }).eq("id", c.id);
    setBusyId(null);
    if (error) return toast.error("Erro ao restaurar: " + error.message);
    setContacts(prev => prev.filter(x => x.id !== c.id));
    toast.success("Contato restaurado");
  };
  const purgeContact = async (id: string) => {
    setBusyId(id);
    const { error } = await (supabase as any).from("rd_contacts").delete().eq("id", id);
    setBusyId(null);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    setContacts(prev => prev.filter(x => x.id !== id));
    toast.success("Contato excluído permanentemente");
  };

  const restoreRequest = async (r: any) => {
    setBusyId(r.id);
    const info = parseTrashInfo(r.observacoes);
    const { error } = await (supabase as any)
      .from("commercial_requests")
      .update({ status: info.prevStatus, observacoes: info.cleanObs || null })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error("Erro ao restaurar: " + error.message);
    setRequests(prev => prev.filter(x => x.id !== r.id));
    toast.success(`Solicitação restaurada como "${info.prevStatus}"`);
  };
  const purgeRequest = async (id: string) => {
    setBusyId(id);
    const { error } = await (supabase as any).from("commercial_requests").delete().eq("id", id);
    setBusyId(null);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    setRequests(prev => prev.filter(x => x.id !== id));
    toast.success("Solicitação excluída permanentemente");
  };

  const restoreLead = async (l: any) => {
    setBusyId(l.id);
    const info = parseLeadTrashInfo(l.notas);
    const { error } = await (supabase as any)
      .from("leads")
      .update({ status: info.prevStatus, notas: info.cleanNotas || null })
      .eq("id", l.id);
    setBusyId(null);
    if (error) return toast.error("Erro ao restaurar: " + error.message);
    setLeads(prev => prev.filter(x => x.id !== l.id));
    toast.success(`Negociação restaurada em "${info.prevStatus}"`);
  };
  const purgeLead = async (id: string) => {
    setBusyId(id);
    const { error } = await (supabase as any).from("leads").delete().eq("id", id);
    setBusyId(null);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    setLeads(prev => prev.filter(x => x.id !== id));
    toast.success("Negociação excluída permanentemente");
  };

  const orgSegmento = (o: Org): string => {
    const p = o.raw_payload || {};
    return (
      p.segment || p.segmento || p.sector || p.setor || p.industry || p.industria ||
      p?.custom_fields?.segmento || p?.custom_fields?.segment || "—"
    );
  };

  const confirmDescription = () => {
    switch (confirm?.kind) {
      case "org": return "Esta ação é irreversível. Deseja excluir permanentemente esta empresa?";
      case "contact": return "Esta ação é irreversível. Deseja excluir permanentemente este contato?";
      case "request": return "Esta ação é irreversível. Deseja excluir permanentemente esta solicitação?";
      case "lead": return "Esta ação é irreversível. Deseja excluir permanentemente esta negociação?";
      default: return "";
    }
  };

  return (
    <HexaLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Lixeira</h1>
            <p className="text-sm text-muted-foreground">
              Itens excluídos. Restaure ou apague definitivamente.
            </p>
          </div>
        </div>

        <Tabs defaultValue="empresas">
          <TabsList>
            <TabsTrigger value="empresas" className="gap-2">
              <Building2 className="w-4 h-4" /> Empresas ({orgs.length})
            </TabsTrigger>
            <TabsTrigger value="contatos" className="gap-2">
              <Users className="w-4 h-4" /> Contatos ({contacts.length})
            </TabsTrigger>
            <TabsTrigger value="solicitacoes" className="gap-2">
              <FileText className="w-4 h-4" /> Solicitações ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="negociacoes" className="gap-2">
              <Handshake className="w-4 h-4" /> Negociações ({leads.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empresas">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {orgs.length} {orgs.length === 1 ? "empresa" : "empresas"} na lixeira
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </div>
                ) : orgs.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">Nenhuma empresa na lixeira.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome da empresa</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Data de exclusão</TableHead>
                        <TableHead>Excluído por</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgs.map(o => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.name || "—"}</TableCell>
                          <TableCell className="text-xs">{o.cnpj || "—"}</TableCell>
                          <TableCell className="text-xs">{orgSegmento(o)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {o.deleted_at ? format(new Date(o.deleted_at), "dd/MM/yyyy HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => restoreOrg(o)} disabled={busyId === o.id}>
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setConfirm({ kind: "org", id: o.id })} disabled={busyId === o.id}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir permanentemente
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contatos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {contacts.length} {contacts.length === 1 ? "contato" : "contatos"} na lixeira
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">Nenhum contato na lixeira.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Empresa vinculada</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Data de exclusão</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {c.organization_rd_id ? (orgsById[c.organization_rd_id] || "—") : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{c.email || "—"}</TableCell>
                          <TableCell className="text-xs">{c.phone || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.deleted_at ? format(new Date(c.deleted_at), "dd/MM/yyyy HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" onClick={() => restoreContact(c)} disabled={busyId === c.id}>
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setConfirm({ kind: "contact", id: c.id })} disabled={busyId === c.id}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir permanentemente
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="solicitacoes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {requests.length} {requests.length === 1 ? "solicitação" : "solicitações"} na lixeira
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </div>
                ) : requests.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">Nenhuma solicitação na lixeira.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Empresa / Cliente</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Data de exclusão</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map(r => {
                        const info = parseTrashInfo(r.observacoes);
                        const deletedAt = info.deletedAt || r.updated_at || r.created_at;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.tipo || "—"}</TableCell>
                            <TableCell>{r.empresa || r.contato || "—"}</TableCell>
                            <TableCell className="text-xs">{r.equipamento || "—"}</TableCell>
                            <TableCell>
                              {r.preco != null
                                ? Number(r.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {deletedAt ? format(new Date(deletedAt), "dd/MM/yyyy HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{profilesById[r.deleted_by] || "Registro anterior à auditoria"}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="outline" size="sm" onClick={() => restoreRequest(r)} disabled={busyId === r.id}>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setConfirm({ kind: "request", id: r.id })} disabled={busyId === r.id}>
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir permanentemente
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="negociacoes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {leads.length} {leads.length === 1 ? "negociação" : "negociações"} na lixeira
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </div>
                ) : leads.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">Nenhuma negociação na lixeira.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome / Empresa</TableHead>
                        <TableHead>Funil</TableHead>
                        <TableHead>Coluna / Etapa</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data de exclusão</TableHead>
                        <TableHead>Excluído por</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map(l => {
                        const info = parseLeadTrashInfo(l.notas);
                        const deletedAt = info.deletedAt || l.updated_at || l.created_at;
                        const funilMatch = String(l.notas || "").match(/\[FUNIL:([^\]]+)\]/);
                        const funil = funilMatch ? funilMatch[1] : "vendas";
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium">
                              {l.nome || l.empresa || "—"}
                              {l.empresa && l.nome && l.empresa !== l.nome && (
                                <div className="text-xs text-muted-foreground">{l.empresa}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs capitalize">{funil}</TableCell>
                            <TableCell className="text-xs">{info.prevStatus || "—"}</TableCell>
                            <TableCell>
                              {l.valor_estimado != null
                                ? Number(l.valor_estimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {deletedAt ? format(new Date(deletedAt), "dd/MM/yyyy HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{profilesById[l.deleted_by] || "Registro anterior à auditoria"}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="outline" size="sm" onClick={() => restoreLead(l)} disabled={busyId === l.id}>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => setConfirm({ kind: "lead", id: l.id })} disabled={busyId === l.id}>
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir permanentemente
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão permanente</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                const { kind, id } = confirm;
                setConfirm(null);
                if (kind === "org") purgeOrg(id);
                else if (kind === "contact") purgeContact(id);
                else if (kind === "request") purgeRequest(id);
                else if (kind === "lead") purgeLead(id);
              }}
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HexaLayout>
  );
}
