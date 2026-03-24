import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface AILapidacaoProps {
  tipo: "gargalo" | "processo" | "sugestao";
  conteudo: string;
  contexto?: string;
  onComplete: (perguntas: string[], respostas: string[]) => void;
}

export default function AILapidacao({ tipo, conteudo, contexto, onComplete }: AILapidacaoProps) {
  const [step, setStep] = useState<"idle" | "loading" | "answering" | "done">("idle");
  const [perguntas, setPerguntas] = useState<string[]>([]);
  const [respostas, setRespostas] = useState<string[]>(["", "", ""]);

  const gerarPerguntas = async () => {
    setStep("loading");
    try {
      const { data, error } = await supabase.functions.invoke("ai-lapidacao", {
        body: { tipo, conteudo, contexto },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const p = data.perguntas || [];
      setPerguntas(p);
      setRespostas(p.map(() => ""));
      setStep("answering");
    } catch (err: any) {
      toast.error("Erro ao gerar perguntas: " + err.message);
      setStep("idle");
    }
  };

  const enviarRespostas = () => {
    onComplete(perguntas, respostas);
    setStep("done");
    toast.success("Respostas de lapidação salvas!");
  };

  if (step === "done") {
    return (
      <div className="hexa-card p-4 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">Lapidação concluída ✓</span>
        </div>
      </div>
    );
  }

  if (step === "idle") {
    return (
      <Button variant="outline" className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5" onClick={gerarPerguntas}>
        <Sparkles className="w-4 h-4" />
        Aprofundar com IA (Lapidação)
      </Button>
    );
  }

  if (step === "loading") {
    return (
      <div className="hexa-card p-4 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Gerando perguntas de aprofundamento...</span>
      </div>
    );
  }

  return (
    <div className="hexa-card p-5 space-y-4 border-primary/20">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">IA de Lapidação — Responda para aprofundar</h3>
      </div>
      {perguntas.map((p, i) => (
        <div key={i}>
          <Label className="text-sm font-medium text-primary">{i + 1}. {p}</Label>
          <Textarea
            className="mt-1"
            value={respostas[i]}
            onChange={(e) => setRespostas((prev) => prev.map((r, j) => (j === i ? e.target.value : r)))}
            placeholder="Responda em 1-2 frases..."
            rows={2}
          />
        </div>
      ))}
      <Button className="w-full gap-2" onClick={enviarRespostas} disabled={respostas.every((r) => !r.trim())}>
        <Send className="w-4 h-4" />
        Enviar respostas
      </Button>
    </div>
  );
}
