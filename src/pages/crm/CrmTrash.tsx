import { useEffect, useMemo, useState } from "react";
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
import { Trash2, RotateCcw, Loader2, Building2, Users } from "lucide-react";
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

function isCeoOrAdmin(role: string, funcao?: string | null): boolean {
  if (role === "admin") return true;
  const f = (funcao || "").toLowerCase();
  return /ceo|chief executive|s[óo]cio|diretor executivo|fundador/.test(f);
}

export default function CrmTrash() {
  const { role, profile } = useAuth();
  const allowed = isCeoOrAdmin(role, profile?.funcao);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orgsById, setOrgsById] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ kind: "org" | "contact"; id: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: orgData }, { data: contactData }] = await Promise.all([
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
    ]);
    setOrgs((orgData as Org[]) || []);
    setContacts((contactData as Contact[]) || []);

    // Fetch org names to display "Empresa vinculada" for contacts
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
    const { error } = await (supabase as any)
      .from("rd_organizations").update({ deleted_at: null }).eq("id", o.id);
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
    const { error } = await (supabase as any)
      .from("rd_contacts").update({ deleted_at: null }).eq("id", c.id);
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

  const orgSegmento = (o: Org): string => {
    const p = o.raw_payload || {};
    return (
      p.segment || p.segmento || p.sector || p.setor || p.industry || p.industria ||
      p?.custom_fields?.segmento || p?.custom_fields?.segment || "—"
    );
  };

  return (
    <HexaLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Lixeira</h1>
            <p className="text-sm text-muted-foreground">
              Empresas e contatos excluídos. Restaure ou apague definitivamente.
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
        </Tabs>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão permanente</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "org"
                ? "Esta ação é irreversível. Deseja excluir permanentemente esta empresa?"
                : "Esta ação é irreversível. Deseja excluir permanentemente este contato?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                const { kind, id } = confirm;
                setConfirm(null);
                if (kind === "org") purgeOrg(id); else purgeContact(id);
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
