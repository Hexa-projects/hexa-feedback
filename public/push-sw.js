// HexaOS Push Service Worker — dedicated to Web Push notifications.
// Separate from any app-shell / PWA cleanup worker. Scope: /push-sw.js -> "/".

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try { payload = { title: "HexaOS", body: event.data ? event.data.text() : "" }; }
    catch (__) { payload = {}; }
  }

  const title = payload.title || "HexaOS";
  const url = payload.url || "/";
  const tag = payload.tag || "hexaos-generic";

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/pwa-192.png",
    badge: payload.badge || "/pwa-192.png",
    tag,
    renotify: true,
    requireInteraction: false,
    data: {
      url,
      notification_id: payload.notification_id || null,
      metadata: payload.metadata || {},
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Prefer a same-origin HexaOS tab; ask it to navigate.
    for (const client of allClients) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          client.postMessage({ type: "hexaos-push-navigate", url: targetUrl });
          if ("focus" in client) return client.focus();
        }
      } catch (_) { /* noop */ }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});
