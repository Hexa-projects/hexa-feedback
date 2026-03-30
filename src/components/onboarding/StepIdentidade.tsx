import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SETORES } from "@/types/forms";
import { Building2, Briefcase, MapPin, Clock } from "lucide-react";

interface Props {
  form: Record<string, any>;
  update: (key: string, val: string) => void;
}

export default function StepIdentidade({ form, update }: Props) {
  return (
    <div className="space-y-5 animate-slide-up">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" /> Sua Identidade na Empresa
        </h2>
        <p className="text-sm text-muted-foreground">Nos conte quem você é e onde atua.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Setor</Label>
          <Select value={form.setor} onValueChange={v => update("setor", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Função / Cargo</Label>
          <Input value={form.funcao} onChange={e => update("funcao", e.target.value)} placeholder="Ex: Analista financeiro" />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Unidade / Filial</Label>
          <Input value={form.unidade} onChange={e => update("unidade", e.target.value)} placeholder="Ex: Matriz SP" />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Tempo de casa</Label>
          <Input value={form.tempo_casa} onChange={e => update("tempo_casa", e.target.value)} placeholder="Ex: 2 anos e 3 meses" />
        </div>
      </div>
    </div>
  );
}
