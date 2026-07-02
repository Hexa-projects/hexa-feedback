// Guarded PWA service worker registration for HexaOS.
// Follows the Lovable PWA skill: never register in dev / Lovable preview / iframe,
// supports ?sw=off kill switch, and unregisters stale SWs in refused contexts.

type UpdateCallback = (reload: () => void) => void;

const SW_PATH = "/sw.js";

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

export async function registerPwa(onUpdateAvailable?: UpdateCallback): Promise<void> {
  if (isRefusedContext()) {
    await unregisterMatching();
    return;
  }
  if (!("serviceWorker" in navigator)) return;

  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox(SW_PATH);

    wb.addEventListener("waiting", () => {
      onUpdateAvailable?.(() => {
        wb.addEventListener("controlling", () => window.location.reload());
        wb.messageSkipWaiting();
      });
    });

    await wb.register();
  } catch (err) {
    console.warn("[pwa] registration failed", err);
  }
}
