import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (org: any) => void;
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

export default function CreateCompanySheet({ open, onOpenChange, onCreated }: Props) {
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
      !!(name || segment || url || summary || address || cnpj || cnpjAddress),
    [name, segment, url, summary, address, cnpj, cnpjAddress],
  );

  const reset = () => {
    setName("");
    setSegment("");
    setUrl("");
    setSummary("");
    setAddress("");
    setCnpj("");
    setCnpjAddress("");
    setNameError(false);
  };

  const requestClose = () => {
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
          if (addr) {
            setCnpjAddress(addr);
            if (!address) setAddress(addr);
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
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setSaving(true);
    try {
      const rd_id = `local-${crypto.randomUUID()}`;
      const raw_payload: any = {
        name: name.trim(),
        segment: segment || null,
        website: url || null,
        description: summary || null,
        address: address || null,
        cnpj_address: cnpjAddress || null,
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
      toast.error(err?.message || "Erro ao criar empresa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={v => {
          if (!v) requestClose();
          else onOpenChange(true);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col p-0"
          onInteractOutside={e => {
            e.preventDefault();
            requestClose();
          }}
          onEscapeKeyDown={e => {
            e.preventDefault();
            requestClose();
          }}
        >
          <SheetHeader className="p-6 border-b">
            <SheetTitle>Criar Empresa</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
              <Label htmlFor="cc-segment">Segmento</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger id="cc-segment">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS.map(s => (
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

            <div className="space-y-2">
              <Label htmlFor="cc-address">Endereço</Label>
              <Input
                id="cc-address"
                placeholder="Digite o endereço da empresa"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-3">
                Campos personalizados
              </div>

              <div className="space-y-4">
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
                  <Label htmlFor="cc-cnpj-address">Endereço</Label>
                  <Input
                    id="cc-cnpj-address"
                    placeholder="Endereço retornado pelo CNPJ"
                    value={cnpjAddress}
                    onChange={e => setCnpjAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 border-t bg-background">
            <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Empresa
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
