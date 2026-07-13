import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Push notification client hook. Registers a dedicated push service worker,
// requests permission, subscribes to Web Push and stores the subscription
// in `public.push_subscriptions`.

const SW_PATH = "/push-sw.js";
const SW_SCOPE = "/push/";

function pushServiceWorkerScope(): string {
  return new URL(SW_SCOPE, window.location.origin).href;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function detectPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mac/i.test(ua)) return "macos";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "web";
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  // @ts-ignore Safari-only
  const iosStandalone = (window.navigator as any)?.standalone === true;
  return !!(mq || iosStandalone);
}

export function usePushNotifications() {
  const { user } = useAuth();

  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [platform] = useState<string>(() => detectPlatform());
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
    setIosNeedsInstall(isIOS() && !isStandalone());
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!isSupported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration(pushServiceWorkerScope());
      const sub = await reg?.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  }, [isSupported]);

  useEffect(() => {
    if (isSupported) refreshSubscription();
  }, [isSupported, refreshSubscription]);

  // SW → app navigation bridge
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data: any = event.data;
      if (data?.type === "hexaos-push-navigate" && typeof data.url === "string") {
        try {
          window.location.assign(data.url);
        } catch { /* noop */ }
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  const getVapidPublicKey = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("get-vapid-public-key");
    if (error) throw new Error(error.message || "Falha ao obter chave VAPID");
    const pk = (data as any)?.publicKey;
    if (!pk) throw new Error("Chave VAPID pública não configurada");
    return pk;
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) throw new Error("Push não suportado neste dispositivo");
    if (!user) throw new Error("Usuário não autenticado");
    if (isIOS() && !isStandalone()) {
      setIosNeedsInstall(true);
      throw new Error(
        "No iPhone/iPad, instale o HexaOS na Tela de Início e abra pelo app para habilitar as notificações.",
      );
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") throw new Error("Permissão de notificação negada");

      const reg =
        (await navigator.serviceWorker.getRegistration(pushServiceWorkerScope())) ||
        (await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE }));
      await reg.update().catch(() => {});

      const publicKey = await getVapidPublicKey();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
        });
      }

      const p256dh = arrayBufferToBase64(sub.getKey("p256dh") as ArrayBuffer);
      const authKey = arrayBufferToBase64(sub.getKey("auth") as ArrayBuffer);

      const { error } = await (supabase as any)
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh,
            auth: authKey,
            user_agent: navigator.userAgent,
            platform,
            enabled: true,
          },
          { onConflict: "user_id,endpoint" },
        );
      if (error) throw error;

      setIsSubscribed(true);
    } finally {
      setLoading(false);
    }
  }, [isSupported, user, getVapidPublicKey, platform]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(pushServiceWorkerScope());
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        try { await sub.unsubscribe(); } catch { /* noop */ }
        if (user) {
          await (supabase as any)
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", endpoint);
        }
      }
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [isSupported, user]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    platform,
    iosNeedsInstall,
    subscribe,
    unsubscribe,
    refreshSubscription,
  };
}
