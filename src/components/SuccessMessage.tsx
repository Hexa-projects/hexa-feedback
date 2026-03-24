import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title?: string;
  message?: string;
  onNew?: () => void;
}

export default function SuccessMessage({ title = "Enviado com sucesso!", message = "Obrigado pela sua contribuição para o HexaOS.", onNew }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-slide-up text-center">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
        <CheckCircle className="w-8 h-8 text-hexa-green" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm mb-6">{message}</p>
      {onNew && <Button onClick={onNew} variant="outline">Preencher outro</Button>}
    </div>
  );
}
