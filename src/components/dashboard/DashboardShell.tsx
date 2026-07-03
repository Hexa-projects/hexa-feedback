import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import HexaLayout from "@/components/HexaLayout";

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  periodLabel?: string;
  children: React.ReactNode;
}

export function DashboardShell({ title, subtitle, icon, filters, actions, lastUpdated, onRefresh, refreshing, periodLabel, children }: Props) {
  return (
    <HexaLayout>
      <div className="space-y-4 animate-slide-up pb-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {icon}
              {title}
            </h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              {periodLabel && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> {periodLabel}</span>}
              {lastUpdated && (
                <span>
                  Atualizado {formatDistanceToNow(lastUpdated, { locale: ptBR, addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {filters}
            {onRefresh && (
              <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing} className="gap-1">
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            )}
            {actions}
          </div>
        </header>
        {children}
      </div>
    </HexaLayout>
  );
}
