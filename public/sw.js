const CACHE_NAME = "tradeassistant-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/") || url.hostname.includes("execute-api")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
      return cached || fetched;
    })
  );
});

const VIBRATION_PATTERNS = {
  "session-alert": [200, 100, 200],
  "price-alert": [100, 50, 100, 50, 300],
  "intelligence-alert": [300, 100, 300, 100, 300],
  "economic-alert": [150, 75, 150, 75, 150, 75, 400],
  "briefing": [100, 200, 100],
  "critical": [500, 200, 500, 200, 500],
  "default": [100, 50, 100],
};

function getVibrationPattern(tag, data) {
  if (data.category === "price" && data.body && data.body.includes("critical")) {
    return VIBRATION_PATTERNS["critical"];
  }
  return VIBRATION_PATTERNS[tag] || VIBRATION_PATTERNS["default"];
}

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "TradeAssistant";
  const tag = data.tag || "ta-alert";
  const options = {
    body: data.body || "New alert",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: getVibrationPattern(tag, data),
    data: { url: data.url || "/", category: data.category || "general" },
    actions: data.actions || [],
    tag: tag,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
