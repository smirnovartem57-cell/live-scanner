const CACHE_NAME = "football-pattern-lab-v37";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=37",
  "./data/mock-data.js?v=37",
  "./services/football-provider.js?v=37",
  "./services/pattern-engine.js?v=37",
  "./services/signal-result-engine.js?v=37",
  "./services/telegram-service.js?v=37",
  "./services/formatters.js?v=37",
  "./services/storage.js?v=37",
  "./services/history-service.js?v=37",
  "./services/pattern-analytics-service.js?v=37",
  "./services/team-profile-service.js?v=37",
  "./services/settings-service.js?v=37",
  "./services/social-feedback-service.js?v=37",
  "./app.js?v=37",
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
