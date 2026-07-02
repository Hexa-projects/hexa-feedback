import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, X, Save, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  requestId: string | null;
  leadId?: string | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  onDelete?: (leadId: string) => void;
};

// Parse "CATEGORIA - MARCA - MODELO" back into parts.
function splitEquipamento(eq: string | null | undefined) {
  if (!eq) return { categoria: "", marca: "", modelo: "" };
  const parts = String(eq).split(" - ").map((s) => s.trim());
  return {
    categoria: parts[0] || "",
    marca: parts[1] || "",
    modelo: parts.slice(2).join(" - ") || "",
  };
}

// Parse concatenated endereco: "rua, complemento - bairro, cidade/UF - CEP xxx"
function splitEndereco(end: string | null | undefined) {
  const raw = String(end || "");
  const cepMatch = raw.match(/CEP\s+([\d\-\.]+)/i);
  const cep = cepMatch ? cepMatch[1] : "";
  return { raw, cep };
}

export default function RequestDetailModal({ requestId, open, onClose, canEdit }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !requestId) return;
    setLoading(true);
    setEditMode(false);
    (supabase as any)
      .from("commercial_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle()
      .then(({ data, error }: any) => {
        setLoading(false);
        if (error) {
          console.error("[RequestDetailModal] fetch error", error);
          toast.error("Erro ao carregar solicitação");
          return;
        }
        setData(data);
        setForm(data || {});
      });
  }, [open, requestId]);

  const handleClose = () => {
    setEditMode(false);
    setData(null);
    setForm({});
    onClose();
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    const patch: any = {
      tipo: form.tipo,
      empresa: form.empresa,
      cnpj: form.cnpj,
      telefone: form.telefone,
      endereco: form.endereco,
      contato: form.contato,
      responsavel_comercial: form.responsavel_comercial,
      email_1: form.email_1,
      email_2: form.email_2,
      equipamento: form.equipamento,
      preco: form.preco === "" || form.preco == null ? null : Number(form.preco),
      comissao: form.comissao === "" || form.comissao == null ? null : Number(form.comissao),
      frete: form.frete,
      origem: form.origem,
      observacoes: form.observacoes,
    };
    const { error } = await (supabase as any)
      .from("commercial_requests")
      .update(patch)
      .eq("id", data.id);
    setSaving(false);
    if (error) {
      console.error("[RequestDetailModal] update error", error);
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Solicitação atualizada");
    setData({ ...data, ...patch });
    setEditMode(false);
  };

  const hasCnpj = !!(data?.cnpj && String(data.cnpj).trim());
  const eqParts = splitEquipamento(data?.equipamento);
  const endInfo = splitEndereco(data?.endereco);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Detalhes da Solicitação</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">
              Via Solicitação
            </Badge>
            {data?.id && (
              <span className="text-xs font-normal text-muted-foreground">
                ID: {String(data.id).slice(0, 8)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        )}

        {!loading && data && (
          <div className="space-y-6">
            <Section title="Identificação">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Tipo" editMode={editMode} value={form.tipo}
                  onChange={(v) => setForm({ ...form, tipo: v })} display={data.tipo} />
                <Field
                  label={hasCnpj ? "CNPJ" : "CPF"}
                  editMode={editMode}
                  value={form.cnpj}
                  onChange={(v) => setForm({ ...form, cnpj: v })}
                  display={data.cnpj}
                />
              </div>
            </Section>

            <Section title={hasCnpj ? "Dados da Empresa" : "Dados do Cliente"}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label={hasCnpj ? "Nome da Empresa" : "Nome do Cliente"}
                  editMode={editMode}
                  value={form.empresa}
                  onChange={(v) => setForm({ ...form, empresa: v })}
                  display={data.empresa}
                />
                <Field label="CEP" editMode={false} display={endInfo.cep} />
                <div className="md:col-span-2">
                  <Field label="Endereço Fiscal" editMode={false} display={endInfo.raw} multiline />
                </div>
              </div>
            </Section>

            <Section title="Endereço de Atendimento">
              <div className="grid grid-cols-1 gap-4">
                <Field
                  label="Endereço completo"
                  editMode={editMode}
                  value={form.endereco}
                  onChange={(v) => setForm({ ...form, endereco: v })}
                  display={data.endereco}
                  multiline
                />
              </div>
            </Section>

            <Section title="Contato">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Contato" editMode={editMode} value={form.contato}
                  onChange={(v) => setForm({ ...form, contato: v })} display={data.contato} />
                <Field label="Telefone" editMode={editMode} value={form.telefone}
                  onChange={(v) => setForm({ ...form, telefone: v })} display={data.telefone} />
                <Field label="E-mail 1" editMode={editMode} value={form.email_1}
                  onChange={(v) => setForm({ ...form, email_1: v })} display={data.email_1} />
                <Field label="E-mail 2" editMode={editMode} value={form.email_2}
                  onChange={(v) => setForm({ ...form, email_2: v })} display={data.email_2} />
                <Field label="Vendedor(a)" editMode={editMode} value={form.responsavel_comercial}
                  onChange={(v) => setForm({ ...form, responsavel_comercial: v })}
                  display={data.responsavel_comercial} />
              </div>
            </Section>

            <Section title="Dados do Equipamento">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Categoria" editMode={false} display={eqParts.categoria} />
                <Field label="Marca" editMode={false} display={eqParts.marca} />
                <Field label="Modelo" editMode={false} display={eqParts.modelo} />
              </div>
              {editMode && (
                <div className="mt-3">
                  <Field
                    label="Equipamento (Categoria - Marca - Modelo)"
                    editMode
                    value={form.equipamento}
                    onChange={(v) => setForm({ ...form, equipamento: v })}
                    display={data.equipamento}
                  />
                </div>
              )}
            </Section>

            <Section title="Proposta">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Preço"
                  editMode={editMode}
                  value={form.preco ?? ""}
                  onChange={(v) => setForm({ ...form, preco: v })}
                  display={
                    data.preco != null
                      ? Number(data.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : ""
                  }
                />
                <Field
                  label="Comissão (%)"
                  editMode={editMode}
                  value={form.comissao ?? ""}
                  onChange={(v) => setForm({ ...form, comissao: v })}
                  display={data.comissao != null ? `${data.comissao}%` : ""}
                />
                <Field label="Frete" editMode={editMode} value={form.frete}
                  onChange={(v) => setForm({ ...form, frete: v })} display={data.frete} />
                <Field label="Origem" editMode={editMode} value={form.origem}
                  onChange={(v) => setForm({ ...form, origem: v })} display={data.origem} />
                <div className="md:col-span-2">
                  <Field
                    label="Observações"
                    editMode={editMode}
                    value={form.observacoes}
                    onChange={(v) => setForm({ ...form, observacoes: v })}
                    display={data.observacoes}
                    multiline
                  />
                </div>
                <Field
                  label="Criada em"
                  editMode={false}
                  display={data.created_at ? format(new Date(data.created_at), "dd/MM/yyyy HH:mm") : ""}
                />
              </div>
            </Section>
          </div>
        )}

        <DialogFooter className="gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => { setEditMode(false); setForm(data || {}); }} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Salvar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Fechar</Button>
              {canEdit && data && (
                <Button onClick={() => setEditMode(true)}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label, display, editMode, value, onChange, multiline,
}: {
  label: string;
  display?: any;
  editMode: boolean;
  value?: any;
  onChange?: (v: string) => void;
  multiline?: boolean;
}) {
  const shown = display === null || display === undefined || display === "" ? "—" : String(display);
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      {editMode && onChange ? (
        multiline ? (
          <Textarea
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
          />
        ) : (
          <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        )
      ) : (
        <div
          className={cn(
            "min-h-10 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm",
            multiline && "whitespace-pre-wrap",
          )}
        >
          {shown}
        </div>
      )}
    </div>
  );
}
