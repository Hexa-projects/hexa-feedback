import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const TRASH_MARKER_RE = /^\[TRASH_PREV:([^|\]]+)\|([^\]]+)\]\n?/;
const TRASH_LEAD_MARKER_RE = /^\[TRASH_LEAD_PREV:([^|\]]*)\|([^\]]+)\]\n?/;

function parseTrashInfo(obs: string | null | undefined): { prevStatus: string; deletedAt: string | null; cleanObs: string } {
  const raw = String(obs || "");
  const m = raw.match(TRASH_MARKER_RE);
  if (!m) return { prevStatus: "pendente", deletedAt: null, cleanObs: raw };
  return { prevStatus: m[1] || "pendente", deletedAt: m[2] || null, cleanObs: raw.replace(TRASH_MARKER_RE, "") };
}

function parseLeadTrashInfo(notas: string | null | undefined): { prevStatus: string; deletedAt: string | null; cleanNotas: string } {
  const raw = String(notas || "");
  const m = raw.match(TRASH_LEAD_MARKER_RE);
  if (!m) return { prevStatus: "Novo Negócio", deletedAt: null, cleanNotas: raw };
  return { prevStatus: m[1] || "Novo Negócio", deletedAt: m[2] || null, cleanNotas: raw.replace(TRASH_LEAD_MARKER_RE, "") };
}

export default function RequestsTrash() {
  const { role } = useAuth();
  const allowed = role === "admin" || role === "gestor";

  const [items, setItems] = useState<any[]>([]);
  const [leadItems, setLeadItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("commercial_requests")
      .select("*")
      .eq("status", "lixeira")
      .order("updated_at", { ascending: false });
    if (error) {
      // fallback if updated_at doesn't exist
      const r2 = await (supabase as any)
        .from("commercial_requests")
        .select("*")
        .eq("status", "lixeira")
        .order("created_at", { ascending: false });
      if (r2.error) toast.error("Erro ao carregar Lixeira");
      setItems(r2.data || []);
    } else {
      setItems(data || []);
    }

    // Load soft-deleted leads
    const { data: leads, error: leadsErr } = await (supabase as any)
      .from("leads")
      .select("*")
      .eq("status", "lixeira")
      .order("created_at", { ascending: false });
    if (leadsErr) {
      toast.error("Erro ao carregar leads da Lixeira");
      setLeadItems([]);
    } else {
      setLeadItems(leads || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed]);

  if (!allowed) return <Navigate to="/home" replace />;

  const restore = async (r: any) => {
    setBusyId(r.id);
    const info = parseTrashInfo(r.observacoes);
    const { error } = await (supabase as any)
      .from("commercial_requests")
      .update({ status: info.prevStatus, observacoes: info.cleanObs || null })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error("Erro ao restaurar: " + error.message);
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    toast.success(`Solicitação restaurada como "${info.prevStatus}"`);
  };

  const purge = async (r: any) => {
    if (!window.confirm("Esta ação é irreversível. Deseja excluir permanentemente?")) return;
    setBusyId(r.id);
    const { error } = await (supabase as any)
      .from("commercial_requests")
      .delete()
      .eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    setItems((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Solicitação excluída permanentemente");
  };

  return (
    <HexaLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Lixeira · Solicitações</h1>
            <p className="text-sm text-muted-foreground">
              Solicitações excluídas. Restaure ou apague definitivamente.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {items.length} {items.length === 1 ? "item" : "itens"} na lixeira
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Lixeira vazia.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Empresa / Cliente</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Excluída em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => {
                    const info = parseTrashInfo(r.observacoes);
                    const deletedAt = info.deletedAt || r.updated_at || r.created_at;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.tipo || "—"}</TableCell>
                        <TableCell>{r.empresa || "—"}</TableCell>
                        <TableCell className="text-xs">{r.equipamento || "—"}</TableCell>
                        <TableCell>
                          {r.preco != null
                            ? Number(r.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {deletedAt ? format(new Date(deletedAt), "dd/MM/yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restore(r)}
                            disabled={busyId === r.id}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => purge(r)}
                            disabled={busyId === r.id}
                          >
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
      </div>
    </HexaLayout>
  );
}
