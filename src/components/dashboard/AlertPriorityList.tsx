import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AlertItem {
  id: string;
  severity: "critical" | "attention" | "info";
  title: string;
  description?: string;
  timestamp?: string;
  link?: string;
  category?: string;
}

const SEV_STYLE: Record<AlertItem["severity"], { badge: string; dot: string }> = {
  critical: { badge: "bg-red-500/10 text-red-600 border-red-500/30", dot: "bg-red-500" },
  attention: { badge: "bg-amber-500/10 text-amber-700 border-amber-500/30", dot: "bg-amber-500" },
  info: { badge: "bg-blue-500/10 text-blue-700 border-blue-500/30", dot: "bg-blue-500" },
};

const SEV_LABEL: Record<AlertItem["severity"], string> = {
  critical: "Crítico",
  attention: "Atenção",
  info: "Info",
};

interface Props {
  items: AlertItem[];
  title?: string;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

export function AlertPriorityList({ items, title = "Atenção agora", emptyMessage = "Nada urgente por aqui.", loading, className }: Props) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> {title}
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando alertas...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {emptyMessage}
          </div>
        ) : (
          <ul className="divide-y">
            {items.map(item => (
              <li key={item.id}>
                {item.link ? (
                  <Link to={item.link} className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
                    <AlertRow item={item} />
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 p-3">
                    <AlertRow item={item} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({ item }: { item: AlertItem }) {
  const s = SEV_STYLE[item.severity];
  return (
    <>
      <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", s.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] uppercase", s.badge)}>{SEV_LABEL[item.severity]}</Badge>
          {item.category && <span className="text-[11px] text-muted-foreground">{item.category}</span>}
        </div>
        <p className="text-sm font-medium mt-1 line-clamp-2">{item.title}</p>
        {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>}
      </div>
      {item.link && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
    </>
  );
}
