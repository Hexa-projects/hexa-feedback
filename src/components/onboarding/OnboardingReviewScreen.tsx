import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, AlertTriangle, Lightbulb, TrendingUp, Loader2 } from "lucide-react";
import OnboardingProcessCard from "./OnboardingProcessCard";

interface Props {
  profile: any;
  processes: any[];
  insights: any | null;
  finalizing: boolean;
  onConfirm: () => void;
  onContinue: () => void;
}

export default function OnboardingReviewScreen({
  profile, processes, insights, finalizing, onConfirm, onContinue,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Check className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Revisão final</h2>
        <p className="text-sm text-muted-foreground">
          Confira o que a Maya entendeu antes de concluir o mapeamento
        </p>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border bg-card p-5 space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Perfil</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-2">
          <div><p className="text-xs text-muted-foreground">Função</p><p className="font-medium">{profile?.funcao || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Setor</p><p className="font-medium">{profile?.setor || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Unidade</p><p className="font-medium">{profile?.unidade || "—"}</p></div>
        </div>
        {profile?.resumo_geral && (
          <p className="text-sm text-muted-foreground italic pt-2 border-t">"{profile.resumo_geral}"</p>
        )}
      </div>

      {/* Processes */}
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Processos ({processes.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {processes.map((p) => <OnboardingProcessCard key={p.id || p.process_name} process={p} />)}
        </div>
      </div>

      {/* Insights */}
      {insights && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {insights.key_bottlenecks?.length > 0 && (
            <InsightBlock
              icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
              title="Gargalos"
              items={insights.key_bottlenecks}
            />
          )}
          {insights.automation_opportunities?.length > 0 && (
            <InsightBlock
              icon={<Lightbulb className="w-4 h-4 text-primary" />}
              title="Oportunidades de automação"
              items={insights.automation_opportunities}
            />
          )}
          {insights.standardization_opportunities?.length > 0 && (
            <InsightBlock
              icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
              title="Padronização"
              items={insights.standardization_opportunities}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={onContinue} disabled={finalizing}>
          Continuar conversa
        </Button>
        <Button onClick={onConfirm} disabled={finalizing} size="lg" className="gap-2">
          {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {insights ? "Concluir onboarding" : "Gerar insights e concluir"}
        </Button>
      </div>
    </div>
  );
}

function InsightBlock({ icon, title, items }: { icon: React.ReactNode; title: string; items: any[] }) {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold">{title}</h4>
        <Badge variant="secondary" className="ml-auto text-[10px] h-4">{items.length}</Badge>
      </div>
      <ul className="space-y-2">
        {items.slice(0, 5).map((item, i) => (
          <li key={i} className="text-xs">
            <p className="font-medium">{item.titulo || item.title || ""}</p>
            <p className="text-muted-foreground line-clamp-2">{item.descricao || item.description || ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
