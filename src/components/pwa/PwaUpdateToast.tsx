import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerPwa } from "@/pwa/register";

/**
 * Mounts once. Registers the service worker via the guarded wrapper and shows
 * a discreet toast when a new version is waiting. Only reloads on user consent.
 */
export default function PwaUpdateToast() {
  const [reloadFn, setReloadFn] = useState<null | (() => void)>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    registerPwa((reload) => setReloadFn(() => reload));
  }, []);

  if (!reloadFn || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-lg px-4 py-3 flex items-center gap-3 animate-fade-in">
      <RefreshCw className="w-4 h-4 text-primary" />
      <p className="text-sm">Nova versão do HexaOS disponível.</p>
      <Button size="sm" onClick={() => reloadFn()}>
        Atualizar agora
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} aria-label="Depois">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
