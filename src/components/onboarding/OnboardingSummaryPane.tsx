import { User, Briefcase, MapPin, Cog } from "lucide-react";
import OnboardingProcessCard from "./OnboardingProcessCard";

interface Props {
  profile: any;
  processes: any[];
}

export default function OnboardingSummaryPane({ profile, processes }: Props) {
  const hasProfile = profile && (profile.setor || profile.funcao || profile.unidade);

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-4">
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            O que a Maya entendeu
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Profile */}
          {hasProfile ? (
            <div className="space-y-2">
              {profile.funcao && (
                <div className="flex items-start gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <span>{profile.funcao}</span>
                </div>
              )}
              {profile.setor && (
                <div className="flex items-start gap-2 text-sm">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <span>{profile.setor}</span>
                </div>
              )}
              {profile.unidade && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <span>{profile.unidade}</span>
                </div>
              )}
              {profile.resumo_geral && (
                <p className="text-xs text-muted-foreground italic pt-2 border-t">
                  "{profile.resumo_geral}"
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              Aguardando suas primeiras respostas…
            </p>
          )}
        </div>
      </div>

      {/* Processes */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Processos mapeados
          </p>
          <span className="text-xs font-bold tabular-nums text-primary">{processes.length}</span>
        </div>

        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
          {processes.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <Cog className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Nenhum processo identificado ainda
            </div>
          ) : (
            processes.map((p) => <OnboardingProcessCard key={p.id || p.process_name} process={p} />)
          )}
        </div>
      </div>
    </aside>
  );
}
