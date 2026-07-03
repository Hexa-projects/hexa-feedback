import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/**
 * Discreet post-login install banner. Only renders when the browser supports
 * beforeinstallprompt (Android/Chrome/Edge) and the user hasn't dismissed it.
 * iOS instructions live on the dedicated /pwa page.
 */
export default function PwaInstallPrompt() {
  const { canInstall, isInstalled, dismissed, promptInstall, dismissInstallHint } = usePwaInstall();
  const [hidden, setHidden] = useState(false);

  // Delay showing so we don't compete with first paint
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!ready || hidden || dismissed || isInstalled || !canInstall) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-lg p-4 animate-fade-in">
      <button
        aria-label="Fechar"
        onClick={() => setHidden(true)}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-primary/10 text-primary">
          <Download className="w-4 h-4" />
        </div>
        <div className="flex-1 pr-4">
          <p className="text-sm font-semibold">Instalar HexaOS</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acesse como aplicativo, com abertura rápida e tela cheia.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={async () => {
                const r = await promptInstall();
                if (r !== "unavailable") setHidden(true);
              }}
            >
              Instalar app
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                dismissInstallHint();
                setHidden(true);
              }}
            >
              Agora não
            </Button>
            <a
              href="/pwa"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
            >
              Saiba mais
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
