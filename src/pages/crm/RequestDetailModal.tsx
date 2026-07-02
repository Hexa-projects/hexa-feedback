import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Props = {
  requestId: string | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
};

const formatCurrency = (v: any) =>
  v == null || v === "" ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function RequestDetailModal({ requestId, open, onClose, canEdit }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open || !requestId) return;
    let alive = true;
    setLoading(true);
    setEditMode(false);
    (supabase as any)
      .from("commercial_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle()
      .then(({ data: row, error }: any) => {
        if (!alive) return;
        if (error) toast.error("Erro ao carregar solicitação: " + error.message);
        setData(row || null);
        setForm(row || {});
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, requestId]);

  const isCpf = !!data?.cpf;

  const save = async () => {
    if (!requestId) return;
    setSaving(true);
    // Only persist fields that likely exist in the table (mirror emptyForm from RequestsList)
    const allowed = [
      "tipo","empresa","cnpj","cpf","cliente_nome","telefone",
      "cep_empresa","rua_empresa","bairro_empresa","cidade_empresa","uf_empresa",
      "cep","rua","bairro","cidade","uf","complemento","endereco",
      "contato","responsavel_comercial","email_1","email_2",
      "equipamento","categoria","marca","modelo",
      "itens_inclusos","itens_nao_inclusos",
      "preco","condicoes_pagamento","tempo_garantia","frete","comissao",
      "origem","observacoes",
    ];
    const payload: Record<string, any> = {};
    for (const k of allowed) if (k in form) payload[k] = form[k] ?? null;
    const { error } = await (supabase as any)
      .from("commercial_requests")
      .update(payload)
      .eq("id", requestId);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Solicitação atualizada");
    setData({ ...data, ...payload });
    setEditMode(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da Solicitação
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">
              Via Solicitação
            </Badge>
            {data?.id && (
              <span className="text-xs text-muted-foreground font-mono">#{String(data.id).slice(0, 8)}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        )}

        {!loading && !data && (
          <div className="py-6 text-sm text-muted-foreground">Solicitação não encontrada.</div>
        )}

        {!loading && data && (
          <div className="space-y-6">
            {/* Identificação */}
            <Section title="Identificação">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="Tipo" edit={editMode}
                  value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })}
                  display={data.tipo} />
                <FieldRow
                  label={isCpf ? "CPF" : "CNPJ"}
                  edit={editMode}
                  value={isCpf ? form.cpf : form.cnpj}
                  onChange={(v) => setForm({ ...form, [isCpf ? "cpf" : "cnpj"]: v })}
                  display={isCpf ? data.cpf : data.cnpj}
                />
              </div>
            </Section>

            {/* Dados da Empresa / Cliente */}
            <Section title={isCpf ? "Dados do Cliente" : "Dados da Empresa"}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow
                  label={isCpf ? "Nome do cliente" : "Nome da empresa"}
                  edit={editMode}
                  value={isCpf ? form.cliente_nome : form.empresa}
                  onChange={(v) => setForm({ ...form, [isCpf ? "cliente_nome" : "empresa"]: v })}
                  display={isCpf ? data.cliente_nome : data.empresa}
                />
                <FieldRow label="CEP" edit={editMode}
                  value={form.cep_empresa} onChange={(v) => setForm({ ...form, cep_empresa: v })}
                  display={data.cep_empresa} />
                <FieldRow label="Rua" edit={editMode}
                  value={form.rua_empresa} onChange={(v) => setForm({ ...form, rua_empresa: v })}
                  display={data.rua_empresa} />
                <FieldRow label="Bairro" edit={editMode}
                  value={form.bairro_empresa} onChange={(v) => setForm({ ...form, bairro_empresa: v })}
                  display={data.bairro_empresa} />
                <FieldRow label="Cidade" edit={editMode}
                  value={form.cidade_empresa} onChange={(v) => setForm({ ...form, cidade_empresa: v })}
                  display={data.cidade_empresa} />
                <FieldRow label="UF" edit={editMode}
                  value={form.uf_empresa} onChange={(v) => setForm({ ...form, uf_empresa: v })}
                  display={data.uf_empresa} />
              </div>
            </Section>

            {/* Endereço de Atendimento */}
            <Section title="Endereço de Atendimento">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="CEP" edit={editMode}
                  value={form.cep} onChange={(v) => setForm({ ...form, cep: v })}
                  display={data.cep} />
                <FieldRow label="Rua" edit={editMode}
                  value={form.rua} onChange={(v) => setForm({ ...form, rua: v })}
                  display={data.rua} />
                <FieldRow label="Bairro" edit={editMode}
                  value={form.bairro} onChange={(v) => setForm({ ...form, bairro: v })}
                  display={data.bairro} />
                <FieldRow label="Cidade" edit={editMode}
                  value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })}
                  display={data.cidade} />
                <div className="md:col-span-2">
                  <FieldRow label="Complemento" edit={editMode}
                    value={form.complemento} onChange={(v) => setForm({ ...form, complemento: v })}
                    display={data.complemento} />
                </div>
              </div>
            </Section>

            {/* Contato */}
            <Section title="Contato">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="Contato" edit={editMode}
                  value={form.contato} onChange={(v) => setForm({ ...form, contato: v })}
                  display={data.contato} />
                <FieldRow label="Telefone" edit={editMode}
                  value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })}
                  display={data.telefone} />
                <FieldRow label="E-mail 1" edit={editMode}
                  value={form.email_1} onChange={(v) => setForm({ ...form, email_1: v })}
                  display={data.email_1} />
                <FieldRow label="E-mail 2" edit={editMode}
                  value={form.email_2} onChange={(v) => setForm({ ...form, email_2: v })}
                  display={data.email_2} />
                <div className="md:col-span-2">
                  <FieldRow label="Vendedor(a)" edit={editMode}
                    value={form.responsavel_comercial}
                    onChange={(v) => setForm({ ...form, responsavel_comercial: v })}
                    display={data.responsavel_comercial} />
                </div>
              </div>
            </Section>

            {/* Dados do Equipamento */}
            <Section title="Dados do Equipamento">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FieldRow label="Categoria" edit={editMode}
                  value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })}
                  display={data.categoria} />
                <FieldRow label="Marca" edit={editMode}
                  value={form.marca} onChange={(v) => setForm({ ...form, marca: v })}
                  display={data.marca} />
                <FieldRow label="Modelo" edit={editMode}
                  value={form.modelo} onChange={(v) => setForm({ ...form, modelo: v })}
                  display={data.modelo} />
              </div>
            </Section>

            {/* Proposta */}
            <Section title="Proposta">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="Preço" edit={editMode}
                  value={form.preco} onChange={(v) => setForm({ ...form, preco: v })}
                  display={formatCurrency(data.preco)} inputType="number" />
                <FieldRow label="Comissão" edit={editMode}
                  value={form.comissao} onChange={(v) => setForm({ ...form, comissao: v })}
                  display={data.comissao != null ? `${data.comissao}%` : ""} inputType="number" />
                <FieldRow label="Frete" edit={editMode}
                  value={form.frete} onChange={(v) => setForm({ ...form, frete: v })}
                  display={data.frete} />
                {editMode ? (
                  <div className="space-y-1.5">
                    <Label>Origem</Label>
                    <Select value={form.origem || ""} onValueChange={(v) => setForm({ ...form, origem: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Site">Site</SelectItem>
                        <SelectItem value="Indicação">Indicação</SelectItem>
                        <SelectItem value="Evento">Evento</SelectItem>
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <FieldRow label="Origem" edit={false} value={data.origem} onChange={() => {}} display={data.origem} />
                )}
              </div>
            </Section>

            {/* Observações */}
            {(data.observacoes || editMode) && (
              <Section title="Observações">
                {editMode ? (
                  <Textarea rows={3} value={form.observacoes || ""}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                ) : (
                  <div className={cn(
                    "min-h-10 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap",
                  )}>
                    {data.observacoes || "—"}
                  </div>
                )}
              </Section>
            )}

            {data.created_at && (
              <p className="text-xs text-muted-foreground">
                Criada em {format(new Date(data.created_at), "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {canEdit && data && !editMode && (
            <Button variant="secondary" onClick={() => setEditMode(true)} className="gap-1">
              <Pencil className="w-4 h-4" /> Editar
            </Button>
          )}
          {editMode && (
            <>
              <Button variant="outline" onClick={() => { setForm(data || {}); setEditMode(false); }} className="gap-1">
                <X className="w-4 h-4" /> Cancelar
              </Button>
              <Button onClick={save} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </>
          )}
          {!editMode && (
            <Button variant="outline" onClick={onClose}>Fechar</Button>
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

function FieldRow({
  label, edit, value, onChange, display, inputType = "text",
}: {
  label: string;
  edit: boolean;
  value: any;
  onChange: (v: string) => void;
  display: any;
  inputType?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={edit ? "" : "text-muted-foreground"}>{label}</Label>
      {edit ? (
        <Input
          type={inputType}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="min-h-10 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
          {display === null || display === undefined || display === "" ? "—" : String(display)}
        </div>
      )}
    </div>
  );
}
