import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  registerPwa,
  subscribePwaUpdate,
  updateApp,
  dismissUpdate,
  type PwaUpdateState,
} from "@/pwa/register";

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

/**
 * Global PWA update prompt.
 *
 * - Registers the service worker (via the guarded wrapper).
 * - Shows a persistent AlertDialog when a new version is waiting.
 * - Offers a discreet floating "Update available" badge when the user postpones.
 * - Warns about unsaved forms (any element with [data-dirty-form="true"]).
 */
export default function PwaUpdatePrompt() {
  const [state, setState] = useState<PwaUpdateState>({
    needRefresh: false,
    offlineReady: false,
    updateAvailableAt: null,
    availableVersion: null,
    updating: false,
  });
  const [open, setOpen] = useState(false);
  const [postponed, setPostponed] = useState(false);

  useEffect(() => {
    registerPwa();
    const unsub = subscribePwaUpdate((s) => {
      setState(s);
      if (s.needRefresh && !postponed) setOpen(true);
    });
    return () => {
      unsub();
    };
  }, [postponed]);

  const handleUpdate = useCallback(async () => {
    const hasDirty =
      typeof document !== "undefined" &&
      document.querySelector('[data-dirty-form="true"]') !== null;
    if (hasDirty) {
      const ok = window.confirm(
        "Atualizar agora vai recarregar o app. Dados não salvos podem ser perdidos. Deseja continuar?",
      );
      if (!ok) return;
    }
    await updateApp();
    // updateApp triggers controllerchange → reload; nothing else to do here.
  }, []);

  const handlePostpone = useCallback(() => {
    setOpen(false);
    setPostponed(true);
    // Keep needRefresh true so the small indicator remains visible.
  }, []);

  const reopenPrompt = useCallback(() => {
    setPostponed(false);
    setOpen(true);
  }, []);

  // Do not close programmatically when user hasn't chosen — keep it persistent.
  const onOpenChange = (next: boolean) => {
    if (!next && state.needRefresh) {
      handlePostpone();
      return;
    }
    setOpen(next);
  };

  if (!state.needRefresh) return null;

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="z-[80]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Nova versão disponível
            </AlertDialogTitle>
            <AlertDialogDescription>
              O HexaOS foi atualizado. Atualize agora para receber as melhorias mais
              recentes.
              <span className="block mt-2 text-xs text-muted-foreground">
                Versão atual: <span className="font-mono">{APP_VERSION}</span>
                {state.availableVersion && (
                  <>
                    <br />
                    Nova build: <span className="font-mono">{state.availableVersion}</span>
                  </>
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={state.updating} onClick={handlePostpone}>
              Depois
            </AlertDialogCancel>
            <AlertDialogAction disabled={state.updating} onClick={handleUpdate}>
              {state.updating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Atualizar agora
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discreet floating indicator while the user postpones the update. */}
      {!open && (
        <div className="fixed bottom-4 right-4 z-[70] animate-fade-in">
          <Button
            size="sm"
            variant="secondary"
            onClick={reopenPrompt}
            className="shadow-lg border border-primary/30 bg-card/95 backdrop-blur-md gap-2"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            Nova versão disponível
          </Button>
        </div>
      )}
    </>
  );
}
