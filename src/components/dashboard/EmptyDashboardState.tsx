import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  cta?: React.ReactNode;
}

export function EmptyDashboardState({ title, description, cta }: Props) {
  return (
    <Card>
      <CardContent className="p-10 text-center flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground max-w-md">{description}</p>}
        {cta}
      </CardContent>
    </Card>
  );
}
