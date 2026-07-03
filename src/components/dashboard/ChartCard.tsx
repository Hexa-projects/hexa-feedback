import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, description, loading, error, onRetry, empty, emptyMessage, actions, children, className }: Props) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3 flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-muted-foreground">{error}</p>
            {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>}
          </div>
        ) : empty ? (
          <div className="h-64 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            {emptyMessage || "Sem dados no período selecionado."}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
