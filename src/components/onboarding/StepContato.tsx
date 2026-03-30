import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Shield } from "lucide-react";

interface Props {
  form: Record<string, any>;
  update: (key: string, val: string) => void;
  setConsent: (v: boolean) => void;
}

export default function StepContato({ form, update, setConsent }: Props) {
  const [error, setError] = useState("");

  const validate = (val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) { setError("WhatsApp é obrigatório"); return; }
    if (clean.length < 12 || clean.length > 13) { setError("Use DDI+DDD+número (ex: 5511999999999)"); return; }
    if (!clean.startsWith("55")) { setError("Deve começar com 55 (Brasil)"); return; }
    setError("");
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" /> Contato & Consentimento
        </h2>
        <p className="text-sm text-muted-foreground">Último passo! Precisamos do seu WhatsApp para comunicações operacionais.</p>
      </div>

      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 text-base font-semibold">
            <Phone className="w-4 h-4 text-primary" /> WhatsApp (obrigatório)
          </Label>
          <Input
            value={form.whatsapp}
            onChange={e => {
              const val = e.target.value.replace(/[^\d+]/g, "");
              update("whatsapp", val);
              if (error) validate(val);
            }}
            onBlur={() => validate(form.whatsapp)}
            placeholder="5511999999999"
            className={error ? "border-destructive" : ""}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">DDI + DDD + número, sem espaços ou traços</p>
        </div>

        <div className="flex items-start gap-3 rounded-lg bg-background/80 p-3 border">
          <Checkbox
            id="whatsapp_consent"
            checked={form.whatsapp_consent}
            onCheckedChange={(v) => setConsent(!!v)}
          />
          <label htmlFor="whatsapp_consent" className="text-sm leading-relaxed cursor-pointer">
            <Shield className="w-3.5 h-3.5 inline mr-1 text-primary" />
            Autorizo receber comunicações internas do Focus AI via WhatsApp (resumos, alertas e comunicados operacionais).
          </label>
        </div>
      </div>
    </div>
  );
}
