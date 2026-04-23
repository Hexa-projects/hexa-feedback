import { User, Briefcase, MapPin, Cog, Brain, Quote } from "lucide-react";
import OnboardingProcessCard from "./OnboardingProcessCard";

interface Props {
  profile: any;
  processes: any[];
}

export default function OnboardingSummaryPane({ profile, processes }: Props) {
  const hasProfile = profile && (profile.setor || profile.funcao || profile.unidade);

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-4">
      {/* What Maya understood */}
      <div className="rounded-3xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/80">
            O que a Maya entendeu
          </p>
        </div>

        <div className="p-5 space-y-3">
          {hasProfile ? (
            <>
              {profile.funcao && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Função
                    </p>
                    <p className="text-sm font-semibold leading-tight">{profile.funcao}</p>
                  </div>
                </div>
              )}
              {profile.setor && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Briefcase className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Setor
                    </p>
                    <p className="text-sm font-semibold leading-tight capitalize">{profile.setor}</p>
                  </div>
                </div>
              )}
              {profile.unidade && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Unidade
                    </p>
                    <p className="text-sm font-semibold leading-tight">{profile.unidade}</p>
                  </div>
                </div>
              )}
              {profile.resumo_geral && (
                <div className="rounded-2xl bg-muted/40 p-3 border-l-2 border-primary/40 mt-3">
                  <Quote className="w-3 h-3 text-primary/60 mb-1" />
                  <p className="text-xs text-foreground/80 italic leading-relaxed">
                    {profile.resumo_geral}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-2">
                <Brain className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground">
                Aguardando suas primeiras respostas…
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Processes */}
      <div className="rounded-3xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cog className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/80">
              Processos mapeados
            </p>
          </div>
          <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums shadow-sm shadow-primary/30">
            {processes.length}
          </span>
        </div>

        <div className="p-3 space-y-2 max-h-[440px] overflow-y-auto scrollbar-thin">
          {processes.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Cog className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground">
                Nenhum processo identificado ainda
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Conte para a Maya o que você faz
              </p>
            </div>
          ) : (
            processes.map((p) => <OnboardingProcessCard key={p.id || p.process_name} process={p} />)
          )}
        </div>
      </div>
    </aside>
  );
}
