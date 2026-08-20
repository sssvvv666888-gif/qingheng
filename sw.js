const CACHE_NAME = "qingheng-pwa-v36";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=36",
  "./app.js?v=36",
  "./user-profile-manager.js?v=36",
  "./bmi-manager.js?v=36",
  "./check-in-system.js?v=36",
  "./nutrition-manager.js?v=36",
  "./recipe-recommendation-system.js?v=36",
  "./family-health-system.js?v=36",
  "./health-score-manager.js?v=36",
  "./ai-food-recognition.js?v=36",
  "./health-trend-manager.js?v=36",
  "./exercise-recommendation-system.js?v=36",
  "./manifest.webmanifest",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/rilakkuma-from-setting.png",
  "./assets/korilakkuma-from-setting.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const requestUrl = new URL(event.request.url);
  const shouldRefresh = event.request.mode === "navigate"
    || requestUrl.pathname.endsWith(".html")
    || requestUrl.pathname.endsWith(".css")
    || requestUrl.pathname.endsWith(".js")
    || requestUrl.pathname.endsWith(".webmanifest");

  if (shouldRefresh) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
