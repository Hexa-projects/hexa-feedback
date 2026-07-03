import { Component, type ReactNode } from "react";

const RELOAD_FLAG = "hexaos.chunk-reload";
const APP_SHELL_SW_PATH = "/sw.js";

function isRecoverableStaleAppError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { name?: string; message?: string };
  const name = anyErr?.name ?? "";
  const msg = anyErr?.message ?? "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Cannot destructure property ['"]?basename['"]? of .*useContext\(.*\).*null/i.test(msg) ||
    /useContext\(.*\) is null/i.test(msg)
  );
}

function isAppCache(name: string): boolean {
  return (
    name === "hexaos-pages" ||
    name === "hexaos-assets" ||
    name === "hexaos-images" ||
    /^workbox-precache/i.test(name) ||
    /^workbox-runtime/i.test(name)
  );
}

async function clearAppShellCachesAndWorkers(): Promise<void> {
  await Promise.allSettled([
    (async () => {
      if (!("caches" in window)) return;
      const names = await caches.keys();
      await Promise.allSettled(names.filter(isAppCache).map((name) => caches.delete(name)));
    })(),
    (async () => {
      if (!("serviceWorker" in navigator)) return;
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(
        registrations
          .filter((registration) => {
            const scriptURL =
              registration.active?.scriptURL ||
              registration.waiting?.scriptURL ||
              registration.installing?.scriptURL ||
              "";
            try {
              return new URL(scriptURL).pathname === APP_SHELL_SW_PATH;
            } catch {
              return scriptURL.endsWith(APP_SHELL_SW_PATH);
            }
          })
          .map((registration) => registration.unregister()),
      );
    })(),
  ]);
}

/** Force a one-shot hard reload to fetch a fresh index.html + chunk manifest. */
function recoverFromStaleAppOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // sessionStorage unavailable — just reload once and hope.
  }
  clearAppShellCachesAndWorkers().finally(() => {
    window.location.reload();
  });
  return true;
}

/** Clear the reload flag after a successful mount so future stale-chunk errors can recover. */
export function armChunkRecovery(): void {
  // Global listeners for lazy-import failures that never reach an ErrorBoundary.
  window.addEventListener("error", (event) => {
    if (
      isRecoverableStaleAppError(event.error) ||
      isRecoverableStaleAppError({ message: event.message } as Error)
    ) {
      recoverFromStaleAppOnce();
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isRecoverableStaleAppError(event.reason)) {
      recoverFromStaleAppOnce();
    }
  });

  // Once the app has painted for a bit, clear the reload flag so a *later*
  // stale-chunk error (next deploy) can trigger recovery again.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* noop */
    }
  }, 8000);
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (isRecoverableStaleAppError(error)) {
      if (recoverFromStaleAppOnce()) return;
    }
    console.error("[AppErrorBoundary]", error);
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Não foi possível carregar o HexaOS</h1>
          <p className="text-sm text-muted-foreground">
            Uma atualização pode ter sido publicada. Recarregue a página para continuar.
          </p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
