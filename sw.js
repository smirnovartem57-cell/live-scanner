const CACHE_NAME = "football-pattern-lab-v32";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=32",
  "./data/mock-data.js?v=32",
  "./services/football-provider.js?v=32",
  "./services/pattern-engine.js?v=32",
  "./services/signal-result-engine.js?v=32",
  "./services/telegram-service.js?v=32",
  "./services/formatters.js?v=32",
  "./services/storage.js?v=32",
  "./services/history-service.js?v=32",
  "./services/pattern-analytics-service.js?v=32",
  "./services/team-profile-service.js?v=32",
  "./services/settings-service.js?v=32",
  "./services/social-feedback-service.js?v=32",
  "./app.js?v=32",
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
