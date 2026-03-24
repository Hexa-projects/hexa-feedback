import HexaLayout from "@/components/HexaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <HexaLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Construction className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{title}</h2>
            <p className="text-muted-foreground text-sm">
              Este módulo está em desenvolvimento e será liberado em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    </HexaLayout>
  );
}
