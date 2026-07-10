const CACHE_NAME = "football-pattern-lab-v35";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=35",
  "./data/mock-data.js?v=35",
  "./services/football-provider.js?v=35",
  "./services/pattern-engine.js?v=35",
  "./services/signal-result-engine.js?v=35",
  "./services/telegram-service.js?v=35",
  "./services/formatters.js?v=35",
  "./services/storage.js?v=35",
  "./services/history-service.js?v=35",
  "./services/pattern-analytics-service.js?v=35",
  "./services/team-profile-service.js?v=35",
  "./services/settings-service.js?v=35",
  "./services/social-feedback-service.js?v=35",
  "./app.js?v=35",
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
