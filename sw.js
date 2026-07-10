const CACHE_NAME = "football-pattern-lab-v46";
const ASSETS = [
  "./",
  "./index.html",
  "./data/mock-data.js?v=46",
  "./manifest.webmanifest",
  "./icons/live-scanner-logo.png",
  "./icons/live-scanner-mark.png",
  "./icons/live-scanner-icon-512.png",
  "./icons/live-scanner-icon-192.png",
  "./icons/live-scanner-icon-180.png",
  "./icons/live-scanner-icon-64.png",
  "./icons/live-scanner-icon-32.png",
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

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
