const CACHE_NAME = "football-pattern-lab-v21";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data/mock-data.js",
  "./services/football-provider.js",
  "./services/pattern-engine.js",
  "./services/signal-result-engine.js",
  "./services/telegram-service.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./data/sample-matches.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
