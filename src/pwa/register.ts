// Guarded PWA service worker registration for HexaOS.

// Uses `virtual:pwa-register` from vite-plugin-pwa to control the update flow.
// - Never registers in dev / Lovable preview / iframe
// - Supports ?sw=off kill switch
// - Unregisters stale SWs in refused contexts
// - Exposes a tiny pub/sub store the UI can subscribe to

const SW_PATH = "/sw.js";
const REFRESHING_KEY = "hexaos.sw.refreshing";

export type PwaUpdateState = {
  needRefresh: boolean;
  offlineReady: boolean;
  updateAvailableAt: number | null;
  updating: boolean;
};

type Listener = (s: PwaUpdateState) => void;

const state: PwaUpdateState = {
  needRefresh: false,
  offlineReady: false,
  updateAvailableAt: null,
  updating: false,
};

const listeners = new Set<Listener>();
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registered = false;

function emit() {
  for (const l of listeners) l({ ...state });
}

export function subscribePwaUpdate(l: Listener): () => void {
  listeners.add(l);
  l({ ...state });
  return () => listeners.delete(l);
}

export function getPwaUpdateState(): PwaUpdateState {
  return { ...state };
}

export async function updateApp(): Promise<void> {
  if (!updateSW) {
    // Fallback: hard reload
    window.location.reload();
    return;
  }
  state.updating = true;
  emit();
  try {
    await updateSW(true);
  } catch (err) {
    console.warn("[pwa] updateSW failed", err);
    // Force reload as last resort
    window.location.reload();
  }
}

export function dismissUpdate(): void {
  state.needRefresh = false;
  emit();
}

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterMatching(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

/**
 * Register the PWA service worker and wire up the update store.
 * Safe to call multiple times — registration only runs once.
 */
export async function registerPwa(): Promise<void> {
  if (registered) return;
  registered = true;

  if (isRefusedContext()) {
    await unregisterMatching();
    return;
  }
  if (!("serviceWorker" in navigator)) return;

  // Guard against reload loops after controllerchange
  if ("serviceWorker" in navigator) {
    let refreshing = sessionStorage.getItem(REFRESHING_KEY) === "1";
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      sessionStorage.setItem(REFRESHING_KEY, "1");
      window.location.reload();
    });
    // Clear the flag once the page has actually reloaded and completed load
    window.addEventListener("load", () => {
      // Small delay so we don't clear before the reload path finishes
      setTimeout(() => sessionStorage.removeItem(REFRESHING_KEY), 1000);
    });
  }

  try {
    const { registerSW } = await import("virtual:pwa-register");
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        state.needRefresh = true;
        state.updateAvailableAt = Date.now();
        emit();
      },
      onOfflineReady() {
        state.offlineReady = true;
        emit();
      },
      onRegisterError(err) {
        console.warn("[pwa] registration error", err);
      },
    });
  } catch (err) {
    console.warn("[pwa] registration failed", err);
  }
}
