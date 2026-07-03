import { useEffect, useState, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaPlatform = "android" | "ios" | "desktop" | "other";

const DISMISS_KEY = "hexaos.pwa.installDismissed";

function detectPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux/i.test(ua)) return "desktop";
  return "other";
}

function detectInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari legacy
  // @ts-expect-error non-standard
  if (navigator.standalone === true) return true;
  return false;
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(detectInstalled());
  const [platform] = useState<PwaPlatform>(detectPlatform());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onPrompt = (e: Event) => {
      if (detectInstalled()) return;
      try {
        if (localStorage.getItem(DISMISS_KEY) === "1") return;
      } catch {
        /* noop */
      }
      // The deferred event is only kept because PwaInstallPrompt renders a real
      // install button that later calls event.prompt().
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setIsInstalled(detectInstalled());
    mq.addEventListener?.("change", onChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome;
  }, [deferred]);

  const dismissInstallHint = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setDismissed(true);
  }, []);

  const resetDismiss = useCallback(() => {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* noop */
    }
    setDismissed(false);
  }, []);

  return {
    canInstall: !!deferred && !isInstalled,
    isInstalled,
    platform,
    dismissed,
    promptInstall,
    dismissInstallHint,
    resetDismiss,
  };
}
