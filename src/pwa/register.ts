// Guarded PWA service worker registration for HexaOS.

// Uses `virtual:pwa-register` from vite-plugin-pwa to control the update flow.
// - Never registers in dev / Lovable preview / iframe
// - Supports ?sw=off kill switch
// - Unregisters stale SWs in refused contexts
// - Exposes a tiny pub/sub store the UI can subscribe to

import { supabase } from "@/integrations/supabase/client";

const SW_PATH = "/sw.js";
const LEGACY_PUSH_SW_PATH = "/push-sw.js";
const REFRESHING_KEY = "hexaos.sw.refreshing";
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

export type PwaUpdateState = {
  needRefresh: boolean;
  offlineReady: boolean;
  updateAvailableAt: number | null;
  availableVersion: string | null;
  updating: boolean;
};

type Listener = (s: PwaUpdateState) => void;

const state: PwaUpdateState = {
  needRefresh: false,
  offlineReady: false,
  updateAvailableAt: null,
  availableVersion: null,
  updating: false,
};

const listeners = new Set<Listener>();
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registered = false;
let updateRequested = false;

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

export async function announceCurrentBuild(): Promise<void> {
  if (isRefusedContext() || APP_VERSION === "dev") return;

  const { error } = await supabase.functions.invoke("announce-app-release", {
    body: { build_id: APP_VERSION },
  });
  if (error) console.warn("[pwa] release notification failed", error.message);
}

export async function updateApp(): Promise<void> {
  // A controllerchange can happen without user interaction when a browser or
  // an older worker activates an update. Only a click on the update action is
  // allowed to turn that event into a page reload.
  updateRequested = true;
  state.updating = true;
  emit();
  console.info("[pwa] applying update…");

  // Fallback path: explicitly tell any waiting SW to skip waiting. This helps
  // when the plugin's internal updater is missing (e.g. registration was
  // aborted) so the new SW still activates and controllerchange triggers reload.
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        const scriptURL =
          r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
        if (!scriptURL.endsWith(SW_PATH)) continue;
        await r.update().catch(() => {});
        r.waiting?.postMessage({ type: "SKIP_WAITING" });
      }
    }
  } catch (err) {
    console.warn("[pwa] skipWaiting postMessage failed", err);
  }

  try {
    if (updateServiceWorker) {
      await updateServiceWorker(true);
      return;
    }
  } catch (err) {
    console.warn("[pwa] updateServiceWorker failed", err);
  }
  // Last resort: hard reload
  window.location.reload();
}

export function dismissUpdate(): void {
  state.needRefresh = false;
  state.availableVersion = null;
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

function flagUpdateAvailable(availableVersion?: string): void {
  state.needRefresh = true;
  state.updateAvailableAt = Date.now();
  state.availableVersion = availableVersion || state.availableVersion;
  emit();
}

async function checkPublishedVersion(): Promise<void> {
  if (isRefusedContext() || !navigator.onLine) return;

  try {
    // This file is excluded from the Workbox precache. The query string and
    // no-store policy prevent an old PWA cache from hiding a new publish.
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { buildId?: string; version?: string };
    const remoteVersion = payload.buildId || payload.version;
    if (remoteVersion && remoteVersion !== APP_VERSION) {
      console.info("[pwa] nova build publicada:", remoteVersion);
      flagUpdateAvailable(remoteVersion);
    }
  } catch {
    // Version polling is auxiliary and must never block the application.
  }
}

async function removeLegacyRootPushWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => {
          const scriptURL =
            registration.active?.scriptURL ||
            registration.waiting?.scriptURL ||
            registration.installing?.scriptURL ||
            "";
          return registration.scope === `${window.location.origin}/` && scriptURL.endsWith(LEGACY_PUSH_SW_PATH);
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    /* noop */
  }
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

  // Older builds registered push-sw.js with scope "/", which can replace the
  // app-shell worker. Remove that conflicting registration before registering
  // the real app-shell worker again.
  await removeLegacyRootPushWorker();

  // Guard against reload loops after controllerchange
  if ("serviceWorker" in navigator) {
    let refreshing = sessionStorage.getItem(REFRESHING_KEY) === "1";
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!updateRequested) {
        console.info("[pwa] service worker assumiu o controle sem recarregar a página");
        return;
      }
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
    let swRegistration: ServiceWorkerRegistration | undefined;

    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.info("[pwa] ✨ nova versão encontrada");
        flagUpdateAvailable();
      },
      onOfflineReady() {
        console.info("[pwa] modo offline pronto");
        state.offlineReady = true;
        emit();
      },
      onRegisteredSW(swUrl, registration) {
        swRegistration = registration;
        console.info("[pwa] service worker registrado:", swUrl);
        if (!registration) return;

        if (registration.waiting) {
          console.info("[pwa] atualização pendente detectada no registro");
          flagUpdateAvailable();
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              console.info("[pwa] nova versão instalada e aguardando ativação");
              flagUpdateAvailable();
            }
            if (worker.state === "activated") {
              console.info("[pwa] atualização aplicada");
            }
          });
        });

        // Periodic update check (every 60s) — cheap HEAD to /sw.js.
        const INTERVAL_MS = 60 * 1000;
        const tick = () => {
          if (!navigator.onLine) return;
          registration.update().catch(() => {});
        };
        setInterval(tick, INTERVAL_MS);
        setInterval(() => {
          void checkPublishedVersion();
        }, INTERVAL_MS);

        // Re-check when tab gains focus / becomes visible again.
        window.addEventListener("focus", tick);
        window.addEventListener("focus", () => {
          void checkPublishedVersion();
        });
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            tick();
            void checkPublishedVersion();
          }
        });

        // Kick a check right after registration so freshly-published
        // versions are picked up on the current session.
        setTimeout(tick, 3000);
        setTimeout(() => {
          void checkPublishedVersion();
        }, 1000);
      },
      onRegisterError(err) {
        console.warn("[pwa] registration error", err);
      },
    });

    // Expose for debugging in prod console (safe, no secrets)
    (window as any).__hexaosPwa = {
      getRegistration: () => swRegistration,
      checkForUpdate: () => swRegistration?.update(),
    };
  } catch (err) {
    console.warn("[pwa] registration failed", err);
  }

}
