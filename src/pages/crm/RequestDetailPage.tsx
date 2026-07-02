import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import HexaLayout from "@/components/HexaLayout";
import RequestDetailModal from "./RequestDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, role, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [request, setRequest] = useState<any | null>(null);
  const [isCeo, setIsCeo] = useState(false);
  const [privilegeChecked, setPrivilegeChecked] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [busy, setBusy] = useState(false);

  // Determine CEO/admin privilege using the same server RPC used by RequestsList,
  // with a client-side fallback based on profile.funcao and user_roles.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPrivilegeChecked(true);
      return;
    }
    (async () => {
      let ceo = false;
      try {
        const { data } = await (supabase as any).rpc("is_ceo_or_admin", { _user: user.id });
        ceo = !!data;
      } catch {
        /* ignore, fall back below */
      }
      if (!ceo) {
        const funcao = (profile?.funcao || "").toLowerCase();
        ceo =
          funcao.includes("ceo") ||
          funcao.includes("chief executive") ||
          funcao.includes("sócio") ||
          funcao.includes("socio") ||
          funcao.includes("diretor executivo") ||
          funcao.includes("fundador");
      }
      setIsCeo(ceo);
      setPrivilegeChecked(true);
    })();
  }, [user, profile, authLoading]);

  const canEditStatus = role === "admin" || role === "gestor" || isCeo;


  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("commercial_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar solicitação");
      setNotFound(true);
      return;
    }
    if (!data) {
      setNotFound(true);
      return;
    }
    setRequest(data);
    // Auto-mark the linked notification as read
    if (user) {
      await (supabase as any)
        .from("notifications")
        .update({ lida: true })
        .eq("user_id", user.id)
        .eq("lida", false)
        .contains("metadata", { request_id: id });
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user?.id]);

  const handleApprove = async () => {
    if (!id) return;
    if (!window.confirm("Aprovar esta solicitação e criar o card em Novo Negócio?")) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("approve_commercial_request", { request_id: id });
    setBusy(false);
    if (error) return toast.error("Erro ao aprovar: " + error.message);
    toast.success("Solicitação aprovada — lead criado em Novo Negócio.");
    load();
  };

  const handleReject = async () => {
    if (!id) return;
    if (!rejectReason.trim()) return toast.error("Informe o motivo da reprovação.");
    setRejecting(true);
    const { error } = await (supabase as any).rpc("reject_commercial_request", {
      request_id: id,
      reason: rejectReason.trim(),
    });
    setRejecting(false);
    if (error) return toast.error("Erro ao reprovar: " + error.message);
    toast.success("Solicitação reprovada.");
    setShowRejectBox(false);
    setRejectReason("");
    load();
  };

  const status = request?.status as string | undefined;
  const canAct = privilegeChecked && canEditStatus && status === "pendente";


  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/crm/requests")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Solicitações
          </Button>
          {status && (
            <Badge
              variant="secondary"
              className={
                status === "pendente" ? "bg-amber-100 text-amber-800" :
                status === "aprovada" ? "bg-emerald-100 text-emerald-800" :
                status === "reprovada" ? "bg-red-100 text-red-800" :
                "bg-muted"
              }
            >
              {status.toUpperCase()}
            </Badge>
          )}
        </div>

        {loading && (
          <Card>
            <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando solicitação...
            </CardContent>
          </Card>
        )}

        {!loading && notFound && (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-semibold">Solicitação não encontrada</p>
              <p className="text-sm text-muted-foreground">
                Ela pode ter sido excluída ou você não tem acesso.
              </p>
              <Button variant="outline" onClick={() => navigate("/crm/requests")}>
                Voltar
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && request && (
          <>
            {/* Reuse the existing detail component in read-only mode */}
            <div className="rounded-xl border bg-card p-2">
              <RequestDetailModal
                requestId={request.id}
                open
                onClose={() => navigate("/crm/requests")}
                canEdit={false}
              />
            </div>

            {canAct && (
              <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={handleApprove} disabled={busy}>
                      {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                      Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectBox((v) => !v)}
                      disabled={busy || rejecting}
                    >
                      <X className="w-4 h-4 mr-1" /> Reprovar
                    </Button>
                  </div>
                  {showRejectBox && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Motivo da reprovação"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
                          {rejecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                          Confirmar Reprovação
                        </Button>
                        <Button variant="outline" onClick={() => { setShowRejectBox(false); setRejectReason(""); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </HexaLayout>
  );
}
