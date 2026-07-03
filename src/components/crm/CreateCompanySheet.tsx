import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type CompanyFields = {
  name: string;
  tipo: string;
  segment: string;
  url: string;
  summary: string;
  address: string;
  cnpj: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (org: any) => void;
  mode?: "create" | "edit";
  initial?: Partial<CompanyFields>;
  onSaved?: (data: CompanyFields) => void;
};

const SEGMENTOS_POR_TIPO: Record<string, string[]> = {
  Humana: [
    "Clínica",
    "Hospital",
    "Laboratório",
    "Centro de Diagnóstico",
    "UPA/Pronto-Socorro",
    "Outros",
  ],
  Veterinária: [
    "Clínica Veterinária",
    "Hospital Veterinário",
    "Outros",
  ],
};
const TIPOS = ["Humana", "Veterinária"];

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCnpj(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (base: string) => {
    let sum = 0;
    let pos = base.length - 7;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.slice(0, 12));
  const d2 = calc(d.slice(0, 12) + d1);
  return d1 === parseInt(d[12]) && d2 === parseInt(d[13]);
}

export default function CreateCompanySheet({ open, onOpenChange, onCreated, mode = "create", initial, onSaved }: Props) {
  const [name, setName] = useState("");
  const [tipo, setTipo] = useState("");
  const [segment, setSegment] = useState("");
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [address, setAddress] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nameError, setNameError] = useState(false);
  const [tipoError, setTipoError] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const isDirty = useMemo(
    () =>
      !!(name || tipo || segment || url || summary || address || cnpj),
    [name, tipo, segment, url, summary, address, cnpj],
  );

  const reset = () => {
    setName("");
    setTipo("");
    setSegment("");
    setUrl("");
    setSummary("");
    setAddress("");
    setCnpj("");
    setNameError(false);
    setTipoError(false);
  };

  useEffect(() => {
    if (open && mode === "edit" && initial) {
      setName(initial.name || "");
      setTipo(initial.tipo || "");
      setSegment(initial.segment || "");
      setUrl(initial.url || "");
      setSummary(initial.summary || "");
      setAddress(initial.address || "");
      setCnpj(initial.cnpj || "");
      setNameError(false);
      setTipoError(false);
    }
    if (!open && mode === "create") {
      // keep create behavior as-is
    }
  }, [open, mode, initial]);

  const requestClose = () => {
    if (mode === "edit") {
      onOpenChange(false);
      return;
    }
    if (isDirty) setConfirmClose(true);
    else onOpenChange(false);
  };

  const handleCnpjChange = async (v: string) => {
    const masked = maskCnpj(v);
    setCnpj(masked);
    const digits = masked.replace(/\D/g, "");
    if (digits.length === 14 && isValidCnpj(masked)) {
      setLookingUp(true);
      try {
        const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
        if (r.ok) {
          const data = await r.json();
          const razao = data.razao_social || data.nome_fantasia;
          if (razao && !name) setName(razao);
          const addr = [
            data.logradouro,
            data.numero,
            data.bairro,
            data.municipio,
            data.uf,
            data.cep,
          ]
            .filter(Boolean)
            .join(", ");
          if (addr && !address) {
            setAddress(addr);
          }
          toast.success("Dados do CNPJ preenchidos automaticamente");
        }
      } catch {
        // fallback: campos editáveis manualmente
      } finally {
        setLookingUp(false);
      }
    }
  };

  const handleSubmit = async () => {
    let hasError = false;
    if (!name.trim()) {
      setNameError(true);
      hasError = true;
    }
    if (!tipo) {
      setTipoError(true);
      hasError = true;
    }
    if (hasError) return;
    setSaving(true);
    try {
      if (mode === "edit") {
        onSaved?.({
          name: name.trim(),
          tipo,
          segment,
          url,
          summary,
          address,
          cnpj,
        });
        toast.success("Empresa atualizada com sucesso");
        onOpenChange(false);
        return;
      }
      const rd_id = `local-${crypto.randomUUID()}`;
      const raw_payload: any = {
        name: name.trim(),
        tipo: tipo || null,
        segment: segment || null,
        website: url || null,
        description: summary || null,
        address: address || null,
        created_at: new Date().toISOString(),
        source: "hexaos-manual",
      };
      const { data, error } = await supabase
        .from("rd_organizations")
        .insert({
          rd_id,
          name: name.trim(),
          cnpj: cnpj || null,
          raw_payload,
          rd_updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Empresa criada com sucesso");
      onCreated?.(data);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || (mode === "edit" ? "Erro ao atualizar empresa" : "Erro ao criar empresa"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={v => {
          if (!v) requestClose();
          else onOpenChange(true);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "Editar Empresa" : "Criar Empresa"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="cc-cnpj">CNPJ</Label>
              <div className="relative">
                <Input
                  id="cc-cnpj"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={e => handleCnpjChange(e.target.value)}
                  inputMode="numeric"
                />
                {lookingUp && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-name">
                Nome da empresa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cc-name"
                placeholder="Digite o nome da empresa"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setNameError(false);
                }}
                aria-invalid={nameError}
                className={nameError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {nameError && (
                <p className="text-xs text-destructive">Nome da empresa é obrigatório</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-address">Endereço</Label>
              <Input
                id="cc-address"
                placeholder="Digite o endereço da empresa"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-tipo">
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select
                value={tipo}
                onValueChange={v => {
                  setTipo(v);
                  setSegment("");
                  setTipoError(false);
                }}
              >
                <SelectTrigger
                  id="cc-tipo"
                  aria-invalid={tipoError}
                  className={tipoError ? "border-destructive focus:ring-destructive" : ""}
                >
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipoError && (
                <p className="text-xs text-destructive">Tipo é obrigatório</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-segment">Segmento</Label>
              <Select
                value={segment}
                onValueChange={setSegment}
                disabled={!tipo}
              >
                <SelectTrigger id="cc-segment">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {(SEGMENTOS_POR_TIPO[tipo] || []).map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-url">URL</Label>
              <Input
                id="cc-url"
                placeholder="Digite o endereço do site da empresa"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cc-summary">Resumo</Label>
              <Textarea
                id="cc-summary"
                placeholder="Descreva a empresa"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                className="min-h-[100px] resize-y"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-3 sm:justify-between">
            <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "edit" ? "Salvar alterações" : "Criar Empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você preencheu alguns campos. Deseja descartar as alterações?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                reset();
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
