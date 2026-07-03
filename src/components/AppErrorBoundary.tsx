import { Component, type ReactNode } from "react";

const RELOAD_FLAG = "hexaos.chunk-reload";

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { name?: string; message?: string };
  const name = anyErr?.name ?? "";
  const msg = anyErr?.message ?? "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

/** Force a one-shot hard reload to fetch a fresh index.html + chunk manifest. */
function safeReloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // sessionStorage unavailable — just reload once and hope.
  }
  window.location.reload();
  return true;
}

/** Clear the reload flag after a successful mount so future stale-chunk errors can recover. */
export function armChunkRecovery(): void {
  // Global listeners for lazy-import failures that never reach an ErrorBoundary.
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error) || isChunkLoadError({ message: event.message } as Error)) {
      safeReloadOnce();
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      safeReloadOnce();
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
    if (isChunkLoadError(error)) {
      if (safeReloadOnce()) return;
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
